// ==========================================
// Firebase Configuration - Realtime Database
// ==========================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCMYlTIwP-NGOUCt-qL6yroYMQmF6S3jTE",
    authDomain: "tajer-azam.firebaseapp.com",
    databaseURL: "https://tajer-azam-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tajer-azam",
    storageBucket: "tajer-azam.firebasestorage.app",
    messagingSenderId: "755410000112",
    appId: "1:755410000112:web:99309141bd43eab769ca35"
};

// Initialize Firebase
let _firebaseApp = null;
let _firebaseDB = null;
let _firebaseAuth = null;

function initFirebase() {
    if (_firebaseAuth && _firebaseDB) return;

    if (!firebase.apps.length) {
        _firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
        _firebaseApp = firebase.app();
    }
    _firebaseDB = firebase.database();
    _firebaseAuth = firebase.auth();
    console.log('✅ Firebase initialized');
}

// Google Sign-In
async function signInWithGoogle() {
    try {
        initFirebase();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await _firebaseAuth.signInWithPopup(provider);
        const user = result.user;

        // Save user profile to Firebase
        const deviceId = getDeviceId();
        await fbSet(`users/${deviceId}`, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL || '',
            lastLogin: new Date().toISOString(),
            provider: 'google'
        });

        return {
            success: true,
            email: user.email,
            displayName: user.displayName
        };
    } catch (err) {
        console.error('Google sign-in error:', err);
        if (err.code === 'auth/popup-blocked') {
            return { success: false, error: 'المتصفح منع النافذة المنبثقة. يرجى السماح بها.' };
        }
        if (err.code === 'auth/popup-closed-by-user') {
            return { success: false, error: 'تم إلغاء تسجيل الدخول' };
        }
        return { success: false, error: err.message };
    }
}

// ==========================================
// Realtime Database Helpers
// ==========================================
function fbRef(path) {
    return _firebaseDB.ref(path);
}

async function fbSet(path, data) {
    return fbRef(path).set(data);
}

async function fbGet(path) {
    const snap = await fbRef(path).once('value');
    return snap.val();
}

async function fbUpdate(path, data) {
    return fbRef(path).update(data);
}

async function fbPush(path, data) {
    const ref = fbRef(path).push();
    await ref.set(data);
    return ref.key;
}

// Server timestamp
function serverTimestamp() {
    return firebase.database.ServerValue.TIMESTAMP;
}

// ==========================================
// Activation Key Operations
// ==========================================

// Generate key with type and validity
async function fbGenerateKey(type, validityDays) {
    const key = generateKeyString();
    const keyId = key.replace(/-/g, '');

    await fbSet(`activation_keys/${keyId}`, {
        key: key,
        type: type, // 'new' or 'renewal'
        status: 'active',
        validityDays: validityDays,
        createdAt: serverTimestamp(),
        usedAt: null,
        usedBy: null,
        revokedAt: null
    });

    return key;
}

// Validate key from server
async function fbValidateKey(keyStr, expectedType) {
    const keyId = keyStr.replace(/-/g, '').toUpperCase();
    const keyData = await fbGet(`activation_keys/${keyId}`);

    if (!keyData) return { valid: false, error: 'المفتاح غير موجود' };
    if (keyData.status === 'used') return { valid: false, error: 'هذا المفتاح تم استخدامه مسبقاً' };
    if (keyData.status === 'revoked') return { valid: false, error: 'هذا المفتاح تم إلغاؤه من المالك' };
    if (keyData.type !== expectedType) {
        const typeAr = expectedType === 'new' ? 'تفعيل جديد' : 'تجديد';
        return { valid: false, error: `هذا المفتاح ليس مفتاح ${typeAr}` };
    }

    return { valid: true, data: keyData };
}

