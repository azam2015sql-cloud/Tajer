// ==========================================
// Authentication & Activation System v3
// Firebase Centralized
// ==========================================

const AUTH_KEY = 'tajer_auth';
const MASTER_PASSWORD = 'Azzam@2025#';
const OWNER_EMAIL = 'azam2015sql@gmail.com';
const OWNER_WHATSAPP = '+249917454900';
const APP_URL = 'https://tajer-sales-app.surge.sh';

const SECURITY_QUESTIONS = [
    'ما هو اسم أفضل صديق لك في الطفولة؟',
    'ما هو اسم مدرستك الابتدائية؟',
    'في أي مدينة ولدت؟',
    'ما هو الطعام المفضل لديك؟',
    'ما هو اسم والدتك؟'
];

const VALIDITY_OPTIONS = [
    { days: 30, label: '30 يوم (شهر)' },
    { days: 90, label: '90 يوم (3 أشهر)' },
    { days: 180, label: '180 يوم (6 أشهر)' },
    { days: 365, label: 'سنة كاملة' },
    { days: 0, label: 'بدون انتهاء ♾️' }
];

// ==========================================
// Auth Data (local)
// ==========================================
function getAuthData() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function saveAuthData(d) { localStorage.setItem(AUTH_KEY, JSON.stringify(d)); }

function hashPassword(password) {
    let h1 = 0, h2 = 5381;
    const s = password + 'TajerSalt2026';
    for (let i = 0; i < s.length; i++) {
        h1 = ((h1 << 5) - h1) + s.charCodeAt(i); h1 = h1 & h1;
        h2 = ((h2 << 5) + h2) + s.charCodeAt(i);
    }
    return h1.toString(36) + '-' + h2.toString(36);
}

