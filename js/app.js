// ==========================================
// App.js - Main Entry Point & Navigation
// ==========================================

let _currentPage = 'Dashboard';
let _pageHistory = [];
let _searchVisible = false;

// Pages configuration
const PAGE_CONFIG = {
    'Dashboard': { title: 'تاجر', hasSearch: false, hasFab: false, hasBack: false },
    'Products': { title: 'الأصناف', hasSearch: true, hasFab: true, hasBack: false },
    'Customers': { title: 'العملاء', hasSearch: true, hasFab: true, hasBack: false },
    'CustomerDetail': { title: 'العميل', hasSearch: false, hasFab: true, hasBack: true },
    'Suppliers': { title: 'الموردين', hasSearch: true, hasFab: true, hasBack: false },
    'SupplierDetail': { title: 'المورد', hasSearch: false, hasFab: true, hasBack: true },
    'OrdersHistory': { title: 'سجل الطلبات', hasSearch: true, hasFab: false, hasBack: true },
    'Messages': { title: 'الرسائل', hasSearch: false, hasFab: false, hasBack: false },
    'Reports': { title: 'التقارير', hasSearch: false, hasFab: false, hasBack: false },
    'Settings': { title: 'الإعدادات', hasSearch: false, hasFab: false, hasBack: false }
};

// ==========================================
// Navigation
// ==========================================
function navigateTo(page, param) {
    // Close search
    hideSearch();

    // Save history for back navigation
    if (_currentPage !== page) {
        _pageHistory.push({ page: _currentPage, param: null });
    }

    _currentPage = page;
    const config = PAGE_CONFIG[page] || {};

    // Update header
    document.getElementById('pageTitle').textContent = config.title || page;
    document.getElementById('backBtn').classList.toggle('hidden', !config.hasBack);
    document.getElementById('searchToggle').classList.toggle('hidden', !config.hasSearch);
    document.getElementById('fab').classList.toggle('hidden', !config.hasFab);

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page' + page);
    if (pageEl) pageEl.classList.add('active');

    // Update bottom nav
    const navPage = ['Dashboard', 'Products', 'Customers', 'Messages', 'Suppliers', 'Reports'].includes(page) ? page : null;
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.page === navPage);
    });

    // Load page data
    switch (page) {
        case 'Dashboard': loadDashboard(); break;
        case 'Products': loadProducts(); break;
        case 'Customers': loadCustomers(); break;
        case 'CustomerDetail': loadCustomerDetail(param); break;
        case 'Suppliers': loadSuppliers(); break;
        case 'SupplierDetail': loadSupplierDetail(param); break;
        case 'OrdersHistory': loadOrdersHistory(); break;
        case 'Messages': if (typeof loadMessages === 'function') loadMessages(); break;
        case 'Reports': loadReports(); break;
        case 'Settings': loadSettings(); break;
    }

    // Scroll to top
    document.getElementById('mainContent').scrollTop = 0;
}

function goBack() {
    if (_pageHistory.length > 0) {
        const prev = _pageHistory.pop();
        navigateTo(prev.page, prev.param);
        _pageHistory.pop(); // Remove duplicate from navigateTo
    } else {
        navigateTo('Dashboard');
    }
}

// ==========================================
// FAB Handler
// ==========================================
function handleFabClick() {
    switch (_currentPage) {
        case 'Products': showAddProductModal(); break;
        case 'Customers': showAddCustomerModal(); break;
        case 'CustomerDetail': showNewOrderModal(); break;
        case 'Suppliers': showAddSupplierModal(); break;
        case 'SupplierDetail': showAddSupplierItemModal(); break;
    }
}

// ==========================================
// Search
// ==========================================
function toggleSearch() {
    _searchVisible = !_searchVisible;
    document.getElementById('searchBar').classList.toggle('hidden', !_searchVisible);
    if (_searchVisible) {
        document.getElementById('searchInput').focus();
    } else {
        document.getElementById('searchInput').value = '';
        handleSearch('');
    }
}

function hideSearch() {
    _searchVisible = false;
    const searchBar = document.getElementById('searchBar');
    if (searchBar) searchBar.classList.add('hidden');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
}

const handleSearch = debounce(function (query) {
    switch (_currentPage) {
        case 'Products': loadProducts(query); break;
        case 'Customers': loadCustomers(query); break;
        case 'Suppliers': loadSuppliers(query); break;
        case 'OrdersHistory': loadOrdersHistory(query); break;
    }
}, 300);