// Activate key (mark as used + create license)
async function fbActivateKey(keyStr, deviceId) {
    const keyId = keyStr.replace(/-/g, '').toUpperCase();
    const keyData = await fbGet(`activation_keys/${keyId}`);

    if (!keyData || keyData.status !== 'active') return false;

    // Mark key as used
    await fbUpdate(`activation_keys/${keyId}`, {
        status: 'used',
        usedAt: serverTimestamp(),
        usedBy: deviceId
    });

    // Calculate expiry (days to ms)
    const validityMs = keyData.validityDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiresAt = keyData.validityDays === 0 ? 0 : now + validityMs; // 0 = unlimited

    // Create/update license
    await fbSet(`licenses/${deviceId}`, {
        key: keyStr,
        type: keyData.type,
        activatedAt: serverTimestamp(),
        expiresAt: expiresAt,
        validityDays: keyData.validityDays,
        status: 'active',
        lastVerified: serverTimestamp()
    });

    return true;
}

// Verify license (called on each app open)
async function fbVerifyLicense(deviceId) {
    try {
        const license = await fbGet(`licenses/${deviceId}`);

        if (!license) return { valid: false, reason: 'no_license' };
        if (license.status === 'revoked') return { valid: false, reason: 'revoked' };
        if (license.status === 'expired') return { valid: false, reason: 'expired' };

        // Check expiry (0 = unlimited)
        if (license.expiresAt !== 0 && Date.now() > license.expiresAt) {
            await fbUpdate(`licenses/${deviceId}`, { status: 'expired' });
            return { valid: false, reason: 'expired', expiresAt: license.expiresAt };
        }

        // Update last verified
        await fbUpdate(`licenses/${deviceId}`, { lastVerified: serverTimestamp() });

        // Save locally for offline grace period
        localStorage.setItem('tajer_license_cache', JSON.stringify({
            ...license,
            lastVerifiedLocal: Date.now()
        }));

        return { valid: true, license };
    } catch (err) {
        // Offline: check local cache
        console.log('Offline license check:', err.message);
        return fbVerifyLicenseOffline();
    }
}

// Offline verification (max 3 days grace)
function fbVerifyLicenseOffline() {
    const cached = JSON.parse(localStorage.getItem('tajer_license_cache') || 'null');
    if (!cached) return { valid: false, reason: 'no_cache' };
    if (cached.status !== 'active') return { valid: false, reason: cached.status };

    // Max 3 days offline
    const offlineDays = (Date.now() - (cached.lastVerifiedLocal || 0)) / (1000 * 60 * 60 * 24);
    if (offlineDays > 3) return { valid: false, reason: 'offline_expired' };

    // Check expiry
    if (cached.expiresAt !== 0 && Date.now() > cached.expiresAt) {
        return { valid: false, reason: 'expired' };
    }

    return { valid: true, license: cached, offline: true };
}

// Revoke a key (owner action)
async function fbRevokeKey(keyStr) {
    const keyId = keyStr.replace(/-/g, '').toUpperCase();
    const keyData = await fbGet(`activation_keys/${keyId}`);
    if (!keyData) return false;

    await fbUpdate(`activation_keys/${keyId}`, {
        status: 'revoked',
        revokedAt: serverTimestamp()
    });

    // Also revoke the associated license
    if (keyData.usedBy) {
        await fbUpdate(`licenses/${keyData.usedBy}`, {
            status: 'revoked'
        });
    }
    return true;
}

// Get all keys (for owner management)
async function fbGetAllKeys() {
    const data = await fbGet('activation_keys');
    if (!data) return [];
    return Object.entries(data).map(([id, v]) => ({ id, ...v }));
}

// Get all licenses (for owner)
async function fbGetAllLicenses() {
    const data = await fbGet('licenses');
    if (!data) return [];
    return Object.entries(data).map(([id, v]) => ({ deviceId: id, ...v }));
}

// ==========================================
// Key String Generator
// ==========================================
function generateKeyString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I to avoid confusion
    let key = '';
    for (let i = 0; i < 12; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key.substring(0, 4) + '-' + key.substring(4, 8) + '-' + key.substring(8, 12);
}

// ==========================================
// Device Fingerprint
// ==========================================
function getDeviceId() {
    let id = localStorage.getItem('tajer_device_id');
    if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('tajer_device_id', id);
    }
    return id;
}
