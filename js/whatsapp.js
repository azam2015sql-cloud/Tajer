// ==========================================
// WhatsApp Messaging System - v2 Auto-Send
// ==========================================

let _waSelectedCustomers = [];
let _waListType = 'all';
let _waSending = false;
let _waPaused = false;
let _waCancelRequested = false;
let _waSentCount = 0;
let _waMessages = []; // Array of {name, phone, url}
let _waCurrentIndex = 0;
let _waAutoTimer = null;

const WA_SEND_DELAY = 5; // seconds between auto-opens

// ==========================================
// Load Messages Page
// ==========================================
async function loadMessages() {
    const container = document.getElementById('messagesContent');
    if (!container) return;

    const settings = window._settings || {};
    const storeName = settings.storeName || 'المتجر';
    const storePhone = settings.storePhone || '';
    const bankAccounts = settings.bankAccounts || '';
    const currency = settings.currency || 'جنيه';

    container.innerHTML = `
        <div class="wa-header">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="font-size:1.8rem">💬</div>
                <div>
                    <div style="font-weight:700;font-size:0.95rem">رسائل واتساب</div>
                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.8)">أرسل رسائل لعملائك تلقائياً</div>
                </div>
            </div>
        </div>

        <!-- Customer List Filter -->
        <div class="wa-filters">
            <button class="wa-filter-btn active" data-list="all" onclick="waSelectList('all')">📋 الكل</button>
            <button class="wa-filter-btn" data-list="debtors" onclick="waSelectList('debtors')">💰 المطالبين</button>
            <button class="wa-filter-btn" data-list="installments" onclick="waSelectList('installments')">⏰ أقساط مستحقة</button>
            <button class="wa-filter-btn" data-list="custom" onclick="waSelectList('custom')">🎯 مخصصة</button>
        </div>

        <!-- Selected Count -->
        <div id="waSelectedCount" class="wa-selected-count">
            جاري التحميل...
        </div>

        <!-- Customer List (for custom selection) -->
        <div id="waCustomerList" class="wa-customer-list hidden"></div>

        <!-- Message Templates -->
        <div class="wa-templates">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:0.75rem;font-weight:700;color:var(--text-secondary)">📝 القوالب:</span>
                <button onclick="waShowAddTemplateModal()" style="background:none;border:1px dashed var(--border-color);color:var(--accent-primary);padding:3px 10px;border-radius:20px;font-size:0.7rem;cursor:pointer">+ إضافة قالب</button>
            </div>
            <div id="waTemplatesList" style="display:flex;gap:6px;flex-wrap:wrap"></div>
        </div>

        <!-- Message Composer -->
        <div class="wa-composer">
            <div class="wa-composer-header">
                <span style="font-weight:700;font-size:0.82rem">✏️ نص الرسالة</span>
                <span style="font-size:0.65rem;color:var(--text-muted)">{المبلغ} = تلقائي</span>
            </div>
            <textarea id="waMessageText" class="wa-message-input" rows="5" placeholder="اكتب رسالتك هنا...&#10;&#10;سيتم إضافة {المبلغ} تلقائياً إذا كان للعميل مبلغ مستحق"></textarea>
        </div>

        <!-- Store Footer Preview -->
        <div class="wa-footer-preview">
            <div style="font-size:0.7rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px">📄 ديباجة الرسالة (تلقائية):</div>
            <div class="wa-footer-box">
                <div>──────────</div>
                <div>🏪 ${storeName}</div>
                ${storePhone ? `<div>📞 ${storePhone}</div>` : '<div style="color:var(--accent-warning);font-size:0.65rem">⚠️ أضف رقم المتجر في الإعدادات</div>'}
                ${bankAccounts ? `<div>🏦 ${bankAccounts.replace(/\n/g, '<br>🏦 ')}</div>` : ''}
            </div>
        </div>

        <!-- Send Button -->
        <button id="waSendBtn" class="wa-send-btn" onclick="waSendMessages()">
            <span style="font-size:1.2rem">📲</span>
            <span>إرسال الرسائل تلقائياً</span>
        </button>

        <!-- Progress Panel (hidden initially) -->
        <div id="waProgressPanel" class="wa-progress-panel hidden">
            <div class="wa-progress-header">
                <span id="waProgressTitle" style="font-weight:700;font-size:0.85rem">📤 جاري الإرسال...</span>
                <span id="waProgressCount" style="font-size:0.8rem;color:var(--accent-primary);font-weight:700">0/0</span>
            </div>
            <div class="wa-progress-bar-container">
                <div id="waProgressBar" class="wa-progress-bar" style="width:0%"></div>
            </div>
            <div id="waProgressCurrentCustomer" style="font-size:0.78rem;color:var(--text-secondary);text-align:center;margin:8px 0">
            </div>
            <div id="waCountdownDisplay" style="text-align:center;font-size:1.5rem;font-weight:800;color:var(--accent-primary);margin:8px 0">
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
                <button id="waPauseBtn" class="btn btn-sm btn-warning" onclick="waTogglePause()">⏸️ إيقاف مؤقت</button>
                <button class="btn btn-sm btn-danger" onclick="waCancelSend()">⏹️ إلغاء</button>
            </div>
            <div id="waSentList" style="margin-top:12px;max-height:150px;overflow-y:auto"></div>
        </div>
    `;

    // Load customer list and render templates
    await waSelectList('all');
    waRenderTemplates();
}