// ==========================================
// Settings
// ==========================================
async function loadSettings() {
    const settings = window._settings || {};
    document.getElementById('settingStoreName').value = settings.storeName || '';
    document.getElementById('settingCurrency').value = settings.currency || '';
    document.getElementById('settingUnit').value = settings.defaultUnit || '';
    document.getElementById('settingDarkMode').checked = settings.theme !== 'light';
    document.getElementById('settingStorePhone').value = settings.storePhone || '';
    document.getElementById('settingBankAccounts').value = settings.bankAccounts || '';

    // Show/hide key management based on role
    const auth = getAuthData();
    const keySection = document.getElementById('keyManagementSection');
    if (keySection) keySection.style.display = (auth && auth.role === 'owner') ? '' : 'none';
}

async function saveSetting(key, value) {
    if (!window._settings) return;
    const update = {};
    update[key] = value;
    await db.settings.update(window._settings.id, update);
    window._settings[key] = value;
    showToast('تم الحفظ ✅');
}

function toggleDarkMode(isDark) {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    saveSetting('theme', theme);
}

// ==========================================
// Backup
// ==========================================
async function exportData() {
    try {
        const data = await exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tajer-backup-${today()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('تم تصدير البيانات بنجاح ✅');
    } catch (e) {
        showToast('خطأ في التصدير: ' + e.message, 'error');
    }
}

async function importData(file) {
    if (!file) return;
    const confirmed = await showConfirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟');
    if (!confirmed) return;

    try {
        const text = await file.text();
        await importAllData(text);
        showToast('تم استيراد البيانات بنجاح ✅');
        navigateTo('Dashboard');
    } catch (e) {
        showToast('خطأ في الاستيراد: ' + e.message, 'error');
    }
}

// ==========================================
// Excel Export
// ==========================================
async function exportExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('جاري تحميل مكتبة Excel... حاول مرة أخرى', 'error');
        return;
    }
    try {
        const products = await getProducts();
        const customers = await getCustomers();
        const orders = await db.orders.toArray();
        const orderItems = await db.orderItems.toArray();
        const suppliers = await getSuppliers();
        const batches = await db.supplyBatches.toArray();
        const installments = await db.installments.toArray();
        const categories = await getCategories();

        const wb = XLSX.utils.book_new();

        // Products sheet
        const prodData = products.map(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            const sup = suppliers.find(s => s.id === p.supplierId);
            return {
                'الصنف': p.name,
                'التصنيف': cat?.name || '',
                'المورد': sup?.name || '',
                'رأس المال': p.costPrice || 0,
                'سعر البيع': p.sellPrice || 0,
                'الربح': (p.sellPrice || 0) - (p.costPrice || 0),
                'المخزون': p.stock || 0,
                'الوحدة': p.unit || 'قطعة'
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), 'الأصناف');

        // Customers sheet
        const custData = customers.map(c => {
            const cOrders = orders.filter(o => o.customerId === c.id);
            const cItems = orderItems.filter(i => cOrders.some(o => o.id === i.orderId));
            const total = cItems.reduce((s, i) => s + (i.total || 0), 0);
            const paid = cItems.filter(i => i.isPaid === 'yes').reduce((s, i) => s + (i.total || 0), 0);
            return {
                'العميل': c.name,
                'الهاتف': c.phone || '',
                'إجمالي المشتريات': total,
                'المدفوع': paid,
                'المتبقي': total - paid,
                'عدد الطلبات': cOrders.length
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custData), 'العملاء');

        // Orders sheet
        const orderData = orders.map(o => {
            const cust = customers.find(c => c.id === o.customerId);
            const items = orderItems.filter(i => i.orderId === o.id);
            const paidItems = items.filter(i => i.isPaid === 'yes').length;
            return {
                'رقم الطلب': o.id,
                'العميل': cust?.name || '',
                'التاريخ': o.date,
                'نوع الدفع': o.paymentType === 'cash' ? 'نقدي' : o.paymentType === 'installment' ? 'تقسيط' : o.paymentType === 'advance' ? 'مقدم' : 'آجل',
                'المبلغ': o.totalAmount || 0,
                'عدد الأصناف': items.length,
                'المدفوع': `${paidItems}/${items.length}`
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderData), 'الطلبات');

        // Order Items sheet
        const itemData = orderItems.map(i => {
            const order = orders.find(o => o.id === i.orderId);
            const cust = order ? customers.find(c => c.id === order.customerId) : null;
            return {
                'رقم الطلب': i.orderId,
                'العميل': cust?.name || '',
                'الصنف': i.productName || '',
                'الكمية': i.quantity || 0,
                'السعر': i.price || 0,
                'الإجمالي': i.total || 0,
                'مدفوع': i.isPaid === 'yes' ? 'نعم' : 'لا'
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemData), 'تفاصيل الطلبات');

        // Suppliers sheet
        const supData = suppliers.map(s => {
            const sBatches = batches.filter(b => b.supplierId === s.id);
            const totalClaim = sBatches.reduce((sum, b) => sum + ((b.costPrice || 0) * (b.quantity || 0)), 0);
            return {
                'المورد': s.name,
                'الهاتف': s.phone || '',
                'إجمالي المطالبة': totalClaim,
                'عدد الدفعات': sBatches.length
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supData), 'الموردين');

        // Supply Batches sheet
        const batchData = batches.map(b => ({
            'المورد': suppliers.find(s => s.id === b.supplierId)?.name || '',
            'الصنف': b.productName || '',
            'التاريخ': b.date,
            'الكمية': b.quantity || 0,
            'سعر الوحدة': b.costPrice || 0,
            'الإجمالي': (b.costPrice || 0) * (b.quantity || 0),
            'ملاحظات': b.notes || ''
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchData), 'سجل التوريدات');

        // Installments sheet
        if (installments.length > 0) {
            const instData = installments.map(i => {
                const cust = customers.find(c => c.id === i.customerId);
                return {
                    'العميل': cust?.name || '',
                    'رقم الطلب': i.orderId,
                    'المبلغ': i.amount || 0,
                    'تاريخ الاستحقاق': i.dueDate,
                    'مدفوع': i.isPaid === 'yes' ? 'نعم' : 'لا',
                    'تاريخ الدفع': i.paidDate || ''
                };
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instData), 'الأقساط');
        }

        XLSX.writeFile(wb, `tajer-report-${today()}.xlsx`);
        showToast('تم تصدير ملف Excel بنجاح ✅');
    } catch (e) {
        showToast('خطأ في تصدير Excel: ' + e.message, 'error');
    }
}

// ==========================================
// Excel Import
// ==========================================
async function importExcel(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('جاري تحميل مكتبة Excel... حاول مرة أخرى', 'error');
        return;
    }

    const confirmed = await showConfirm('سيتم إضافة البيانات من ملف Excel. هل تريد المتابعة؟');
    if (!confirmed) return;

    try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        let importedCount = 0;

        // Import Products
        const prodSheet = wb.Sheets['الأصناف'] || wb.Sheets['Products'];
        if (prodSheet) {
            const rows = XLSX.utils.sheet_to_json(prodSheet);
            const categories = await getCategories();
            const suppliers = await getSuppliers();
            for (const row of rows) {
                const name = row['الصنف'] || row['name'] || row['Name'];
                if (!name) continue;
                const catName = row['التصنيف'] || row['category'] || '';
                const supName = row['المورد'] || row['supplier'] || '';
                const cat = categories.find(c => c.name === catName);
                const sup = suppliers.find(s => s.name === supName);
                const costPrice = parseFloat(row['رأس المال'] || row['costPrice'] || 0);
                const sellPrice = parseFloat(row['سعر البيع'] || row['sellPrice'] || 0);
                const stock = parseInt(row['المخزون'] || row['stock'] || 0);
                const unit = row['الوحدة'] || row['unit'] || 'قطعة';

                const productId = await addProduct({
                    name, categoryId: cat?.id || null, supplierId: sup?.id || null,
                    costPrice, sellPrice, profitMargin: sellPrice - costPrice, stock, unit, lowStockAlert: 3
                });

                // Auto-create supply batch if supplier exists
                if (sup && stock > 0) {
                    await db.supplyBatches.add({
                        productId, supplierId: sup.id, productName: name,
                        quantity: stock, costPrice, unit,
                        date: today(), notes: 'استيراد من Excel', createdAt: now()
                    });
                }
                importedCount++;
            }
        }

        // Import Customers
        const custSheet = wb.Sheets['العملاء'] || wb.Sheets['Customers'];
        if (custSheet) {
            const rows = XLSX.utils.sheet_to_json(custSheet);
            for (const row of rows) {
                const name = row['العميل'] || row['name'] || row['Name'];
                if (!name) continue;
                await addCustomer({ name, phone: row['الهاتف'] || row['phone'] || '' });
                importedCount++;
            }
        }

        // Import Suppliers
        const supSheet = wb.Sheets['الموردين'] || wb.Sheets['Suppliers'];
        if (supSheet) {
            const rows = XLSX.utils.sheet_to_json(supSheet);
            for (const row of rows) {
                const name = row['المورد'] || row['name'] || row['Name'];
                if (!name) continue;
                await addSupplier({ name, phone: row['الهاتف'] || row['phone'] || '', notes: row['ملاحظات'] || '' });
                importedCount++;
            }
        }

        showToast(`تم استيراد ${importedCount} سجل بنجاح ✅`);
        navigateTo('Dashboard');
    } catch (e) {
        showToast('خطأ في استيراد Excel: ' + e.message, 'error');
    }
}

// ==========================================
// Owner Detection Helper
// ==========================================
function isOwner() {
    const auth = getAuthData();
    return auth && auth.role === 'owner';
}

// ==========================================
// PWA Install
// ==========================================
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    banner.classList.remove('hidden');
    // Use automatic install flow
    banner.querySelector('.install-banner-content').innerHTML = `
        <span>📲 ثبّت تطبيق تاجر على جهازك</span>
        <button id="installBtn" class="btn btn-sm btn-primary">تثبيت</button>
        <button id="dismissInstall" class="btn btn-sm btn-ghost">لاحقاً</button>
    `;
    setupInstallButtons();
});