// ==========================================
// QR Code
// ==========================================
function generateQRCode(text, size) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=0f172a&color=a5b4fc&format=svg`;
}

// ==========================================
// Full-Screen Auth UI
// ==========================================
function showAuthOverlay(html) {
    const el = document.getElementById('authOverlay');
    el.innerHTML = html;
    el.classList.remove('hidden');
    document.getElementById('app').style.display = 'none';
}

function hideAuthOverlay() {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('app').style.display = '';
}

// ==========================================
// Country/City/Currency Data
// ==========================================
const COUNTRY_DATA = {
    'السودان': { currency: 'جنيه سوداني', currencyCode: 'SDG', phoneCode: '+249', cities: ['الخرطوم', 'أم درمان', 'بحري', 'بورتسودان', 'كسلا', 'الأبيض', 'ود مدني', 'عطبرة', 'نيالا', 'الفاشر', 'القضارف', 'كوستي', 'دنقلا'] },
    'مصر': { currency: 'جنيه مصري', currencyCode: 'EGP', phoneCode: '+20', cities: ['القاهرة', 'الإسكندرية', 'الجيزة', 'شبرا الخيمة', 'بورسعيد', 'السويس', 'الأقصر', 'أسوان', 'المنصورة', 'طنطا'] },
    'السعودية': { currency: 'ريال سعودي', currencyCode: 'SAR', phoneCode: '+966', cities: ['الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أبها'] },
    'الإمارات': { currency: 'درهم إماراتي', currencyCode: 'AED', phoneCode: '+971', cities: ['دبي', 'أبو ظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'العين'] },
    'العراق': { currency: 'دينار عراقي', currencyCode: 'IQD', phoneCode: '+964', cities: ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'النجف', 'كربلاء', 'السليمانية'] },
    'الأردن': { currency: 'دينار أردني', currencyCode: 'JOD', phoneCode: '+962', cities: ['عمّان', 'إربد', 'الزرقاء', 'العقبة', 'مأدبا', 'جرش'] },
    'الكويت': { currency: 'دينار كويتي', currencyCode: 'KWD', phoneCode: '+965', cities: ['مدينة الكويت', 'حولي', 'الفروانية', 'الأحمدي', 'الجهراء'] },
    'قطر': { currency: 'ريال قطري', currencyCode: 'QAR', phoneCode: '+974', cities: ['الدوحة', 'الريان', 'الوكرة', 'أم صلال'] },
    'البحرين': { currency: 'دينار بحريني', currencyCode: 'BHD', phoneCode: '+973', cities: ['المنامة', 'المحرق', 'الرفاع', 'مدينة حمد'] },
    'عُمان': { currency: 'ريال عماني', currencyCode: 'OMR', phoneCode: '+968', cities: ['مسقط', 'صلالة', 'صحار', 'نزوى', 'صور'] },
    'اليمن': { currency: 'ريال يمني', currencyCode: 'YER', phoneCode: '+967', cities: ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب'] },
    'ليبيا': { currency: 'دينار ليبي', currencyCode: 'LYD', phoneCode: '+218', cities: ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'البيضاء'] },
    'تونس': { currency: 'دينار تونسي', currencyCode: 'TND', phoneCode: '+216', cities: ['تونس', 'صفاقس', 'سوسة', 'القيروان', 'بنزرت'] },
    'الجزائر': { currency: 'دينار جزائري', currencyCode: 'DZD', phoneCode: '+213', cities: ['الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'باتنة'] },
    'المغرب': { currency: 'درهم مغربي', currencyCode: 'MAD', phoneCode: '+212', cities: ['الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'طنجة', 'أغادير'] },
    'موريتانيا': { currency: 'أوقية', currencyCode: 'MRU', phoneCode: '+222', cities: ['نواكشوط', 'نواذيبو'] },
    'الصومال': { currency: 'شلن صومالي', currencyCode: 'SOS', phoneCode: '+252', cities: ['مقديشو', 'هرجيسا', 'كيسمايو'] },
    'جيبوتي': { currency: 'فرنك جيبوتي', currencyCode: 'DJF', phoneCode: '+253', cities: ['جيبوتي'] },
    'فلسطين': { currency: 'شيكل', currencyCode: 'ILS', phoneCode: '+970', cities: ['القدس', 'غزة', 'رام الله', 'نابلس', 'الخليل', 'بيت لحم'] },
    'لبنان': { currency: 'ليرة لبنانية', currencyCode: 'LBP', phoneCode: '+961', cities: ['بيروت', 'طرابلس', 'صيدا', 'جبيل'] },
    'سوريا': { currency: 'ليرة سورية', currencyCode: 'SYP', phoneCode: '+963', cities: ['دمشق', 'حلب', 'حمص', 'اللاذقية', 'حماة'] }
};

// ==========================================
// Activation Screen (First Time)
// ==========================================
function showActivationScreen() {
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-owner-menu">
                    <button class="auth-dots-btn" onclick="document.getElementById('ownerDropdown').classList.toggle('hidden')">⋮</button>
                    <div id="ownerDropdown" class="auth-dropdown hidden">
                        <button onclick="showOwnerSetup()">👑 دخول كمالك</button>
                    </div>
                </div>

                <div class="auth-hero">
                    <div class="auth-logo-icon">🏪</div>
                    <h1 class="auth-app-name">تاجر</h1>
                    <p class="auth-tagline">نظام إدارة المبيعات المتكامل</p>
                </div>

                <div class="auth-card">
                    <h3 style="text-align:center;margin-bottom:12px;font-size:1rem">تسجيل حساب جديد</h3>

                    <!-- Google Sign-In -->
                    <button class="btn btn-block" style="background:#fff;color:#333;border:1px solid #ddd;padding:12px;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;border-radius:8px" onclick="handleGoogleSignIn()">
                        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                        التسجيل بحساب Google
                    </button>

                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                        <div style="flex:1;height:1px;background:#334155"></div>
                        <span style="font-size:0.72rem;color:#64748b">أو</span>
                        <div style="flex:1;height:1px;background:#334155"></div>
                    </div>

                    <!-- Activation Key -->
                    <p class="text-muted" style="text-align:center;font-size:0.78rem;margin-bottom:10px">أدخل مفتاح التفعيل للبدء</p>
                    <div class="form-group">
                        <input type="text" id="activationKey" class="input-field auth-key-input" placeholder="XXXX-XXXX-XXXX" maxlength="14" oninput="formatKeyInput(this)">
                    </div>
                    <div id="keyError" class="auth-error hidden"></div>
                    <button id="activateBtn" class="btn btn-primary btn-block auth-btn-glow" onclick="verifyActivationKey('new')">🔓 تفعيل</button>
                </div>

                <div class="auth-contact-card">
                    <p style="font-size:0.82rem;margin-bottom:8px">للحصول على مفتاح التفعيل تواصل مع المالك:</p>
                    <a href="https://wa.me/${OWNER_WHATSAPP.replace('+', '')}" target="_blank" class="auth-whatsapp-btn">
                        <span>📱</span> تواصل عبر واتساب
                    </a>
                </div>

                <div class="auth-qr-section">
                    <p style="font-size:0.75rem;color:#64748b;margin-bottom:8px">شارك التطبيق:</p>
                    <img src="${generateQRCode(APP_URL, 120)}" alt="QR Code" class="auth-qr-img" onerror="this.style.display='none'">
                    <p style="font-size:0.68rem;color:#475569;margin-top:4px">${APP_URL}</p>
                </div>

                <p class="auth-footer">تطبيق تاجر v2.0 | تطوير: عزام سليمان</p>
            </div>
        </div>
    `);
}