// ==========================================
// Customer List Filtering
// ==========================================
async function waSelectList(type) {
    _waListType = type;

    // Update filter buttons
    document.querySelectorAll('.wa-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.list === type);
    });

    const customers = await getCustomers();
    const orders = await db.orders.toArray();
    const orderItems = await db.orderItems.toArray();
    const installments = await db.installments.toArray();
    const countEl = document.getElementById('waSelectedCount');
    const listEl = document.getElementById('waCustomerList');

    let filtered = [];

    if (type === 'all') {
        filtered = customers.filter(c => c.phone);
        listEl.classList.add('hidden');
    } else if (type === 'debtors') {
        filtered = customers.filter(c => {
            if (!c.phone) return false;
            const cOrders = orders.filter(o => o.customerId === c.id);
            const cItems = orderItems.filter(i => cOrders.some(o => o.id === i.orderId));
            const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
            const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
            return (total - paid) > 0;
        });
        listEl.classList.add('hidden');
    } else if (type === 'installments') {
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueInstallments = installments.filter(i =>
            i.isPaid !== 'yes' && i.dueDate && new Date(i.dueDate) <= weekLater
        );
        const customerIds = [...new Set(dueInstallments.map(i => i.customerId))];
        filtered = customers.filter(c => c.phone && customerIds.includes(c.id));
        listEl.classList.add('hidden');
    } else if (type === 'custom') {
        listEl.classList.remove('hidden');
        listEl.innerHTML = customers.filter(c => c.phone).map(c => `
            <label class="wa-customer-item">
                <input type="checkbox" value="${c.id}" onchange="waUpdateCustomSelection()" ${_waSelectedCustomers.includes(c.id) ? 'checked' : ''}>
                <span>${c.name}</span>
                <span style="color:var(--text-muted);font-size:0.65rem;direction:ltr">${c.phone}</span>
            </label>
        `).join('') || '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">لا يوجد عملاء لديهم أرقام هواتف</div>';
        filtered = customers.filter(c => c.phone && _waSelectedCustomers.includes(c.id));
    }

    _waSelectedCustomers = filtered.map(c => c.id);
    countEl.innerHTML = `<span style="font-weight:700;color:var(--accent-primary)">${filtered.length}</span> عميل سيتلقى الرسالة`;
}

function waUpdateCustomSelection() {
    const checks = document.querySelectorAll('#waCustomerList input[type="checkbox"]:checked');
    _waSelectedCustomers = Array.from(checks).map(c => parseInt(c.value));
    document.getElementById('waSelectedCount').innerHTML =
        `<span style="font-weight:700;color:var(--accent-primary)">${_waSelectedCustomers.length}</span> عميل محدد`;
}

