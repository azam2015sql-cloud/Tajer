// ==========================================
// Google Sheets Background Sync
// Auto-syncs all user data periodically
// Hidden from users - owner configuration
// ==========================================

const GSHEET_URL_KEY = 'tajer_gsheet_url';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (once per day)
const LAST_SYNC_KEY = 'tajer_last_bg_sync';

function getGSheetUrl() {
    return localStorage.getItem(GSHEET_URL_KEY) || '';
}

// ==========================================
// Background Auto-Sync
// ==========================================
async function backgroundSync() {
    const url = getGSheetUrl();
    if (!url) return; // No URL configured, skip silently

    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSync) {
        const elapsed = Date.now() - parseInt(lastSync);
        if (elapsed < SYNC_INTERVAL_MS) return; // Too soon
    }

    try {
        const products = await getProducts();
        const customers = await getCustomers();
        const orders = await db.orders.toArray();
        const orderItems = await db.orderItems.toArray();
        const suppliers = await getSuppliers();
        const batches = await db.supplyBatches.toArray();
        const installments = await db.installments.toArray();
        const supplierPayments = await db.supplierPayments.toArray();
        const categories = await getCategories();

        const auth = getAuthData();

        const payload = {
            action: 'sync',
            deviceId: getDeviceId(),
            storeName: window._settings?.storeName || 'متجري',
            syncDate: new Date().toISOString(),
            userName: auth?.username || 'مستخدم',
            userRole: auth?.role || 'user',
            data: {
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    category: categories.find(c => c.id === p.categoryId)?.name || '',
                    supplier: suppliers.find(s => s.id === p.supplierId)?.name || '',
                    costPrice: p.costPrice || 0,
                    sellPrice: p.sellPrice || 0,
                    stock: p.stock || 0,
                    unit: p.unit || 'قطعة'
                })),
                customers: customers.map(c => {
                    const cOrders = orders.filter(o => o.customerId === c.id);
                    const cItems = orderItems.filter(i => cOrders.some(o => o.id === i.orderId));
                    const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
                    const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
                    return {
                        id: c.id, name: c.name, phone: c.phone || '',
                        total, paid, remaining: total - paid, ordersCount: cOrders.length
                    };
                }),
                orders: orders.map(o => {
                    const cust = customers.find(c => c.id === o.customerId);
                    const items = orderItems.filter(i => i.orderId === o.id);
                    return {
                        id: o.id, customer: cust?.name || '', date: o.date,
                        paymentType: o.paymentType,
                        total: items.reduce((s, i) => s + (i.total || 0), 0),
                        itemsCount: items.length
                    };
                }),
                suppliers: suppliers.map(s => {
                    const sBatches = batches.filter(b => b.supplierId === s.id);
                    const sPays = supplierPayments.filter(p => p.supplierId === s.id);
                    return {
                        id: s.id, name: s.name, phone: s.phone || '',
                        totalClaim: sBatches.reduce((sum, b) => sum + ((b.costPrice || 0) * (b.quantity || 0)), 0),
                        totalPaid: sPays.reduce((sum, p) => sum + (p.amount || 0), 0)
                    };
                }),
                supplyBatches: batches.map(b => ({
                    id: b.id, supplier: suppliers.find(s => s.id === b.supplierId)?.name || '',
                    product: b.productName || '', quantity: b.quantity,
                    costPrice: b.costPrice, date: b.date
                })),
                installments: installments.map(i => {
                    const cust = customers.find(c => c.id === i.customerId);
                    return {
                        id: i.id, customer: cust?.name || '', amount: i.amount,
                        dueDate: i.dueDate, isPaid: i.isPaid, paidDate: i.paidDate || ''
                    };
                })
            }
        };

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        console.log('Background sync completed at', new Date().toISOString());
    } catch (e) {
        console.log('Background sync failed (silent):', e.message);
    }
}

// ==========================================
// Start Auto-Sync Timer
// ==========================================
function startBackgroundSync() {
    // Initial sync after 30 seconds (avoid impacting app startup)
    setTimeout(() => backgroundSync(), 30000);
    // Then check once every hour (actual sync only if 24h elapsed)
    setInterval(() => backgroundSync(), 60 * 60 * 1000);
}

