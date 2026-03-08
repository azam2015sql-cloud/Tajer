// ==========================================
// Tajer HTTPS Server
// تشغيل: node server.js
// ==========================================

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3443;
const HOST = '0.0.0.0';

// MIME types
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Generate self-signed certificate
function getCertificate() {
    const certDir = path.join(__dirname, '.cert');
    const certFile = path.join(certDir, 'cert.pem');
    const keyFile = path.join(certDir, 'key.pem');

    // Use cached cert if exists
    if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
        return {
            cert: fs.readFileSync(certFile),
            key: fs.readFileSync(keyFile)
        };
    }

    // Generate new cert
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'Tajer App' }];
    const pems = selfsigned.generate(attrs, {
        algorithm: 'sha256',
        days: 365,
        keySize: 2048,
        extensions: [
            {
                name: 'subjectAltName', altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' },
                    { type: 7, ip: '192.168.1.104' },
                    { type: 7, ip: '0.0.0.0' }
                ]
            }
        ]
    });

    // Cache cert
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);
    fs.writeFileSync(certFile, pems.cert);
    fs.writeFileSync(keyFile, pems.private);

    return { cert: pems.cert, key: pems.private };
}

// Serve static files
function serveFile(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath.split('?')[0]);

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Try index.html for SPA
                fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(data2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

// Start server
try {
    const cert = getCertificate();

    const server = https.createServer(cert, serveFile);
    server.listen(PORT, HOST, () => {
        // Get local IP
        const nets = require('os').networkInterfaces();
        let localIP = '';
        for (const iface of Object.values(nets)) {
            for (const net of iface) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIP = net.address;
                    break;
                }
            }
            if (localIP) break;
        }

        console.log('');
        console.log('  ╔══════════════════════════════════════════════╗');
        console.log('  ║                                              ║');
        console.log('  ║   🏪 تاجر - إدارة المبيعات                  ║');
        console.log('  ║                                              ║');
        console.log(`  ║   📱 الهاتف: https://${localIP}:${PORT}    ║`);
        console.log(`  ║   💻 الكمبيوتر: https://localhost:${PORT}     ║`);
        console.log('  ║                                              ║');
        console.log('  ║   ⚠️  عند أول فتح ستظهر تحذير الشهادة:       ║');
        console.log('  ║   اضغط "خيارات متقدمة" ثم "المتابعة"        ║');
        console.log('  ║                                              ║');
        console.log('  ║   ✅ بعد الفتح الأول يعمل بدون إنترنت!      ║');
        console.log('  ║                                              ║');
        console.log('  ╚══════════════════════════════════════════════╝');
        console.log('');
    });

    // Also start HTTP redirect
    http.createServer((req, res) => {
        const host = req.headers.host?.split(':')[0] || 'localhost';
        res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
        res.end();
    }).listen(3080, HOST);

} catch (error) {
    console.error('خطأ في تشغيل السيرفر:', error.message);
    process.exit(1);
}