// Handle Google Sign-In flow
async function handleGoogleSignIn() {
    try {
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ جاري الاتصال بحساب Google...';
        btn.disabled = true;

        const result = await signInWithGoogle();

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (!result.success) {
            showToast(result.error, 'error');
            alert('فشل تسجيل الدخول: ' + result.error);
            return;
        }
        // Show country/city selection after Google sign-in
        showCountrySetup(result.email, result.displayName);
    } catch (e) {
        showToast(e.message || 'حدث خطأ غير متوقع', 'error');
        alert('خطأ غير متوقع: ' + (e.message || e));
    }
}

// Country/City selection step
function showCountrySetup(email, displayName) {
    const countriesList = Object.keys(COUNTRY_DATA).map(c =>
        `<option value="${c}">${c}</option>`
    ).join('');

    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero">
                    <div class="auth-logo-icon">🌍</div>
                    <h1 class="auth-app-name">مرحباً ${displayName || ''}</h1>
                    <p class="auth-tagline">${email}</p>
                </div>

                <div class="auth-card">
                    <h3 style="text-align:center;margin-bottom:14px;font-size:1rem">تحديد موقع المتجر</h3>

                    <div class="form-group">
                        <label style="font-size:0.78rem;margin-bottom:4px;display:block">🌍 الدولة</label>
                        <select id="regCountry" class="input-field" onchange="updateCitiesList()">
                            <option value="">اختر الدولة...</option>
                            ${countriesList}
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="font-size:0.78rem;margin-bottom:4px;display:block">🏙️ المدينة</label>
                        <select id="regCity" class="input-field">
                            <option value="">اختر الدولة أولاً...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="font-size:0.78rem;margin-bottom:4px;display:block">📞 رقم هاتف المتجر</label>
                        <input type="tel" id="regStorePhone" class="input-field" placeholder="0912345678" style="direction:ltr">
                    </div>

                    <div id="regCurrencyInfo" style="background:var(--accent-info-bg);padding:8px 12px;border-radius:8px;text-align:center;font-size:0.78rem;color:var(--accent-info);margin-bottom:12px;display:none">
                        💰 العملة: <strong id="regCurrencyName"></strong>
                    </div>

                    <div id="regError" class="auth-error hidden"></div>
                    <button class="btn btn-primary btn-block auth-btn-glow" onclick="submitCountrySetup('${email}')">التالي ← مفتاح التفعيل</button>
                </div>
            </div>
        </div>
    `);
}

function updateCitiesList() {
    const country = document.getElementById('regCountry').value;
    const citySelect = document.getElementById('regCity');
    const currInfo = document.getElementById('regCurrencyInfo');

    if (!country || !COUNTRY_DATA[country]) {
        citySelect.innerHTML = '<option value="">اختر الدولة أولاً...</option>';
        currInfo.style.display = 'none';
        return;
    }

    const data = COUNTRY_DATA[country];
    citySelect.innerHTML = '<option value="">اختر المدينة...</option>' +
        data.cities.map(c => `<option value="${c}">${c}</option>`).join('');

    // Show currency
    document.getElementById('regCurrencyName').textContent = data.currency;
    currInfo.style.display = '';
}

async function submitCountrySetup(email) {
    const country = document.getElementById('regCountry').value;
    const city = document.getElementById('regCity').value;
    const phone = document.getElementById('regStorePhone').value.trim();
    const errEl = document.getElementById('regError');

    if (!country) {
        errEl.textContent = 'اختر الدولة';
        errEl.classList.remove('hidden');
        return;
    }
    if (!city) {
        errEl.textContent = 'اختر المدينة';
        errEl.classList.remove('hidden');
        return;
    }

    // Save country/city/currency to local settings
    const currency = COUNTRY_DATA[country]?.currency || 'جنيه';
    window._pendingRegistration = { country, city, phone, currency, email };

    // Now show activation key screen
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero">
                    <div class="auth-logo-icon">🔑</div>
                    <h1 class="auth-app-name">تفعيل التطبيق</h1>
                    <p class="auth-tagline">${country} - ${city}</p>
                </div>

                <div class="auth-card">
                    <h3 style="text-align:center;margin-bottom:6px;font-size:1rem">أدخل مفتاح التفعيل</h3>
                    <p class="text-muted" style="text-align:center;font-size:0.78rem;margin-bottom:16px">تواصل مع المالك للحصول على المفتاح</p>

                    <div class="form-group">
                        <input type="text" id="activationKey" class="input-field auth-key-input" placeholder="XXXX-XXXX-XXXX" maxlength="14" oninput="formatKeyInput(this)">
                    </div>
                    <div id="keyError" class="auth-error hidden"></div>
                    <button id="activateBtn" class="btn btn-primary btn-block auth-btn-glow" onclick="verifyActivationKey('new')">🔓 تفعيل</button>
                </div>

                <div class="auth-contact-card">
                    <a href="https://wa.me/${OWNER_WHATSAPP.replace('+', '')}" target="_blank" class="auth-whatsapp-btn">
                        <span>📱</span> تواصل مع المالك عبر واتساب
                    </a>
                </div>
            </div>
        </div>
    `);
}