// ==========================================
// Message Templates (built-in + user-custom)
// ==========================================
const WA_BUILTIN_TEMPLATES = [
    { id: 'debt', icon: '💰', label: 'تذكير بمبلغ', text: 'السلام عليكم ورحمة الله\n\nنود تذكيركم بالمبلغ المستحق وقدره {المبلغ}\n\nنأمل السداد في أقرب وقت ممكن.\nشكراً لتعاملكم معنا 🙏' },
    { id: 'installment', icon: '⏰', label: 'قسط مستحق', text: 'السلام عليكم ورحمة الله\n\nنود إعلامكم بأن موعد سداد القسط المستحق بمبلغ {المبلغ} قد حان.\n\nنرجو السداد في الموعد المحدد.\nشكراً لكم 🙏' },
    { id: 'promo', icon: '🎉', label: 'عرض جديد', text: 'السلام عليكم ورحمة الله\n\nيسعدنا إعلامكم بوصول منتجات جديدة! 🎉\n\nزورونا للاطلاع على أحدث العروض والمنتجات.\n\nفي انتظاركم! 😊' },
    { id: 'thanks', icon: '🙏', label: 'شكر وتقدير', text: 'السلام عليكم ورحمة الله\n\nنشكركم على تعاملكم معنا ونقدر ثقتكم الغالية. 🙏\n\nنتمنى أن نكون دائماً عند حسن ظنكم.\n\nمع أطيب التحيات 💐' }
];

function waGetCustomTemplates() {
    try { return JSON.parse(localStorage.getItem('wa_custom_templates') || '[]'); } catch { return []; }
}

function waSaveCustomTemplates(list) {
    localStorage.setItem('wa_custom_templates', JSON.stringify(list));
}

function waRenderTemplates() {
    const container = document.getElementById('waTemplatesList');
    if (!container) return;
    const custom = waGetCustomTemplates();
    const allTemplates = [...WA_BUILTIN_TEMPLATES, ...custom];

    container.innerHTML = allTemplates.map((t, i) => {
        const isCustom = i >= WA_BUILTIN_TEMPLATES.length;
        return `<div style="display:flex;align-items:center;gap:2px">
            <button class="wa-template-btn" onclick="waUseTemplate('${t.id || 'c' + i}')" title="${(t.text || '').substring(0, 60)}...">${t.icon || '📝'} ${t.label}</button>
            ${isCustom ? `<button onclick="waEditTemplate(${i - WA_BUILTIN_TEMPLATES.length})" style="background:none;border:none;color:var(--text-muted);font-size:0.7rem;cursor:pointer;padding:2px 4px">✏️</button>` : ''}
        </div>`;
    }).join('');
}

function waUseTemplate(id) {
    const custom = waGetCustomTemplates();
    const allTemplates = [...WA_BUILTIN_TEMPLATES, ...custom];
    // Check built-in IDs first
    let t = allTemplates.find(x => x.id === id);
    // Fallback: numeric custom index
    if (!t && id.startsWith('c')) {
        const idx = parseInt(id.substring(1)) - WA_BUILTIN_TEMPLATES.length;
        t = custom[idx - WA_BUILTIN_TEMPLATES.length] || custom[parseInt(id.replace('c', ''))];
    }
    if (t) document.getElementById('waMessageText').value = t.text;
}

