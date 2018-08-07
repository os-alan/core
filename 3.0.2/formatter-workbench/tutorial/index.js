'use strict';

document.addEventListener('keydown', function(e) {
    switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
            window.top.document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
    }
});

document.addEventListener('scroll', setScrollWarning);

window.onload = setScrollWarning;

function setScrollWarning() {
    var nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight;
    window.top.document.getElementById('scroll-warning').style.display = nearBottom ? 'none' : 'block';
}