// Renewal screen (when license expired)
function showRenewalScreen(reason) {
    let msg = '';
    switch (reason) {
        case 'expired': msg = '⏰ انتهت صلاحية الترخيص'; break;
        case 'revoked': msg = '🚫 تم إلغاء الترخيص من المالك'; break;
        case 'offline_expired': msg = '📡 يرجى الاتصال بالإنترنت للتحقق من الترخيص'; break;
        default: msg = 'يرجى تجديد الترخيص';
    }

    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero">
                    <div class="auth-logo-icon">⏳</div>
                    <h1 class="auth-app-name">تاجر</h1>
                    <p class="auth-tagline">${msg}</p>
                </div>
                
                <div class="auth-card">
                    <h3 style="text-align:center;margin-bottom:6px;font-size:1rem">تجديد الترخيص</h3>
                    <p class="text-muted" style="text-align:center;font-size:0.78rem;margin-bottom:16px">أدخل مفتاح التجديد</p>
                    
                    <div class="form-group">
                        <input type="text" id="activationKey" class="input-field auth-key-input" placeholder="XXXX-XXXX-XXXX" maxlength="14" oninput="formatKeyInput(this)">
                    </div>
                    <div id="keyError" class="auth-error hidden"></div>
                    <button id="activateBtn" class="btn btn-primary btn-block auth-btn-glow" onclick="verifyActivationKey('renewal')">🔄 تجديد</button>
                </div>

                <div class="auth-contact-card">
                    <p style="font-size:0.82rem;margin-bottom:8px">للحصول على مفتاح التجديد:</p>
                    <a href="https://wa.me/${OWNER_WHATSAPP.replace('+', '')}" target="_blank" class="auth-whatsapp-btn">
                        <span>📱</span> تواصل عبر واتساب
                    </a>
                </div>
                <p class="auth-footer">تطبيق تاجر v2.0</p>
            </div>
        </div>
    `);
}

function formatKeyInput(el) {
    let v = el.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (v.length > 4) v = v.substring(0, 4) + '-' + v.substring(4);
    if (v.length > 9) v = v.substring(0, 9) + '-' + v.substring(9);
    if (v.length > 14) v = v.substring(0, 14);
    el.value = v;
}

// ==========================================
// Owner Setup
// ==========================================
function showOwnerSetup() {
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:20px">
                    <div class="auth-logo-icon">👑</div>
                    <h2 class="auth-app-name" style="font-size:1.4rem">تحقق المالك</h2>
                    <p class="auth-tagline">أدخل كلمة السر الرئيسية</p>
                </div>
                <div class="auth-card">
                    <div class="form-group">
                        <label>كلمة السر الرئيسية</label>
                        <input type="password" id="masterPassword" class="input-field" placeholder="أدخل كلمة السر" style="direction:ltr;text-align:right" onkeydown="if(event.key==='Enter')verifyMasterPassword()">
                    </div>
                    <div id="masterError" class="auth-error hidden">كلمة السر غير صحيحة</div>
                    <button class="btn btn-primary btn-block" onclick="verifyMasterPassword()">تحقق</button>
                    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="showActivationScreen()">رجوع</button>
                </div>
            </div>
        </div>
    `);
}

function verifyMasterPassword() {
    if (document.getElementById('masterPassword').value === MASTER_PASSWORD) {
        showOwnerEmailStep();
    } else {
        document.getElementById('masterError').classList.remove('hidden');
    }
}

