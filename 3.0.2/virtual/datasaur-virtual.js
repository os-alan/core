'use strict';

(function(Hypergrid) {
    var COLUMNS = 1000, // Math.pow(26, 1) + Math.pow(26, 2), // A..ZZ
        ROWS = 5000;

    Hypergrid.modules['datasaur-virtual'] = Hypergrid.require('datasaur-local').extend('DatasaurVirtual',  {

        initialize: function(datasaur, options) {
            this.fetchOrdinal = 0;
            this.cachedRowCount = 0;
            this.clearCache = true;
        },

        fetchData: function(rectangles, callback) {
            if (this.clearCache) {
                this.data = [];
                this.cachedRowCount = 0;
            }

            fetchData.call(this, rectangles, callback);
        },

        setSchema: function(newSchema){
            if (!newSchema.length) {
                var schema = this.schema = Array(COLUMNS);
                for (var i = 0; i < COLUMNS; i++) {
                    var name = excelColumnName(i);
                    schema[i] = { name: name, header: name };
                }
            }

            this.dispatchEvent('fin-hypergrid-schema-loaded');
        },

        /**
         * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getRowCount}
         * @memberOf DatasaurLocal#
         */
        getRowCount: function() {
            return ROWS;
        },

        /**
         * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getColumnCount}
         * @memberOf DatasaurLocal#
         */
        getColumnCount: function() {
            return COLUMNS;
        }
    });

    function log(msg) {
        if (this.trace) {
            console.log(msg);
        }
    }

    function fetchData(rectangles, callback, fetchOrdinal) {
        var latency = this.latency,
            fillAndCall = function(ordinal) {
                if (!latency || Math.random() > this.failureRate) {
                    // case 1: no latency (always succeeds)
                    // case 2.1: lazy success
                    if (ordinal < this.fetchOrdinal) {
                        log.call(this, '-' + ordinal + ' fetch resolved late: skipping callback(false)'); // observe non-deterministic order of callbacks
                    } else {
                        fillRects.call(this, rectangles);
                        log.call(this, '+' + ordinal + ' fetch resolved timely: calling callback(false)'); // observe non-deterministic order of callbacks
                        if (callback) { callback(false); } // falsy means success (Hypergrid currently not using this value)
                    }
                } else if (this.autoRetry) {
                    // case 2.2: lazy retry
                    log.call(this, '~' + ordinal + ' retry');
                    setTimeout(fetchData.bind(this, rectangles, callback, ordinal),
                        Math.random() < .2 ? 5 * latency : latency); // simulate a data server timeout (5 x latency) as cause of failure 20% of the time;
                } else {
                    // case 2.3: lazy failure
                    if (ordinal < this.fetchOrdinal) {
                        log.call(this, '-' + ordinal + ' fetch failed late: skipping callback(true)');
                    } else {
                        log.call(this, '+' + ordinal + ' fetch failed timely: calling callback(true)');
                        if (callback) { callback(true); } // truthy means error (Hypergrid currently not using this value)
                    }
                }
            };

        if (!fetchOrdinal) {
            fetchOrdinal = ++this.fetchOrdinal;
            log.call(this, ' ' + fetchOrdinal + ' fetch request');
        }

        if (latency) {
            // apply latency fudge factor
            var randomFactor = Math.random(),
                direction = Math.random() > .5 ? 1 : -1;

            latency += direction * randomFactor * latency * this.latencyDeviation;

            // case 2: lazy with latency ± a randomly factored latency deviation
            setTimeout(fillAndCall.bind(this, fetchOrdinal), latency);
        } else {
            // case 1: no latency
            fillAndCall.call(this, fetchOrdinal);
        }
    }

    function fillRects(rects) {
        var data = this.data,
            schema = this.schema,
            rows = 0;

        rects.forEach(function(rect) {
            for (var y = rect.origin.y, Y = Math.min(rect.corner.y, ROWS); y < Y; ++y) {
                var dataRow = data[y];
                if (!dataRow) {
                    dataRow = data[y] = {};
                    rows += 1;
                }
                for (var x = rect.origin.x, X = rect.corner.x; x < X; ++x) {
                    var name = schema[x].name;
                    dataRow[name] = name + ':' + (y + 1);
                }
            }
        });

        document.getElementById('cached-row-count').innerHTML = this.cachedRowCount += rows;
    }

    function parseTextInput(id) {
        return parseInt('0' + document.getElementById(id).value, 10);
    }

    // https://www.johndcook.com/blog/2010/04/29/simple-approximation-to-normal-distribution/
    // Input: -3 <= stdDev <= +3
    // Output: 0.0 <= value <= 1.0
    // This rough approximation of a bell curve is NOT asymptotic.
    // It is 2π wide so the x input conveniently gives rough standard deviations so I've called it stdDev rather than x.
    function approxBellCurve(stdDev) {
        return (1 + Math.cos(stdDev)) / (2 * Math.PI) * Math.PI;
    }

    var BASE = 26, A = 'A'.charCodeAt();

    function excelColumnName(x) {
        var result = '', digits;
        for (var n = 1, range = 0, base = 0; true; n++, base = range) {
            range += Math.pow(BASE, n);
            if (x < range) {
                digits = n;
                x -= base;
                break;
            }
        }

        for (var i = 0; i < digits; ++i) {
            result = String.fromCharCode(A + x % 26) + result;
            x = Math.floor(x / 26);
        }

        return result;
    }
})(fin.Hypergrid);