function waShowAddTemplateModal(editIdx = -1) {
    const custom = waGetCustomTemplates();
    const editing = editIdx >= 0 ? custom[editIdx] : null;
    const body = `
        <div class="form-group">
            <label>اسم القالب *</label>
            <input type="text" id="tmplLabel" class="input-field" placeholder="مثال: رسالة ترحيب" value="${editing ? editing.label : ''}">
        </div>
        <div class="form-group">
            <label>رمز (اختياري)</label>
            <input type="text" id="tmplIcon" class="input-field" placeholder="📝" value="${editing ? editing.icon : '📝'}" style="width:60px">
        </div>
        <div class="form-group">
            <label>نص القالب *</label>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">
                استخدم <code style="background:var(--bg-card);padding:1px 5px;border-radius:4px">{المبلغ}</code> لإضافة مبلغ العميل تلقائياً
                (مبلغ الدين للمطالبين / مبلغ القسط لقائمة الأقساط)
            </div>
            <textarea id="tmplText" class="input-field" rows="5" style="width:100%;resize:vertical" placeholder="اكتب نص القالب...">${editing ? editing.text : ''}</textarea>
        </div>
    `;
    const footer = `
        ${editIdx >= 0 ? `<button class="btn btn-danger" onclick="waDeleteTemplate(${editIdx})">🗑️ حذف</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="waSaveTemplate(${editIdx})">💾 حفظ</button>
    `;
    openModal(editIdx >= 0 ? 'تعديل القالب' : 'إضافة قالب جديد', body, footer);
}

function waEditTemplate(idx) {
    waShowAddTemplateModal(idx);
}

function waSaveTemplate(editIdx) {
    const label = document.getElementById('tmplLabel').value.trim();
    const icon = document.getElementById('tmplIcon').value.trim() || '📝';
    const text = document.getElementById('tmplText').value.trim();
    if (!label || !text) { showToast('يرجى ملء النص والاسم', 'error'); return; }
    const custom = waGetCustomTemplates();
    const t = { id: 'custom_' + Date.now(), icon, label, text };
    if (editIdx >= 0) { custom[editIdx] = t; } else { custom.push(t); }
    waSaveCustomTemplates(custom);
    closeModal();
    waRenderTemplates();
    showToast('تم حفظ القالب ✅');
}

function waDeleteTemplate(idx) {
    const custom = waGetCustomTemplates();
    custom.splice(idx, 1);
    waSaveCustomTemplates(custom);
    closeModal();
    waRenderTemplates();
    showToast('تم حذف القالب');
}

// ==========================================
// Send Messages Auto-Sequentially
// ==========================================
async function waSendMessages() {
    const messageText = document.getElementById('waMessageText').value.trim();
    if (!messageText) {
        showToast('اكتب نص الرسالة أولاً', 'error');
        return;
    }
    if (_waSelectedCustomers.length === 0) {
        showToast('لا يوجد عملاء محددين', 'error');
        return;
    }

    // Build all message URLs
    const settings = window._settings || {};
    const currency = settings.currency || 'جنيه';
    const storeName = settings.storeName || '';
    const storePhone = settings.storePhone || '';
    const bankAccounts = settings.bankAccounts || '';
    const storeCountryCode = (COUNTRY_DATA[settings.country] || { phoneCode: '+249' }).phoneCode;

    // Build footer
    let footer = '\n──────────';
    if (storeName) footer += `\n🏪 ${storeName}`;
    if (storePhone) footer += `\n📞 ${storePhone}`;
    if (bankAccounts) footer += `\n🏦 ${bankAccounts.replace(/\n/g, '\n🏦 ')}`;

    const customers = await getCustomers();
    const orders = await db.orders.toArray();
    const orderItems = await db.orderItems.toArray();
    const installments = await db.installments.toArray();

    _waMessages = [];

    for (const custId of _waSelectedCustomers) {
        const cust = customers.find(c => c.id === custId);
        if (!cust || !cust.phone) continue;

        // Calculate amount
        let amount = 0;
        if (_waListType === 'debtors' || _waListType === 'all') {
            const cOrders = orders.filter(o => o.customerId === cust.id);
            const cItems = orderItems.filter(i => cOrders.some(o => o.id === i.orderId));
            const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
            const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
            amount = total - paid;
        } else if (_waListType === 'installments') {
            const now = new Date();
            const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const dueInst = installments.filter(i =>
                i.customerId === cust.id && i.isPaid !== 'yes' && i.dueDate && new Date(i.dueDate) <= weekLater
            );
            amount = dueInst.reduce((s, i) => s + (i.amount || 0), 0);
        }

        // Replace placeholders
        let msg = messageText
            .replace(/\{المبلغ\}/g, amount > 0 ? `${amount.toLocaleString()} ${currency}` : '')
            .replace(/\{اسم_العميل\}/g, cust.name);

        msg += footer;

        // Clean phone number
        let phone = cust.phone.replace(/[-\s]/g, '');
        if (phone.startsWith('00')) phone = '+' + phone.substring(2);
        if (phone.startsWith('0')) {
            phone = storeCountryCode + phone.substring(1);
        }
        phone = phone.replace('+', '');

        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

        _waMessages.push({
            name: cust.name,
            phone: cust.phone,
            url: waUrl
        });
    }

    if (_waMessages.length === 0) {
        showToast('لا يوجد عملاء مطابقين ببيانات صحيحة', 'error');
        return;
    }

    // Start sequential sending
    _waSending = true;
    _waPaused = false;
    _waCancelRequested = false;
    _waSentCount = 0;
    _waCurrentIndex = 0;

    // Toggle UI
    document.getElementById('waSendBtn').classList.add('hidden');
    const progressPanel = document.getElementById('waProgressPanel');
    progressPanel.classList.remove('hidden');
    document.getElementById('waSentList').innerHTML = '';

    // Send first message
    waSendNext();
}

function waSendNext() {
    if (_waCancelRequested || _waCurrentIndex >= _waMessages.length) {
        waFinishSending();
        return;
    }

    if (_waPaused) return;

    const msg = _waMessages[_waCurrentIndex];
    const total = _waMessages.length;

    // Update progress UI
    document.getElementById('waProgressCount').textContent = `${_waCurrentIndex + 1}/${total}`;
    document.getElementById('waProgressBar').style.width = `${((_waCurrentIndex + 1) / total) * 100}%`;
    document.getElementById('waProgressTitle').textContent = '📤 اضغط الزر لإرسال الرسالة';
    document.getElementById('waCountdownDisplay').textContent = '';

    // Show customer info + a VISIBLE WhatsApp button (real user gesture = opens app)
    document.getElementById('waProgressCurrentCustomer').innerHTML = `
        <div style="text-align:center;padding:8px 0">
            <div style="font-size:0.9rem;font-weight:700;margin-bottom:6px">👤 ${msg.name}</div>
            <div style="color:var(--text-muted);direction:ltr;font-size:0.75rem;margin-bottom:12px">${msg.phone}</div>
            <a href="${msg.url}" 
               id="waDirectSendBtn"
               target="_blank"
               style="display:inline-block;background:#25d366;color:white;padding:12px 28px;border-radius:12px;font-size:0.95rem;font-weight:700;text-decoration:none;box-shadow:0 4px 15px rgba(37,211,102,0.3)"
               onclick="waOnUserTapSend()">
                📲 إرسال عبر واتساب
            </a>
        </div>
    `;

    // Add to sent list
    const sentList = document.getElementById('waSentList');
    sentList.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border-color);font-size:0.75rem">
            <span style="color:var(--accent-info)">⏳</span>
            <span style="flex:1">${msg.name}</span>
            <span style="color:var(--text-muted);direction:ltr;font-size:0.65rem">${msg.phone}</span>
        </div>
    ` + sentList.innerHTML;
}