function showOwnerEmailStep() {
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:20px">
                    <div class="auth-logo-icon">📧</div>
                    <h2 class="auth-app-name" style="font-size:1.4rem">تحقق البريد الإلكتروني</h2>
                </div>
                <div class="auth-card">
                    <div class="form-group">
                        <label>البريد الإلكتروني للمالك</label>
                        <input type="email" id="ownerEmail" class="input-field" placeholder="example@email.com" style="direction:ltr;text-align:right" onkeydown="if(event.key==='Enter')verifyOwnerEmail()">
                    </div>
                    <div id="emailError" class="auth-error hidden"></div>
                    <button class="btn btn-primary btn-block" onclick="verifyOwnerEmail()">تأكيد</button>
                    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="showOwnerSetup()">رجوع</button>
                </div>
            </div>
        </div>
    `);
}

function verifyOwnerEmail() {
    if (document.getElementById('ownerEmail').value.trim().toLowerCase() === OWNER_EMAIL) {
        showSetPasswordScreen('owner');
    } else {
        document.getElementById('emailError').textContent = 'البريد غير مطابق';
        document.getElementById('emailError').classList.remove('hidden');
    }
}

// ==========================================
// User Activation (Firebase)
// ==========================================
async function verifyActivationKey(expectedType) {
    const key = document.getElementById('activationKey').value.trim().toUpperCase();
    const errEl = document.getElementById('keyError');
    const btn = document.getElementById('activateBtn');

    if (!key || key.length < 14) {
        errEl.textContent = 'يرجى إدخال المفتاح كاملاً';
        errEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ جاري التحقق...';
    errEl.classList.add('hidden');

    try {
        const result = await fbValidateKey(key, expectedType);

        if (!result.valid) {
            errEl.textContent = '✘ ' + result.error;
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = expectedType === 'new' ? '🔓 تفعيل' : '🔄 تجديد';
            return;
        }

        window._pendingActivationKey = key;
        window._pendingKeyType = expectedType;

        if (expectedType === 'new') {
            showSetPasswordScreen('user');
        } else {
            // Renewal: just activate with new key, keep existing password
            const deviceId = getDeviceId();
            const activated = await fbActivateKey(key, deviceId);
            if (activated) {
                showToast('✅ تم تجديد الترخيص بنجاح');
                hideAuthOverlay();
                startApp();
            } else {
                errEl.textContent = 'حدث خطأ في التجديد';
                errEl.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = '🔄 تجديد';
        }
    } catch (err) {
        console.error('Key validation error:', err);
        errEl.textContent = '📡 تعذر الاتصال بالخادم. تحقق من الإنترنت';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = expectedType === 'new' ? '🔓 تفعيل' : '🔄 تجديد';
    }
}

// ==========================================
// Set Password
// ==========================================
function showSetPasswordScreen(role) {
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:20px">
                    <div class="auth-logo-icon">${role === 'owner' ? '👑' : '🔐'}</div>
                    <h2 class="auth-app-name" style="font-size:1.4rem">إنشاء كلمة المرور</h2>
                </div>
                <div class="auth-card">
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="newPassword" class="input-field" placeholder="4 أحرف على الأقل" style="direction:ltr;text-align:right">
                    </div>
                    <div class="form-group">
                        <label>تأكيد كلمة المرور</label>
                        <input type="password" id="confirmPassword" class="input-field" placeholder="أعد كتابة كلمة المرور" style="direction:ltr;text-align:right">
                    </div>
                    <div id="pwdError" class="auth-error hidden"></div>
                    <button class="btn btn-primary btn-block" onclick="setPassword('${role}')">التالي ← أسئلة الأمان</button>
                </div>
            </div>
        </div>
    `);
}

function setPassword(role) {
    const pwd = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (pwd.length < 4) { document.getElementById('pwdError').textContent = 'كلمة المرور 4 أحرف على الأقل'; document.getElementById('pwdError').classList.remove('hidden'); return; }
    if (pwd !== confirm) { document.getElementById('pwdError').textContent = 'كلمتا المرور غير متطابقتين'; document.getElementById('pwdError').classList.remove('hidden'); return; }
    window._pendingPassword = pwd;
    showSecurityQuestionsSetup(role);
}

