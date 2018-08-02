'use strict';

var NEW = '(New)';

var grid = new fin.Hypergrid({ boundingRect: { height: '141px' } }); // 5 * 28 + 2 - 1

grid.properties.defaultRowHeight = 26;
grid.properties.foregroundSelectionFont = 'bold ' + (grid.properties.font = '14pt sans-serif');

putJSON('data', [
    { symbol: 'APPL', name: 'Apple Inc.', prevclose: 93.13 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', prevclose: 51.91 },
    { symbol: 'TSLA', name: 'Tesla Motors Inc.', prevclose: 196.40 },
    { symbol: 'IBM', name: 'International Business Machines Corp', prevclose: 155.35 }
]);

callApi('setData', 'data');

putJSON('state', {
    editable: true,
    editor: 'textfield',
    columns: {
        prevclose: {
            halign: 'right',
            format: 'trend'
        }
    },
    showRowNumbers: false
});

callApi('addState', 'state');

grid.addEventListener('fin-after-cell-edit', function(e) {
    putJSON('data', grid.behavior.getData());
});

initLocalsButtons();

var saveFuncs = {
    editor: saveCellEditor,
    localizer: saveLocalizer
};

Object.keys(scripts).forEach(function(key) {
    initScripts(key);
});

function initLocalsButton(type, locals) {
    var el = document.getElementById(type + '-dropdown').parentElement.querySelector('.locals');
    locals = locals.sort();
    el.title = locals.join('\n');
    el.onclick = function() { alert('Local variables: ' + locals.join(', ')); };
}

function initLocalsButtons() {
    initLocalsButton('editor', ['module', 'exports', 'CellEditor'].concat(Object.keys(grid.cellEditors.items)));
    initLocalsButton('localizer', ['module', 'exports']);
}

function initScripts(type) {
    var scriptList = scripts[type],
        dropdownEl = document.getElementById(type + '-dropdown'),
        scriptEl = document.getElementById(type + '-script'),
        addButtonEl = dropdownEl.nextElementSibling,
        save = saveFuncs[type];

    scriptList.map(extractName).sort().forEach(function(key) {
        dropdownEl.add(new Option(key));
        if (key !== NEW) {
            save(findScript(scriptList, key));
        }
    });

    dropdownEl.onchange = function() {
        scriptEl.value = findScript(scriptList, this.value);
    };

    dropdownEl.onchange();

    addButtonEl.onclick = function() {
        save(scriptEl.value, dropdownEl);
    }
}

function findScript(scriptList, name) {
    return scriptList.find(isScriptByName.bind(null, name));
}

function saveScript(scriptList, name, script) {
    var index = scriptList.findIndex(isScriptByName.bind(null, name));
    if (index >= 0) {
        scriptList[index] = script;
    } else {
        scriptList.push(script);
    }
}

function isScriptByName(name, script) {
    return extractName(script) === name;
}

function extractName(script) {
    var match = script.match(/\.extend\('([^']+)'|\.extend\("([^"]+)"|\bname:\s*'([^']+)'|\bname:\s*"([^"]+)"/);
    return match[1] || match[2] || match[3] || match[4];
}

function putJSON(key, json) {
    document.getElementById(key).value = JSON.stringify(json, undefined, 2)
        .replace(/(  +)"([a-zA-Z$_]+)"(: )/g, '$1$2$3'); // un-quote keys
}

function callApi(methodName, id, confirm) {
    var jsonEl = document.getElementById(id), value;

    // L-value must be inside eval because R-value beginning with '{' is eval'd as BEGIN block
    // used eval because JSON.parse rejects unquoted keys
    eval('value =' + jsonEl.value);
    grid[methodName].call(grid, value);

    if (confirm) {
        confirmation(jsonEl.parentElement);
    }
}

function saveCellEditor(script, select) {
    var cellEditors = grid.cellEditors;
    var editorNames = Object.keys(cellEditors.items);
    var editors = editorNames.map(function(name) { return cellEditors.items[name]; });
    var exports = {}, module = { exports: exports };
    var formalArgs = [null, 'module', 'exports', 'CellEditor'] // null is for bind's thisArg
        .concat(editorNames) // additional params
        .concat(script); // function body
    var actualArgs = [module, exports, cellEditors.BaseClass]
        .concat(editors);

    try {
        var closure = new (Function.prototype.bind.apply(Function, formalArgs)); // calls Function constructor using .apply
        closure.apply(null, actualArgs);
        var Editor = module.exports;
        var name = Editor.prototype.$$CLASS_NAME;
        if (!(Editor.prototype instanceof cellEditors.BaseClass)) {
            throw 'Cannot save cell editor "' + name + '" because it is not a subclass of CellEditor (aka grid.cellEditors.BaseClass).';
        }
        if (!name || name === NEW) {
            throw 'Cannot save cell editor. A `name` property with a value other than "new" is required.';
        }
    } catch (err) {
        console.error(err);
        alert(err + '\n\nAvailable locals: ' + formalArgs.slice(1, formalArgs.length - 1).join(', ') +
            '\n\nNOTE: Cell editors that extend directly from CellEditor must define a `template` property.');
        return;
    }

    cellEditors.add(Editor);

    saveScript(scripts.editor, name, script);

    addOptionInAlphaOrder(select, name);

    if (select) {
        confirmation(select.parentElement);
    }

    initLocalsButtons();
}

function saveLocalizer(script, select) {
    var module = {};

    try {
        var closure = new Function('module', script);
        closure(module);
        var localizer = module.exports;
        var name = localizer.name;
        if (!name || name === NEW) {
            throw 'Cannot save localizer. A `name` property with a value other than "(New)" is required.';
        }
        grid.localization.add(localizer);
    } catch (err) {
        console.error(err);
        alert(err + '\n\nAvailable locals:\n\tmodule');
        return;
    }

    saveScript(scripts.localizer, name, script);

    addOptionInAlphaOrder(select, name);

    if (select) {
        confirmation(select.parentElement);
    }
}

function addOptionInAlphaOrder(el, text, value) {
    if (!el) {
        return;
    }

    var optionEls = Array.prototype.slice.call(el.options);

    if (optionEls.find(function(optionEl) { return optionEl.textContent === text; })) {
        return; // already in dropdown
    }

    var firstOptionGreaterThan = optionEls.find(function(optionEl) {
        return optionEl.textContent > text;
    });

    el.value = name;
    if (el.selectedIndex === -1) {
        el.add(new Option(text, value), firstOptionGreaterThan);
        el.value = value || text;
    }
}

function confirmation(content) {
    var el = content.querySelector('span.feedback');
    var style = el.style;
    var text = el.innerText;
    style.display = 'inline';
    setTimeout(function() {
        style.display = 'none';
    }, 750 + 50 * text.length);
}
