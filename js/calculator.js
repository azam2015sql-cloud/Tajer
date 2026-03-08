// ==========================================
// Slide-out Calculator Panel - v5 Width Resize
// ==========================================
// App resizes to width:65%, calculator takes 35% on right
// App remains INTERACTIVE, content reflows naturally
// NO CSS transform/scale - just width change

let _calcOpen = false;
let _calcExpression = '';
let _calcDisplay = '0';
let _calcHistory = [];
let _calcMemory = 0;
let _calcNewNumber = true;

// Touch tracking for swipe
let _calcTouchStartX = 0;
let _calcTouchCurrentX = 0;
let _calcDragging = false;

// ==========================================
// Initialize Calculator
// ==========================================
function initCalculator() {
    const calcHTML = `
        <div id="calcEdgeHint" class="calc-edge-hint" onclick="toggleCalculator(true)">🧮</div>
        <div id="calcPanel" class="calc-panel">
            <div class="calc-header-bar">
                <span class="calc-header-title">🧮 حاسبة</span>
                <button class="calc-close-btn" onclick="toggleCalculator(false)">✕</button>
            </div>
            <div class="calc-display-area">
                <div id="calcExpression" class="calc-expr"></div>
                <div id="calcResult" class="calc-result-display">0</div>
            </div>
            <div class="calc-mem-row">
                <button class="calc-m" onclick="calcMem('MC')">MC</button>
                <button class="calc-m" onclick="calcMem('MR')">MR</button>
                <button class="calc-m" onclick="calcMem('M+')">M+</button>
                <button class="calc-m" onclick="calcMem('M-')">M-</button>
                <button class="calc-m" onclick="copyCalcResult()">📋</button>
            </div>
            <div class="calc-grid">
                <button class="ck ck-fn" onclick="cPress('C')">C</button>
                <button class="ck ck-fn" onclick="cPress('⌫')">⌫</button>
                <button class="ck ck-fn" onclick="cPress('%')">%</button>
                <button class="ck ck-op" onclick="cPress('÷')">÷</button>
                <button class="ck" onclick="cPress('7')">7</button>
                <button class="ck" onclick="cPress('8')">8</button>
                <button class="ck" onclick="cPress('9')">9</button>
                <button class="ck ck-op" onclick="cPress('×')">×</button>
                <button class="ck" onclick="cPress('4')">4</button>
                <button class="ck" onclick="cPress('5')">5</button>
                <button class="ck" onclick="cPress('6')">6</button>
                <button class="ck ck-op" onclick="cPress('-')">−</button>
                <button class="ck" onclick="cPress('1')">1</button>
                <button class="ck" onclick="cPress('2')">2</button>
                <button class="ck" onclick="cPress('3')">3</button>
                <button class="ck ck-op" onclick="cPress('+')">+</button>
                <button class="ck ck-fn" onclick="cPress('±')">±</button>
                <button class="ck" onclick="cPress('0')">0</button>
                <button class="ck" onclick="cPress('.')">.</button>
                <button class="ck ck-eq" onclick="cPress('=')">=</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', calcHTML);

    // Swipe-to-close on calculator panel
    const panel = document.getElementById('calcPanel');
    panel.addEventListener('touchstart', (e) => {
        if (!_calcOpen) return;
        _calcTouchStartX = e.touches[0].clientX;
        _calcTouchCurrentX = _calcTouchStartX;
        _calcDragging = true;
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
        if (!_calcDragging) return;
        _calcTouchCurrentX = e.touches[0].clientX;
        const diff = _calcTouchCurrentX - _calcTouchStartX;
        // Only track rightward swipe (to close)
        if (diff > 10) {
            panel.style.transition = 'none';
            panel.style.transform = `translateX(${diff}px)`;
        }
    }, { passive: true });

    panel.addEventListener('touchend', () => {
        if (!_calcDragging) return;
        _calcDragging = false;
        const diff = _calcTouchCurrentX - _calcTouchStartX;
        panel.style.transition = '';
        panel.style.transform = '';
        // If swiped more than 30% of panel width, close
        if (diff > panel.offsetWidth * 0.3) {
            toggleCalculator(false);
        }
    }, { passive: true });
}

// ==========================================
// Toggle Calculator Open/Close
// ==========================================
function toggleCalculator(open) {
    _calcOpen = open;
    const panel = document.getElementById('calcPanel');
    const edge = document.getElementById('calcEdgeHint');
    const appContainer = document.querySelector('.app-container');

    if (open) {
        panel.classList.add('open');
        edge.classList.add('hidden');
        if (appContainer) appContainer.classList.add('calc-active');
    } else {
        panel.classList.remove('open');
        panel.style.transform = '';
        edge.classList.remove('hidden');
        if (appContainer) appContainer.classList.remove('calc-active');
    }
}

// ==========================================
// Calculator Input Handler
// ==========================================
function cPress(key) {
    const display = document.getElementById('calcResult');
    const expr = document.getElementById('calcExpression');
    const ops = ['+', '-', '×', '÷'];

    if (key === 'C') {
        _calcExpression = '';
        _calcDisplay = '0';
        _calcNewNumber = true;
    } else if (key === '⌫') {
        if (_calcDisplay.length > 1) {
            _calcDisplay = _calcDisplay.slice(0, -1);
        } else {
            _calcDisplay = '0';
            _calcNewNumber = true;
        }
        _calcExpression = _calcExpression.slice(0, -1) || '';
    } else if (key === '±') {
        if (_calcDisplay !== '0') {
            _calcDisplay = _calcDisplay.startsWith('-')
                ? _calcDisplay.substring(1)
                : '-' + _calcDisplay;
        }
    } else if (key === '=') {
        try {
            const evalExpr = _calcExpression
                .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/%/g, '/100');
            const result = Function('"use strict"; return (' + evalExpr + ')')();
            const formatted = parseFloat(result.toFixed(10));
            _calcHistory.unshift({ expr: _calcExpression, result: formatted });
            if (_calcHistory.length > 20) _calcHistory.pop();
            expr.textContent = _calcExpression + ' =';
            _calcDisplay = String(formatted);
            _calcExpression = String(formatted);
            _calcNewNumber = true;
        } catch (e) {
            _calcDisplay = 'خطأ';
            _calcExpression = '';
            _calcNewNumber = true;
        }
    } else if (ops.includes(key)) {
        _calcExpression += key;
        _calcDisplay = key;
        _calcNewNumber = true;
    } else if (key === '%') {
        _calcExpression += '%';
        _calcDisplay = '%';
        _calcNewNumber = true;
    } else {
        if (_calcNewNumber) {
            _calcDisplay = key;
            _calcNewNumber = false;
        } else {
            if (key === '.' && _calcDisplay.includes('.')) return;
            _calcDisplay += key;
        }
        _calcExpression += key;
    }

    display.textContent = _calcDisplay;
    if (key !== '=') expr.textContent = _calcExpression;
}

// ==========================================
// Memory Functions
// ==========================================
function calcMem(action) {
    const val = parseFloat(_calcDisplay) || 0;
    switch (action) {
        case 'MC': _calcMemory = 0; showToast('تم مسح الذاكرة'); break;
        case 'MR':
            _calcDisplay = String(_calcMemory);
            _calcExpression = String(_calcMemory);
            document.getElementById('calcResult').textContent = _calcDisplay;
            document.getElementById('calcExpression').textContent = _calcExpression;
            _calcNewNumber = true;
            break;
        case 'M+': _calcMemory += val; showToast('M = ' + _calcMemory); break;
        case 'M-': _calcMemory -= val; showToast('M = ' + _calcMemory); break;
    }
}

function copyCalcResult() {
    const text = document.getElementById('calcResult').textContent;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('تم نسخ: ' + text));
    }
}