// ==========================================
// Security Questions
// ==========================================
function showSecurityQuestionsSetup(role) {
    const qHtml = SECURITY_QUESTIONS.map((q, i) => `
        <div class="form-group">
            <label>${i + 1}. ${q}</label>
            <input type="text" id="secQ${i}" class="input-field" placeholder="إجابتك">
        </div>
    `).join('');

    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:16px">
                    <div class="auth-logo-icon">🛡️</div>
                    <h2 class="auth-app-name" style="font-size:1.3rem">أسئلة الأمان</h2>
                    <p class="auth-tagline">أجب على جميع الأسئلة لاسترداد كلمة المرور</p>
                </div>
                <div class="auth-card" style="max-height:60vh;overflow-y:auto">
                    ${qHtml}
                    <div id="secError" class="auth-error hidden">يرجى الإجابة على جميع الأسئلة</div>
                    <button class="btn btn-primary btn-block" onclick="saveSecurityAnswers('${role}')">✅ حفظ وبدء الاستخدام</button>
                </div>
            </div>
        </div>
    `);
}

async function saveSecurityAnswers(role) {
    const answers = [];
    for (let i = 0; i < SECURITY_QUESTIONS.length; i++) {
        const ans = document.getElementById(`secQ${i}`).value.trim();
        if (!ans) { document.getElementById('secError').classList.remove('hidden'); return; }
        answers.push({ question: SECURITY_QUESTIONS[i], answerHash: hashPassword(ans.toLowerCase()) });
    }

    // Save auth locally
    const authData = {
        role,
        passwordHash: hashPassword(window._pendingPassword),
        securityQuestions: answers,
        isSetupComplete: true,
        createdAt: new Date().toISOString()
    };
    saveAuthData(authData);

    // For user role: activate key on Firebase
    if (role === 'user' && window._pendingActivationKey) {
        try {
            const deviceId = getDeviceId();
            await fbActivateKey(window._pendingActivationKey, deviceId);
        } catch (err) {
            console.error('Firebase activation error:', err);
        }
    }

    // Save country/city/currency/phone from Google registration
    if (window._pendingRegistration) {
        const reg = window._pendingRegistration;
        try {
            const settings = await db.settings.toCollection().first();
            if (settings) {
                await db.settings.update(settings.id, {
                    country: reg.country || '',
                    city: reg.city || '',
                    currency: reg.currency || settings.currency,
                    storePhone: reg.phone || ''
                });
                window._settings = await db.settings.toCollection().first();
            }
        } catch (e) { console.error('Save reg data:', e); }
        delete window._pendingRegistration;
    }

    delete window._pendingPassword;
    delete window._pendingActivationKey;
    delete window._pendingKeyType;

    hideAuthOverlay();
    startApp();
}

// ==========================================
// Login Screen
// ==========================================
function showLoginScreen() {
    const auth = getAuthData();
    const roleLabel = auth.role === 'owner' ? '👑 المالك' : '👤 المستخدم';

    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero">
                    <div class="auth-logo-icon">🔒</div>
                    <h1 class="auth-app-name">تاجر</h1>
                    <p class="auth-tagline">${roleLabel}</p>
                </div>
                <div class="auth-card">
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" id="loginPassword" class="input-field" placeholder="أدخل كلمة المرور" style="direction:ltr;text-align:right" onkeydown="if(event.key==='Enter')loginAttempt()">
                    </div>
                    <div id="loginError" class="auth-error hidden">كلمة المرور غير صحيحة</div>
                    <button class="btn btn-primary btn-block auth-btn-glow" onclick="loginAttempt()">🔓 دخول</button>
                    <button class="btn btn-ghost btn-block" style="margin-top:8px;font-size:0.8rem" onclick="showForgotPassword()">نسيت كلمة المرور؟</button>
                </div>
                <p class="auth-footer">تطبيق تاجر v2.0</p>
            </div>
        </div>
    `);
    setTimeout(() => document.getElementById('loginPassword')?.focus(), 100);
}

async function loginAttempt() {
    const auth = getAuthData();
    if (hashPassword(document.getElementById('loginPassword').value) !== auth.passwordHash) {
        document.getElementById('loginError').classList.remove('hidden');
        return;
    }

    // For users: verify license with Firebase
    if (auth.role === 'user') {
        try {
            const result = await fbVerifyLicense(getDeviceId());
            if (!result.valid) {
                showRenewalScreen(result.reason);
                return;
            }
        } catch (err) {
            // Offline: try local cache
            const offlineResult = fbVerifyLicenseOffline();
            if (!offlineResult.valid) {
                showRenewalScreen(offlineResult.reason);
                return;
            }
        }
    }

    hideAuthOverlay();
    startApp();
}