// Called when user taps the WhatsApp send button (real user gesture)
function waOnUserTapSend() {
    const msg = _waMessages[_waCurrentIndex];

    // Update the sent item to show success
    const sentList = document.getElementById('waSentList');
    const firstItem = sentList.firstElementChild;
    if (firstItem) {
        firstItem.querySelector('span').textContent = '✅';
        firstItem.querySelector('span').style.color = 'var(--accent-success)';
    }

    _waSentCount++;
    _waCurrentIndex++;

    // Change UI to "waiting for return"
    document.getElementById('waProgressTitle').textContent = '⏳ أرسل الرسالة ثم عد للتطبيق...';
    document.getElementById('waProgressCurrentCustomer').innerHTML = `
        <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.85rem">
            اضغط زر الإرسال في واتساب ثم عد هنا<br>
            <span style="font-size:1.5rem">📲 ← 🔙</span>
        </div>
    `;

    // Listen for user returning from WhatsApp
    if (_waCurrentIndex < _waMessages.length) {
        _waVisibilityHandler = function () {
            if (document.visibilityState === 'visible' && _waSending && !_waPaused && !_waCancelRequested) {
                document.removeEventListener('visibilitychange', _waVisibilityHandler);
                _waVisibilityHandler = null;
                waStartCountdown();
            }
        };
        document.addEventListener('visibilitychange', _waVisibilityHandler);
    } else {
        // Last message — wait for return then finish
        _waVisibilityHandler = function () {
            if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', _waVisibilityHandler);
                _waVisibilityHandler = null;
                waFinishSending();
            }
        };
        document.addEventListener('visibilitychange', _waVisibilityHandler);
    }
}