function setupInstallButtons() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (_deferredPrompt) {
                _deferredPrompt.prompt();
                const { outcome } = await _deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('تم تثبيت التطبيق! 🎉');
                }
                _deferredPrompt = null;
                document.getElementById('installBanner').classList.add('hidden');
            }
        });
    }
    const dismissBtn = document.getElementById('dismissInstall');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            document.getElementById('installBanner').classList.add('hidden');
            localStorage.setItem('installDismissed', 'yes');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!_deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
            const dismissed = localStorage.getItem('installDismissed');
            if (dismissed) return;
            const guideHTML = '<div style="text-align:center;padding:10px 0"><div style="font-size:3rem;margin-bottom:10px">📲</div><p style="margin-bottom:20px;color:var(--text-secondary);font-size:0.85rem">لتثبيت التطبيق كأيقونة على شاشتك الرئيسية:</p><div style="text-align:right;background:var(--bg-input);border-radius:var(--radius-md);padding:16px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="background:var(--accent-primary);color:white;min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">1</span><span>اضغط على <strong>⋮</strong> (ثلاث نقاط) أعلى يمين المتصفح</span></div><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="background:var(--accent-primary);color:white;min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">2</span><span>اختر <strong>إضافة إلى الشاشة الرئيسية</strong></span></div><div style="display:flex;align-items:center;gap:10px"><span style="background:var(--accent-success);color:white;min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700">✓</span><span>ستظهر أيقونة <strong>تاجر</strong> على شاشتك ويفتح بدون متصفح!</span></div></div></div>';
            const footerHTML = '<button class="btn btn-primary btn-block" onclick="closeModal();localStorage.setItem(\'installDismissed\',\'yes\')">👍 فهمت</button>';
            openModal('تثبيت تطبيق تاجر', guideHTML, footerHTML);
        }
    }, 3000);
});