// ==========================================
// Forgot Password
// ==========================================
function showForgotPassword() {
    const auth = getAuthData();
    if (!auth?.securityQuestions) return;
    const qHtml = auth.securityQuestions.map((sq, i) => `
        <div class="form-group">
            <label>${i + 1}. ${sq.question}</label>
            <input type="text" id="recQ${i}" class="input-field" placeholder="إجابتك">
        </div>
    `).join('');

    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:16px">
                    <div class="auth-logo-icon">🔑</div>
                    <h2 class="auth-app-name" style="font-size:1.3rem">استرداد كلمة المرور</h2>
                </div>
                <div class="auth-card" style="max-height:60vh;overflow-y:auto">
                    ${qHtml}
                    <div id="recError" class="auth-error hidden">جميع الإجابات غير صحيحة</div>
                    <button class="btn btn-primary btn-block" onclick="verifyRecovery()">تحقق</button>
                    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="showLoginScreen()">رجوع</button>
                </div>
            </div>
        </div>
    `);
}

function verifyRecovery() {
    const auth = getAuthData();
    for (let i = 0; i < auth.securityQuestions.length; i++) {
        const ans = document.getElementById(`recQ${i}`).value.trim().toLowerCase();
        if (ans && hashPassword(ans) === auth.securityQuestions[i].answerHash) {
            showResetPasswordScreen(); return;
        }
    }
    document.getElementById('recError').classList.remove('hidden');
}

function showResetPasswordScreen() {
    showAuthOverlay(`
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-hero" style="margin-bottom:20px">
                    <div class="auth-logo-icon">🔐</div>
                    <h2 class="auth-app-name" style="font-size:1.3rem">إعادة تعيين كلمة المرور</h2>
                </div>
                <div class="auth-card">
                    <div class="form-group">
                        <label>كلمة المرور الجديدة</label>
                        <input type="password" id="resetPwd" class="input-field" style="direction:ltr;text-align:right">
                    </div>
                    <div class="form-group">
                        <label>تأكيد كلمة المرور</label>
                        <input type="password" id="resetPwdConfirm" class="input-field" style="direction:ltr;text-align:right">
                    </div>
                    <div id="resetError" class="auth-error hidden"></div>
                    <button class="btn btn-primary btn-block" onclick="resetPassword()">✅ حفظ</button>
                </div>
            </div>
        </div>
    `);
}

function resetPassword() {
    const pwd = document.getElementById('resetPwd').value;
    const confirm = document.getElementById('resetPwdConfirm').value;
    if (pwd.length < 4) { document.getElementById('resetError').textContent = '4 أحرف على الأقل'; document.getElementById('resetError').classList.remove('hidden'); return; }
    if (pwd !== confirm) { document.getElementById('resetError').textContent = 'غير متطابقتين'; document.getElementById('resetError').classList.remove('hidden'); return; }
    const auth = getAuthData();
    auth.passwordHash = hashPassword(pwd);
    saveAuthData(auth);
    showLoginScreen();
}

// ==========================================
// Owner Key Management (Firebase)
// ==========================================
async function showKeyManagement() {
    const auth = getAuthData();
    if (!auth || auth.role !== 'owner') { showToast('متاحة للمالك فقط', 'error'); return; }

    openModal('🔑 إدارة المفاتيح', '<div style="text-align:center;padding:20px"><span class="text-muted">⏳ جاري التحميل...</span></div>', '');

    try {
        const keys = await fbGetAllKeys();
        const licenses = await fbGetAllLicenses();

        const activeKeys = keys.filter(k => k.status === 'active');
        const usedKeys = keys.filter(k => k.status === 'used');
        const revokedKeys = keys.filter(k => k.status === 'revoked');

        const body = `
            <div style="text-align:center;padding:12px 0">
                <p class="text-muted" style="font-size:0.75rem;margin-bottom:4px">
                    🟢 نشط: ${activeKeys.length} | 🔵 مستخدم: ${usedKeys.length} | 🔴 ملغي: ${revokedKeys.length}
                </p>
            </div>

            <!-- Create Key Section -->
            <div style="background:var(--bg-input);border-radius:var(--radius-md);padding:12px;margin-bottom:12px">
                <div style="display:flex;gap:8px;margin-bottom:8px">
                    <select id="newKeyType" class="input-field" style="flex:1">
                        <option value="new">🆕 مفتاح جديد</option>
                        <option value="renewal">🔄 مفتاح تجديد</option>
                    </select>
                    <select id="newKeyValidity" class="input-field" style="flex:1">
                        ${VALIDITY_OPTIONS.map(v => `<option value="${v.days}">${v.label}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary btn-block" onclick="generateNewKeyFB()">➕ إنشاء مفتاح</button>
            </div>

            <div id="generatedKeyDisplay" class="hidden" style="margin:12px 0;padding:14px;background:var(--accent-success-bg);border:1px solid var(--accent-success);border-radius:var(--radius-md);text-align:center">
                <span class="text-muted" style="font-size:0.78rem">المفتاح الجديد:</span><br>
                <span id="newKeyValue" style="font-size:1.3rem;font-weight:800;letter-spacing:3px;color:var(--accent-success);direction:ltr"></span>
                <br><button class="btn btn-sm btn-outline" style="margin-top:6px" onclick="copyKey()">📋 نسخ</button>
            </div>

            <!-- Keys List -->
            <h4 style="margin:10px 0 6px;font-size:0.85rem">المفاتيح (${keys.length})</h4>
            <div style="max-height:250px;overflow-y:auto">
                ${keys.length === 0 ? '<p class="text-muted" style="text-align:center;padding:12px">لا توجد مفاتيح</p>' :
                [...keys].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(k => {
                    const typeLabel = k.type === 'new' ? '🆕' : '🔄';
                    const statusColor = k.status === 'active' ? 'var(--accent-success)' :
                        k.status === 'used' ? 'var(--accent-info)' : 'var(--accent-danger)';
                    const statusLabel = k.status === 'active' ? 'نشط' :
                        k.status === 'used' ? 'مستخدم' : 'ملغي';
                    const validityLabel = k.validityDays === 0 ? '♾️' : k.validityDays + ' يوم';
                    const dateStr = k.createdAt ? new Date(k.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '';

                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:4px;font-size:0.78rem;border-right:3px solid ${statusColor}">
                        <div style="flex:1">
                            <div style="direction:ltr;font-weight:700;${k.status !== 'active' ? 'text-decoration:line-through;opacity:0.5' : ''}">${typeLabel} ${k.key}</div>
                            <div class="text-muted" style="font-size:0.65rem">${dateStr} • ${validityLabel}</div>
                        </div>
                        <div style="display:flex;gap:4px;align-items:center">
                            <span class="badge" style="background:${statusColor};color:white;font-size:0.65rem">${statusLabel}</span>
                            ${k.status === 'active' || k.status === 'used' ? `<button class="btn btn-sm" style="background:var(--accent-danger);color:white;font-size:0.6rem;padding:2px 6px" onclick="revokeKeyFB('${k.key}')">إلغاء</button>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Active Licenses -->
            ${licenses.length > 0 ? `
                <h4 style="margin:14px 0 6px;font-size:0.85rem">📋 التراخيص النشطة (${licenses.filter(l => l.status === 'active').length}/${licenses.length})</h4>
                <div style="max-height:150px;overflow-y:auto">
                    ${licenses.map(l => {
                    const lStatusColor = l.status === 'active' ? 'var(--accent-success)' :
                        l.status === 'expired' ? 'var(--accent-warning)' : 'var(--accent-danger)';
                    const lStatusLabel = l.status === 'active' ? 'نشط' :
                        l.status === 'expired' ? 'منتهي' : 'ملغي';
                    const expiryStr = l.expiresAt === 0 ? '♾️' : new Date(l.expiresAt).toLocaleDateString('ar-SA');
                    return `<div style="padding:6px 8px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:3px;font-size:0.72rem;border-right:3px solid ${lStatusColor}">
                            <span style="font-weight:700">${l.deviceId.substring(0, 15)}...</span>
                            <span class="badge" style="background:${lStatusColor};color:white;font-size:0.6rem;margin:0 4px">${lStatusLabel}</span>
                            <span class="text-muted">ينتهي: ${expiryStr}</span>
                        </div>`;
                }).join('')}
                </div>
            ` : ''}
        `;

        openModal('🔑 إدارة المفاتيح', body, '<button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>');
    } catch (err) {
        console.error('Key management error:', err);
        openModal('🔑 إدارة المفاتيح',
            '<div style="text-align:center;padding:20px"><p class="text-danger">📡 تعذر الاتصال بالخادم</p><p class="text-muted" style="font-size:0.8rem">تحقق من اتصال الإنترنت</p></div>',
            '<button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>');
    }
}

async function generateNewKeyFB() {
    const type = document.getElementById('newKeyType').value;
    const validity = parseInt(document.getElementById('newKeyValidity').value);

    try {
        const key = await fbGenerateKey(type, validity);
        document.getElementById('newKeyValue').textContent = key;
        document.getElementById('generatedKeyDisplay').classList.remove('hidden');
    } catch (err) {
        console.error('Generate key error:', err);
        showToast('📡 تعذر الاتصال بالخادم', 'error');
    }
}

async function revokeKeyFB(keyStr) {
    const confirmed = await showConfirm('هل تريد إلغاء هذا المفتاح؟ سيتم قفل التطبيق على الجهاز المرتبط');
    if (!confirmed) return;

    try {
        await fbRevokeKey(keyStr);
        showToast('✅ تم إلغاء المفتاح');
        showKeyManagement(); // Refresh
    } catch (err) {
        console.error('Revoke error:', err);
        showToast('📡 خطأ في الاتصال', 'error');
    }
}

function copyKey() {
    const key = document.getElementById('newKeyValue').textContent;
    navigator.clipboard.writeText(key).then(() => showToast('✅ تم نسخ المفتاح')).catch(() => showToast('اضغط مطولاً لنسخ', 'error'));
}

// ==========================================
// App Start
// ==========================================
function startApp() {
    initSettings().then(() => {
        initCategories();
        if (window._settings?.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
        navigateTo('Dashboard');
        // Initialize owner-only UI elements
        if (typeof initOwnerUI === 'function') initOwnerUI();
        // Start background Google Sheets sync
        if (typeof startBackgroundSync === 'function') startBackgroundSync();
        // Initialize slide-out calculator
        if (typeof initCalculator === 'function') initCalculator();
    });
}

async function checkAuth() {
    // Initialize Firebase first
    try {
        initFirebase();
    } catch (err) {
        console.error('Firebase init error:', err);
    }

    const auth = getAuthData();

    // No setup at all
    if (!auth || !auth.isSetupComplete) {
        showActivationScreen();
        return;
    }

    // Owner: just show login
    if (auth.role === 'owner') {
        showLoginScreen();
        return;
    }

    // User: verify license before showing login
    try {
        const result = await fbVerifyLicense(getDeviceId());
        if (!result.valid) {
            showRenewalScreen(result.reason);
            return;
        }
    } catch (err) {
        // Offline check
        const offlineResult = fbVerifyLicenseOffline();
        if (!offlineResult.valid) {
            showRenewalScreen(offlineResult.reason);
            return;
        }
    }

    showLoginScreen();
}