// ==========================================
// Owner: Google Sheets Setup
// ==========================================
function showGSheetSetupModal() {
    if (!isOwner()) { showToast('هذه الميزة للمالك فقط', 'error'); return; }

    const url = getGSheetUrl();
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const lastSyncDate = lastSync ? new Date(parseInt(lastSync)).toLocaleString('ar-EG') : 'لم تتم بعد';

    const gasCode = `// ====== Google Apps Script - Tajer Backend ======
// 1. أنشئ Google Sheet جديد
// 2. افتح Extensions → Apps Script
// 3. احذف الكود الموجود والصق هذا
// 4. اضغط Deploy → New Deployment → Web App
// 5. Who has access: Anyone → Deploy
// 6. انسخ الرابط

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (data.action === 'sync') {
      let info = ss.getSheetByName('معلومات') || ss.insertSheet('معلومات');
      info.clear();
      info.appendRow(['المتجر', data.storeName]);
      info.appendRow(['المستخدم', data.userName]);
      info.appendRow(['آخر مزامنة', data.syncDate]);
      info.appendRow(['معرف الجهاز', data.deviceId]);
      syncSheet(ss, 'الأصناف', data.data.products,
        ['ID','الصنف','التصنيف','المورد','رأس المال','سعر البيع','المخزون','الوحدة'],
        p => [p.id, p.name, p.category, p.supplier, p.costPrice, p.sellPrice, p.stock, p.unit]);
      syncSheet(ss, 'العملاء', data.data.customers,
        ['ID','العميل','الهاتف','الإجمالي','المدفوع','المتبقي','الطلبات'],
        c => [c.id, c.name, c.phone, c.total, c.paid, c.remaining, c.ordersCount]);
      syncSheet(ss, 'الطلبات', data.data.orders,
        ['ID','العميل','التاريخ','نوع الدفع','الإجمالي','الأصناف'],
        o => [o.id, o.customer, o.date, o.paymentType, o.total, o.itemsCount]);
      syncSheet(ss, 'الموردين', data.data.suppliers,
        ['ID','المورد','الهاتف','المطالبة','المسدد'],
        s => [s.id, s.name, s.phone, s.totalClaim, s.totalPaid]);
      syncSheet(ss, 'سجل التوريدات', data.data.supplyBatches,
        ['ID','المورد','الصنف','الكمية','سعر الوحدة','التاريخ'],
        b => [b.id, b.supplier, b.product, b.quantity, b.costPrice, b.date]);
      syncSheet(ss, 'الأقساط', data.data.installments,
        ['ID','العميل','المبلغ','تاريخ الاستحقاق','مدفوع','تاريخ الدفع'],
        i => [i.id, i.customer, i.amount, i.dueDate, i.isPaid, i.paidDate]);
    }
    return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
function syncSheet(ss, name, data, headers, mapper) {
  let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();
  sheet.appendRow(headers);
  if (data && data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data.map(mapper));
  }
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4285F4').setFontColor('white').setFontWeight('bold');
}
function doGet(e) { return ContentService.createTextOutput('Tajer Backend Active'); }`;

    const body = `
        <div style="max-height:70vh;overflow-y:auto;padding:4px">
            <div style="background:linear-gradient(135deg,#06b6d415,#06b6d405);border:1px solid #06b6d430;border-radius:var(--radius-md);padding:12px;margin-bottom:12px;font-size:0.75rem;line-height:1.6">
                <strong>☁️ المزامنة التلقائية</strong><br>
                تتم كل 30 دقيقة تلقائياً في الخلفية لجميع المستخدمين.<br>
                آخر مزامنة: <strong>${lastSyncDate}</strong>
            </div>
            <div class="form-group">
                <label>🔗 رابط Google Apps Script</label>
                <input type="text" id="gsheetUrl" class="input-field" placeholder="https://script.google.com/macros/s/..." value="${url}" style="direction:ltr;font-size:0.72rem">
            </div>
            <div style="display:flex;gap:6px;margin-top:10px">
                <button class="btn btn-primary btn-block" onclick="saveGSheetUrl()">💾 حفظ</button>
                <button class="btn btn-success btn-block" onclick="backgroundSync().then(()=>showToast('تمت المزامنة ✅'))">🔄 مزامنة الآن</button>
            </div>
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color)">
                <button class="btn btn-outline btn-block btn-sm" onclick="showGASCode()">📝 عرض كود Google Apps Script</button>
            </div>
        </div>
    `;

    openModal('☁️ Google Sheets - إعداد المالك', body, '<button class="btn btn-ghost btn-block" onclick="closeModal()">إغلاق</button>');

    // Store code for display
    window._gasCode = gasCode;
}

function saveGSheetUrl() {
    const url = document.getElementById('gsheetUrl').value.trim();
    if (!url) { showToast('أدخل الرابط', 'error'); return; }
    localStorage.setItem(GSHEET_URL_KEY, url);
    showToast('تم حفظ الرابط ✅ ستبدأ المزامنة التلقائية');
    closeModal();
    // Trigger immediate sync
    backgroundSync();
}

function showGASCode() {
    const code = window._gasCode || '';
    const body = `<div style="max-height:65vh;overflow-y:auto"><pre style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;font-size:0.6rem;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;line-height:1.4">${code}</pre></div>`;
    openModal('📝 كود Google Apps Script', body, `<button class="btn btn-ghost" onclick="closeModal()">إغلاق</button><button class="btn btn-primary" onclick="navigator.clipboard.writeText(window._gasCode);showToast('تم النسخ ✅')">📋 نسخ</button>`);
}