// ==========================================
// Service Worker Registration
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// ==========================================
// Initialize App
// ==========================================
async function initApp() {
    try {
        await checkAuth();
    } catch (error) {
        console.error('Error initializing app:', error);
        // Fallback: start app directly if auth fails
        try {
            document.getElementById('authOverlay').classList.add('hidden');
            document.getElementById('app').style.display = '';
            startApp();
        } catch (e2) {
            console.error('Critical error:', e2);
        }
    }
}

function showChangePasswordModal() {
    const body = `
        <div class="form-group">
            <label>كلمة المرور الحالية</label>
            <input type="password" id="currentPwd" class="input-field" placeholder="كلمة المرور الحالية" style="direction:ltr;text-align:right">
        </div>
        <div class="form-group">
            <label>كلمة المرور الجديدة</label>
            <input type="password" id="newPwd" class="input-field" placeholder="كلمة المرور الجديدة" style="direction:ltr;text-align:right">
        </div>
        <div class="form-group">
            <label>تأكيد كلمة المرور</label>
            <input type="password" id="confirmNewPwd" class="input-field" placeholder="أعد كتابة كلمة المرور" style="direction:ltr;text-align:right">
        </div>
    `;
    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="changePassword()">💾 حفظ</button>
    `;
    openModal('🔐 تغيير كلمة المرور', body, footer);
}

async function changePassword() {
    const auth = getAuthData();
    const current = document.getElementById('currentPwd').value;
    const newPwd = document.getElementById('newPwd').value;
    const confirm = document.getElementById('confirmNewPwd').value;

    if (hashPassword(current) !== auth.passwordHash) {
        showToast('كلمة المرور الحالية غير صحيحة', 'error');
        return;
    }
    if (newPwd.length < 4) {
        showToast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error');
        return;
    }
    if (newPwd !== confirm) {
        showToast('كلمتا المرور غير متطابقتين', 'error');
        return;
    }

    auth.passwordHash = hashPassword(newPwd);
    saveAuthData(auth);
    showToast('تم تغيير كلمة المرور بنجاح ✅');
    closeModal();
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);

// Handle back button on mobile
window.addEventListener('popstate', (e) => {
    e.preventDefault();
    goBack();
});

// Prevent leaving the app accidentally
window.history.pushState({}, '');
window.addEventListener('popstate', () => {
    window.history.pushState({}, '');
    goBack();
});

// ==========================================
// User Manual
// ==========================================
function showUserManual() {
    const body = `
        <div style="max-height:65vh;overflow-y:auto;padding:4px;font-size:0.82rem;line-height:1.7">
            <div style="background:var(--accent-danger-bg);border:1px solid var(--accent-danger);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:14px">
                <strong>⚠️ تنبيه هام:</strong><br>
                لا تقم بمسح بيانات المتصفح أو التطبيق (Clear Data). سيؤدي ذلك لحذف جميع بياناتك نهائياً!<br>
                قم دائماً بعمل نسخة احتياطية من الإعدادات ← تصدير JSON.
            </div>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">📱 تثبيت التطبيق</h4>
            <p>افتح الرابط في Chrome ← اضغط قائمة ⋮ ← "إضافة إلى الشاشة الرئيسية"</p>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">🔑 التفعيل</h4>
            <p>عند فتح التطبيق أول مرة، أدخل مفتاح التفعيل من المالك. المفتاح يُستخدم لمرة واحدة فقط.</p>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">📦 الأصناف</h4>
            <ul style="padding-right:16px">
                <li>اضغط + لإضافة صنف جديد</li>
                <li>اضغط على الصنف لتعديل الكمية أو البيانات أو حذفه</li>
                <li><strong>الكلي</strong> = الكمية الأصلية | <strong>مباع</strong> = الكمية المطلوبة | <strong>المتبقي</strong> = المخزون الحالي</li>
                <li>ابحث بالاسم أو التصنيف أو المورد أو "نفد" أو "منخفض"</li>
            </ul>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">👥 العملاء</h4>
            <ul style="padding-right:16px">
                <li>اضغط + لإضافة عميل</li>
                <li>اضغط على العميل لعرض التفاصيل وإنشاء طلب</li>
                <li>الألوان: 🟢 خالص | 🔴 مطالب | 🔵 جديد</li>
                <li>ابحث بالاسم أو الهاتف أو المنتج أو "مدفوع" أو "مطالب" أو "نقدي" أو "تقسيط"</li>
            </ul>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">🛒 إنشاء طلب</h4>
            <ul style="padding-right:16px">
                <li>من صفحة العميل ← اضغط + ← اختر الأصناف</li>
                <li>الافتراضي: <strong>آجل (غير مدفوع)</strong></li>
                <li>أنواع الدفع: آجل | نقدي | مقدم | تقسيط</li>
                <li>نقدي = تُسجل كل الأصناف مدفوعة تلقائياً</li>
            </ul>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">🔍 البحث الذكي</h4>
            <p>اكتب أي جزء من كلمة (حرفين فأكثر) في مربع البحث وسيُصفي النتائج فوراً. يبحث في كل الحقول المرئية.</p>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">📊 التقارير</h4>
            <p>اختر الفترة: اليوم | الأسبوع | الشهر | ربع سنة | سنة | الكل</p>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">💾 النسخ الاحتياطي</h4>
            <ul style="padding-right:16px">
                <li><strong>تصدير</strong>: الإعدادات ← تصدير JSON ← يُحفظ ملف على هاتفك</li>
                <li><strong>استيراد</strong>: الإعدادات ← استيراد JSON ← اختر ملف النسخة</li>
                <li>⚠️ الاستيراد يستبدل جميع البيانات الحالية</li>
            </ul>

            <h4 style="color:var(--accent-info);margin:10px 0 6px">🔐 الأمان</h4>
            <ul style="padding-right:16px">
                <li>كلمة المرور مطلوبة عند كل فتح</li>
                <li>نسيت كلمة المرور؟ أجب على أسئلة الأمان</li>
                <li>يمكن تغيير كلمة المرور من الإعدادات</li>
            </ul>
        </div>
    `;
    openModal('📖 دليل المستخدم', body, '<button class="btn btn-primary btn-block" onclick="closeModal()">فهمت ✅</button>');
}