// Visibility handler reference
let _waVisibilityHandler = null;

function waStartCountdown() {
    let seconds = WA_SEND_DELAY;
    const countdownEl = document.getElementById('waCountdownDisplay');
    document.getElementById('waProgressTitle').textContent = '📤 التالي خلال...';
    countdownEl.textContent = seconds;

    _waAutoTimer = setInterval(() => {
        if (_waPaused) return;
        seconds--;
        countdownEl.textContent = seconds > 0 ? seconds : '';

        if (seconds <= 0) {
            clearInterval(_waAutoTimer);
            _waAutoTimer = null;
            waSendNext();
        }
    }, 1000);
}

function waTogglePause() {
    _waPaused = !_waPaused;
    const btn = document.getElementById('waPauseBtn');
    if (_waPaused) {
        btn.textContent = '▶️ استئناف';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-success');
        document.getElementById('waProgressTitle').textContent = '⏸️ متوقف مؤقتاً';
    } else {
        btn.textContent = '⏸️ إيقاف مؤقت';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-warning');
        document.getElementById('waProgressTitle').textContent = '📤 جاري الإرسال...';
        // Resume countdown or send
        if (!_waAutoTimer) {
            waSendNext();
        }
    }
}

function waCancelSend() {
    _waCancelRequested = true;
    _waPaused = false;
    if (_waAutoTimer) {
        clearInterval(_waAutoTimer);
        _waAutoTimer = null;
    }
    waFinishSending();
}

function waFinishSending() {
    _waSending = false;
    if (_waAutoTimer) {
        clearInterval(_waAutoTimer);
        _waAutoTimer = null;
    }

    const total = _waMessages.length;
    document.getElementById('waProgressTitle').textContent = _waCancelRequested
        ? `⏹️ تم إلغاء الإرسال (${_waSentCount}/${total})`
        : `✅ تم الإرسال بنجاح (${_waSentCount}/${total})`;
    document.getElementById('waCountdownDisplay').textContent = '';
    document.getElementById('waProgressCurrentCustomer').textContent = '';
    document.getElementById('waProgressBar').style.width = '100%';

    // Hide control buttons, show done
    const progressPanel = document.getElementById('waProgressPanel');
    const buttons = progressPanel.querySelectorAll('.btn-warning, .btn-success, .btn-danger');
    buttons.forEach(b => b.style.display = 'none');

    // Show reset button
    const resetHTML = `<button class="btn btn-sm btn-primary" onclick="waResetSendUI()" style="margin-top:8px">🔄 إرسال جديد</button>`;
    document.getElementById('waProgressCurrentCustomer').innerHTML = resetHTML;

    showToast(_waCancelRequested
        ? `تم إرسال ${_waSentCount} من ${total} رسالة`
        : `تم إرسال ${_waSentCount} رسالة بنجاح ✅`
    );
}

function waResetSendUI() {
    document.getElementById('waSendBtn').classList.remove('hidden');
    document.getElementById('waProgressPanel').classList.add('hidden');
    _waSending = false;
    _waPaused = false;
    _waCancelRequested = false;
}
