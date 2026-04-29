const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads klasörü oluşturuldu:', uploadsDir);
}

// Database connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'restoranarmenü',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 dakikada bir expired session'ları temizle
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'], // Live Server origin'leri
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control']
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('trust proxy', true);
app.use(session({
    secret: process.env.SESSION_SECRET || 'güçlü_bir_şifre_olusturun',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Localhost'ta false olmalı
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 saat
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Localhost'ta 'lax' veya false
        // domain: '.ngrok-free.app' // Localhost'ta bu satırı tamamen kaldırın veya yorum satırı yapın
    }
}));
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Session kontrolü
        if (!req.session.yonetici) {
            console.log('Oturum bulunamadı - Middleware reddetti');
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        // 2. Veritabanından oturum durumunu kontrol et
        const [yoneticiler] = await pool.execute(
            'SELECT oturum_aktif FROM yoneticiler WHERE yonetici_id = ?',
            [req.session.yonetici.id]
        );

        if (yoneticiler.length === 0 || yoneticiler[0].oturum_aktif !== 1) {
            console.log('Veritabanında oturum geçersiz');
            
            // Geçersiz oturumu temizle
            req.session.destroy();
            return res.status(401).json({ error: 'Oturum geçersiz' });
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
};
// ==================== AUTH ROUTES ====================

// Giriş yapma
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, sifre } = req.body;
        
        const [yoneticiler] = await pool.execute(
            'SELECT * FROM yoneticiler WHERE email = ?',
            [email]
        );

        if (yoneticiler.length === 0) {
            return res.status(401).json({ error: 'Geçersiz email veya şifre' });
        }

        const yonetici = yoneticiler[0];
        const sifreGecerli = await bcrypt.compare(sifre, yonetici.sifre);

        if (!sifreGecerli) {
            return res.status(401).json({ error: 'Geçersiz email veya şifre' });
        }

        // Oturum bilgilerini güncelle
        await pool.execute(
            'UPDATE yoneticiler SET oturum_aktif = 1 WHERE yonetici_id = ?',
            [yonetici.yonetici_id]
        );

        // Session oluştur
        req.session.yonetici = {
            id: yonetici.yonetici_id,
            ad: yonetici.ad,
            soyad: yonetici.soyad,
            email: yonetici.email
        };

        res.json({
            success: true,
            yonetici: req.session.yonetici
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Çıkış yapma
app.post('/api/auth/logout', async (req, res) => {
    try {
        if (req.session.yonetici) {
            // Veritabanında oturumu pasif yap
            await pool.execute(
                'UPDATE yoneticiler SET oturum_aktif = 0 WHERE yonetici_id = ?',
                [req.session.yonetici.id]
            );
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return res.status(500).json({ error: 'Çıkış yapılırken hata oluştu' });
            }
            
            res.clearCookie('connect.sid');
            res.json({ success: true, message: 'Çıkış başarılı' });
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});
app.get('/api/auth/check', (req, res) => {
    console.log('Auth check session:', req.session); // Log ekleyin
    if (req.session.yonetici) {
        console.log('Authenticated user:', req.session.yonetici);
        res.json({ 
            authenticated: true,
            yonetici: {
                id: req.session.yonetici.id,
                ad: req.session.yonetici.ad,
                soyad: req.session.yonetici.soyad,
                email: req.session.yonetici.email
            }
        });
    } else {
        console.log('No session found');
        res.json({ authenticated: false });
    }
});

app.post('/api/auth/validate-session', async (req, res) => {
    try {
        console.log('Validate session request:', req.session);
        
        if (!req.session.yonetici) {
            console.log('No session in validate');
            return res.status(401).json({ valid: false, error: 'Oturum bulunamadı' });
        }

        const [yoneticiler] = await pool.execute(
            'SELECT oturum_aktif FROM yoneticiler WHERE yonetici_id = ?',
            [req.session.yonetici.id]
        );

        if (yoneticiler.length === 0 || yoneticiler[0].oturum_aktif !== 1) {
            console.log('Invalid session in DB');
            return res.status(401).json({ valid: false, error: 'Veritabanında oturum geçersiz' });
        }

        res.json({ valid: true });
    } catch (error) {
        console.error('Validate session error:', error);
        res.status(500).json({ valid: false, error: 'Sunucu hatası' });
    }
});

// ==================== DASHBOARD ROUTES ====================

// Dashboard istatistikleri
app.get('/api/dashboard', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        // Restoran sayısı
        const [restoranlar] = await pool.execute(
            'SELECT COUNT(*) as sayi FROM restoranlar WHERE yonetici_id = ?',
            [yonetici.id]
        );

        // Kategori sayısı
        const [kategoriler] = await pool.execute(
            'SELECT COUNT(*) as sayi FROM kategoriler k JOIN restoranlar r ON k.restoran_id = r.restoran_id WHERE r.yonetici_id = ?',
            [yonetici.id]
        );

        // Ürün sayısı
        const [urunler] = await pool.execute(
            'SELECT COUNT(*) as sayi FROM urunler u JOIN kategoriler k ON u.kategori_id = k.kategori_id JOIN restoranlar r ON k.restoran_id = r.restoran_id WHERE r.yonetici_id = ?',
            [yonetici.id]
        );

        // QR kod sayısı
        const [qrKodlar] = await pool.execute(
            'SELECT COUNT(*) as sayi FROM restoranlar WHERE yonetici_id = ? AND qr_kodu IS NOT NULL',
            [yonetici.id]
        );

        // Son aktiviteler
        const [aktiviteler] = await pool.execute(
            `SELECT 
                'Yeni restoran oluşturuldu' as aciklama,
                olusturulma_tarihi as tarih
            FROM restoranlar 
            WHERE yonetici_id = ? 
            ORDER BY olusturulma_tarihi DESC 
            LIMIT 5`,
            [yonetici.id]
        );

        res.json({
            restoranSayisi: restoranlar[0].sayi,
            kategoriSayisi: kategoriler[0].sayi,
            urunSayisi: urunler[0].sayi,
            qrSayisi: qrKodlar[0].sayi,
            aktiviteler: aktiviteler
        });

    } catch (error) {
        console.error('Dashboard hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== RESTORAN ROUTES ====================

// Restoran oluşturma
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            // Uploads klasörünün varlığını kontrol et
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            cb(null, uploadsDir)
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
        }
    })
});

// Restoran oluşturma route'unu güncelle
app.post('/api/restoran', upload.single('restoran_logo'), async (req, res) => {
    try {
        // Session kontrolü
        if (!req.session.yonetici) {
            console.log('Session not found:', req.session);
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        // Gelen verileri logla
        console.log('Request body:', req.body);
        console.log('Session data:', req.session);

        const { 
            restoran_adi, 
            restoran_aciklama,
            restoran_tema,
            kategoriler 
        } = req.body;

        // Form verilerini kontrol et ve varsayılan değerler ata
        if (!restoran_adi) {
            return res.status(400).json({ error: 'Restoran adı gerekli' });
        }

        const restoran_logo = req.file ? `/uploads/${req.file.filename}` : null;

        // QR kodu oluştur
        const qr_kodu = uuidv4();
        const qr_url = `${req.protocol}://${req.get('host')}/menu/${qr_kodu}`;
        
        // QR kodu resmi oluştur
        const qr_image = await QRCode.toDataURL(qr_url);

        // Veritabanına kaydet
        const [result] = await pool.execute(
            `INSERT INTO restoranlar 
            (restoran_adi, restoran_aciklama, restoran_logo, restoran_tema, qr_kodu, yonetici_id) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                restoran_adi || '', 
                restoran_aciklama || '', 
                restoran_logo, 
                restoran_tema || 'default', 
                qr_kodu, 
                req.session.yonetici.id
            ]
        );

        const restoran_id = result.insertId;

        // Seçili kategorileri ekle
        if (kategoriler) {
            try {
                const kategoriListesi = JSON.parse(kategoriler);
                for (const kategoriId of kategoriListesi) {
                    // Eğer kategori ID'si sayısal değilse (yeni kategori), önce kategori oluştur
                    if (isNaN(kategoriId)) {
                        // Yeni kategori oluştur
                        const [kategoriResult] = await pool.execute(
                            `INSERT INTO kategoriler (kategori_adi, restoran_id, kategori_sira) 
                             VALUES (?, ?, 0)`,
                            [`Kategori ${Date.now()}`, restoran_id]
                        );
                    } else {
                        // Mevcut kategoriyi restorana bağla
                        await pool.execute(
                            `UPDATE kategoriler SET restoran_id = ? WHERE kategori_id = ?`,
                            [restoran_id, kategoriId]
                        );
                    }
                }
            } catch (error) {
                console.error('Kategori ekleme hatası:', error);
            }
        }

        // Varsayılan tema oluştur
        await pool.execute(
            `INSERT INTO menu_temalari 
            (restoran_id, tema_adi, arkaplan_rengi, metin_rengi, vurgu_rengi) 
            VALUES (?, 'Varsayılan Tema', '#ffffff', '#333333', '#ff5722')`,
            [restoran_id]
        );

        res.json({
            success: true,
            message: 'Restoran başarıyla oluşturuldu',
            restoran_id,
            qr_kodu,
            qr_url,
            qr_image
        });

    } catch (error) {
        console.error('Restoran oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoranları listele
app.get('/api/restoran', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const [restoranlar] = await pool.execute(
            `SELECT 
                r.*,
                COUNT(DISTINCT k.kategori_id) as kategori_sayisi,
                COUNT(DISTINCT u.urun_id) as urun_sayisi
            FROM restoranlar r
            LEFT JOIN kategoriler k ON r.restoran_id = k.restoran_id
            LEFT JOIN urunler u ON k.kategori_id = u.kategori_id
            WHERE r.yonetici_id = ?
            GROUP BY r.restoran_id
            ORDER BY r.olusturulma_tarihi DESC`,
            [yonetici.id]
        );

        res.json({ restoranlar: restoranlar });

    } catch (error) {
        console.error('Restoran listesi hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran QR kodu
app.get('/api/restoran/:id/qr', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const restoran_id = req.params.id;

        const [restoranlar] = await pool.execute(
            'SELECT * FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(404).json({ error: 'Restoran bulunamadı' });
        }

        const restoran = restoranlar[0];
        const qr_url = `${req.protocol}://${req.get('host')}/menu/${restoran.qr_kodu}`;
        const qr_image = await QRCode.toDataURL(qr_url);

        res.json({
            qr_kod: restoran.qr_kodu,
            qr_url: qr_url,
            qr_image: qr_image
        });

    } catch (error) {
        console.error('QR kod hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran güncelleme
app.put('/api/restoran/:id', upload.single('restoran_logo'), async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const restoran_id = req.params.id;
        const { restoran_adi, restoran_aciklama, restoran_tema } = req.body;

        // Restoranın bu yöneticiye ait olduğunu kontrol et
        const [restoranlar] = await pool.execute(
            'SELECT * FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(404).json({ error: 'Restoran bulunamadı' });
        }

        // Logo güncelleme
        let restoran_logo = restoranlar[0].restoran_logo;
        if (req.file) {
            if (restoran_logo) {
                const filePath = path.join(__dirname, restoran_logo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            restoran_logo = `/uploads/${req.file.filename}`;
        }

        // Restoranı güncelle
        await pool.execute(
            `UPDATE restoranlar 
            SET restoran_adi = ?, restoran_aciklama = ?, restoran_logo = ?, restoran_tema = ?
            WHERE restoran_id = ?`,
            [restoran_adi, restoran_aciklama, restoran_logo, restoran_tema, restoran_id]
        );

        res.json({
            success: true,
            message: 'Restoran başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Restoran güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran aktif/pasif yapma
app.patch('/api/restoran/:id/toggle', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const restoran_id = req.params.id;

        // Restoranın bu yöneticiye ait olduğunu kontrol et
        const [restoranlar] = await pool.execute(
            'SELECT * FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(404).json({ error: 'Restoran bulunamadı' });
        }

        const currentStatus = restoranlar[0].aktif;
        const newStatus = currentStatus ? 0 : 1;

        // Durumu güncelle
        await pool.execute(
            'UPDATE restoranlar SET aktif = ? WHERE restoran_id = ?',
            [newStatus, restoran_id]
        );

        res.json({
            success: true,
            message: `Restoran ${newStatus ? 'aktif' : 'pasif'} yapıldı`,
            aktif: newStatus
        });

    } catch (error) {
        console.error('Restoran durum değiştirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran silme
app.delete('/api/restoran/:id', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const restoran_id = req.params.id;

        // Restoranın bu yöneticiye ait olduğunu kontrol et
        const [restoranlar] = await pool.execute(
            'SELECT * FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(404).json({ error: 'Restoran bulunamadı' });
        }

        // İlişkili verileri sil (kategoriler, ürünler, vb.)
        await pool.execute('DELETE FROM urunler WHERE kategori_id IN (SELECT kategori_id FROM kategoriler WHERE restoran_id = ?)', [restoran_id]);
        await pool.execute('DELETE FROM kategoriler WHERE restoran_id = ?', [restoran_id]);
        await pool.execute('DELETE FROM menu_temalari WHERE restoran_id = ?', [restoran_id]);
        
        // Restoranı sil
        await pool.execute('DELETE FROM restoranlar WHERE restoran_id = ?', [restoran_id]);

        res.json({
            success: true,
            message: 'Restoran başarıyla silindi'
        });

    } catch (error) {
        console.error('Restoran silme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran bilgilerini getir
app.get('/api/restoran/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [restoranlar] = await pool.execute(
            'SELECT * FROM restoranlar WHERE restoran_id = ?',
            [id]
        );

        if (restoranlar.length === 0) {
            return res.status(404).json({ error: 'Restoran bulunamadı' });
        }

        const restoran = restoranlar[0];
        
        // QR URL'ini oluştur
        const qr_url = `${req.protocol}://${req.get('host')}/menu/${restoran.qr_kodu}`;

        res.json({
            success: true,
            restoran: {
                ...restoran,
                qr_url
            }
        });

    } catch (error) {
        console.error('Restoran getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Restoran istatistikleri
app.get('/api/restoran/:id/stats', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Kategori sayısı
        const [kategoriler] = await pool.execute(
            'SELECT COUNT(*) as kategori_sayisi FROM kategoriler WHERE restoran_id = ? AND aktif = 1',
            [id]
        );

        // Ürün sayısı
        const [urunler] = await pool.execute(
            `SELECT COUNT(*) as urun_sayisi FROM urunler u 
            JOIN kategoriler k ON u.kategori_id = k.kategori_id 
            WHERE k.restoran_id = ? AND u.aktif = 1`,
            [id]
        );

        // QR tarama sayısı
        const [qr_loglari] = await pool.execute(
            'SELECT COUNT(*) as tarama_sayisi FROM qr_loglari WHERE restoran_id = ?',
            [id]
        );

        // Son 7 günlük tarama
        const [son_taramalar] = await pool.execute(
            `SELECT DATE(tarama_tarihi) as tarih, COUNT(*) as sayi 
            FROM qr_loglari 
            WHERE restoran_id = ? AND tarama_tarihi >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(tarama_tarihi)
            ORDER BY tarih`,
            [id]
        );

        res.json({
            success: true,
            stats: {
                kategori_sayisi: kategoriler[0].kategori_sayisi,
                urun_sayisi: urunler[0].urun_sayisi,
                toplam_tarama: qr_loglari[0].tarama_sayisi,
                son_7_gun: son_taramalar
            }
        });

    } catch (error) {
        console.error('İstatistik hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== KATEGORI ROUTES ====================

// Restoranın kategorilerini getir
app.get('/api/kategori/restoran/:restoran_id', authMiddleware, async (req, res) => {
    try {
        const { restoran_id } = req.params;
        
        const [kategoriler] = await pool.execute(
            'SELECT * FROM kategoriler WHERE restoran_id = ? ORDER BY kategori_sira ASC',
            [restoran_id]
        );

        res.json({
            success: true,
            kategoriler
        });

    } catch (error) {
        console.error('Kategori getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kategori oluştur
app.post('/api/kategori', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const { restoran_id, kategori_adi, kategori_sira } = req.body;

        // Restoranın bu yöneticiye ait olduğunu kontrol et
        const [restoranlar] = await pool.execute(
            'SELECT restoran_id FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(403).json({ error: 'Bu restoran için yetkiniz yok' });
        }

        const [result] = await pool.execute(
            'INSERT INTO kategoriler (restoran_id, kategori_adi, kategori_sira) VALUES (?, ?, ?)',
            [restoran_id, kategori_adi, kategori_sira || 0]
        );

        res.json({
            success: true,
            message: 'Kategori başarıyla oluşturuldu',
            kategori_id: result.insertId
        });

    } catch (error) {
        console.error('Kategori oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kategorileri listele
app.get('/api/kategori', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const { restoran_id } = req.query;
        if (!restoran_id) {
            return res.status(400).json({ error: 'Restoran ID gerekli' });
        }

        // Restoranın bu yöneticiye ait olduğunu kontrol et
        const [restoranlar] = await pool.execute(
            'SELECT restoran_id FROM restoranlar WHERE restoran_id = ? AND yonetici_id = ?',
            [restoran_id, yonetici.id]
        );

        if (restoranlar.length === 0) {
            return res.status(403).json({ error: 'Bu restoran için yetkiniz yok' });
        }

        const [kategoriler] = await pool.execute(
            `SELECT 
                k.*,
                COUNT(u.urun_id) as urun_sayisi
            FROM kategoriler k
            LEFT JOIN urunler u ON k.kategori_id = u.kategori_id
            WHERE k.restoran_id = ?
            GROUP BY k.kategori_id
            ORDER BY k.kategori_sira ASC, k.kategori_adi ASC`,
            [restoran_id]
        );

        res.json({ kategoriler: kategoriler });

    } catch (error) {
        console.error('Kategori listesi hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kategori bilgilerini getir
app.get('/api/kategori/:id', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const kategori_id = req.params.id;

        // Kategorinin bu yöneticiye ait olduğunu kontrol et
        const [kategoriler] = await pool.execute(
            `SELECT k.* FROM kategoriler k
             JOIN restoranlar r ON k.restoran_id = r.restoran_id
             WHERE k.kategori_id = ? AND r.yonetici_id = ?`,
            [kategori_id, yonetici.id]
        );

        if (kategoriler.length === 0) {
            return res.status(404).json({ error: 'Kategori bulunamadı' });
        }

        res.json({
            success: true,
            kategori: kategoriler[0]
        });

    } catch (error) {
        console.error('Kategori getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kategori güncelle
app.put('/api/kategori/:id', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const kategori_id = req.params.id;
        const { kategori_adi, kategori_sira } = req.body;

        // Gelen verileri logla
        console.log('Güncelleme verileri:', {
            kategori_id,
            kategori_adi,
            kategori_sira
        });

        // Kategori adı kontrolü
        if (!kategori_adi) {
            return res.status(400).json({ error: 'Kategori adı gerekli' });
        }

        // Kategorinin bu yöneticiye ait olduğunu kontrol et
        const [kategoriler] = await pool.execute(
            `SELECT k.* FROM kategoriler k
             JOIN restoranlar r ON k.restoran_id = r.restoran_id
             WHERE k.kategori_id = ? AND r.yonetici_id = ?`,
            [kategori_id, yonetici.id]
        );

        if (kategoriler.length === 0) {
            return res.status(404).json({ error: 'Kategori bulunamadı' });
        }

        // Kategoriyi güncelle - NULL yerine 0 kullan
        await pool.execute(
            'UPDATE kategoriler SET kategori_adi = ?, kategori_sira = ? WHERE kategori_id = ?',
            [kategori_adi, parseInt(kategori_sira || 0), kategori_id]
        );

        res.json({
            success: true,
            message: 'Kategori başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Kategori güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kategori sil
app.delete('/api/kategori/:id', async (req, res) => {
    try {
        const yonetici = req.session.yonetici;
        if (!yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const kategori_id = req.params.id;

        // Kategorinin bu yöneticiye ait olduğunu kontrol et
        const [kategoriler] = await pool.execute(
            `SELECT k.* FROM kategoriler k
             JOIN restoranlar r ON k.restoran_id = r.restoran_id
             WHERE k.kategori_id = ? AND r.yonetici_id = ?`,
            [kategori_id, yonetici.id]
        );

        if (kategoriler.length === 0) {
            return res.status(404).json({ error: 'Kategori bulunamadı' });
        }

        // Önce kategoriye ait ürünleri sil
        await pool.execute('DELETE FROM urunler WHERE kategori_id = ?', [kategori_id]);
        
        // Sonra kategoriyi sil
        await pool.execute('DELETE FROM kategoriler WHERE kategori_id = ?', [kategori_id]);

        res.json({
            success: true,
            message: 'Kategori başarıyla silindi'
        });

    } catch (error) {
        console.error('Kategori silme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== URUN ROUTES ====================

// Kategorinin ürünlerini getir
app.get('/api/urun/kategori/:kategori_id', authMiddleware, async (req, res) => {
    try {
        const { kategori_id } = req.params;
        
        const [urunler] = await pool.execute(
            'SELECT * FROM urunler WHERE kategori_id = ? ORDER BY sira_no ASC',
            [kategori_id]
        );

        // Her ürün için özellikleri getir
        for (let urun of urunler) {
            const [ozellikler] = await pool.execute(
                'SELECT * FROM urun_ozellikleri WHERE urun_id = ? AND aktif = 1',
                [urun.urun_id]
            );
            urun.ozellikler = ozellikler;
        }

        res.json({
            success: true,
            urunler
        });

    } catch (error) {
        console.error('Ürün getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Ürün oluştur
app.post('/api/urun', upload.fields([
    { name: 'urun_gorsel', maxCount: 1 },
    { name: 'model_url', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.session.yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        // Form verilerini al
        const {
            kategori_id,
            urun_adi,
            urun_aciklama,
            fiyat,
            model_olcek,
            model_rotasyon,
            stok_durumu,
            sira_no
        } = req.body;

        // Debug için verileri logla
        console.log('Gelen form verileri:', {
            body: req.body,
            files: req.files
        });

        // Zorunlu alan kontrolü
        if (!kategori_id || !urun_adi || !fiyat) {
            return res.status(400).json({
                error: 'Kategori, ürün adı ve fiyat zorunludur'
            });
        }

        // Dosya yollarını belirle
        const gorsel_url = req.files['urun_gorsel'] ? 
            `/uploads/${req.files['urun_gorsel'][0].filename}` : null;
        
        const model_dosya = req.files['model_url'] ? 
            `/uploads/${req.files['model_url'][0].filename}` : null;

        // SQL sorgusu
        const [result] = await pool.execute(
            `INSERT INTO urunler (
                kategori_id,
                urun_adi,
                urun_aciklama,
                fiyat,
                gorsel_url,
                model_url,
                model_olcek,
                model_rotasyon,
                stok_durumu,
                sira_no,
                aktif
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                kategori_id,
                urun_adi,
                urun_aciklama || '',
                parseFloat(fiyat),
                gorsel_url,
                model_dosya,
                parseFloat(model_olcek || 1.0),
                model_rotasyon || '0,0,0',
                parseInt(stok_durumu || 0),
                parseInt(sira_no || 0)
            ]
        );

        res.json({
            success: true,
            message: 'Ürün başarıyla oluşturuldu',
            urun_id: result.insertId
        });

    } catch (error) {
        console.error('Ürün oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});
// Ürün güncelleme endpoint'i
app.put('/api/urun/:id', upload.fields([
    { name: 'urun_gorsel', maxCount: 1 },
    { name: 'model_url', maxCount: 1 }
]), async (req, res) => {
    try {
        // Yetki kontrolü
        if (!req.session.yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const urunId = req.params.id;
        
        // Form verilerini al
        const {
            kategori_id,
            urun_adi,
            urun_aciklama,
            fiyat,
            model_olcek,
            model_rotasyon,
            stok_durumu,
            sira_no
        } = req.body;

        // Debug için verileri logla
        console.log('Gelen güncelleme verileri:', {
            body: req.body,
            files: req.files
        });

        // Zorunlu alan kontrolü
        if (!kategori_id || !urun_adi || !fiyat) {
            return res.status(400).json({
                error: 'Kategori, ürün adı ve fiyat zorunludur'
            });
        }

        // Önce mevcut ürün bilgilerini al
        const [currentProduct] = await pool.execute(
            'SELECT gorsel_url, model_url FROM urunler WHERE urun_id = ?',
            [urunId]
        );

        if (currentProduct.length === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        // Yeni dosya yollarını belirle
        let gorsel_url = currentProduct[0].gorsel_url;
        let model_url = currentProduct[0].model_url;

        // Eğer yeni dosya yüklendiyse
        if (req.files['urun_gorsel']) {
            // Eski dosyayı sil
            if (gorsel_url) {
                const filePath = path.join(__dirname, gorsel_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            gorsel_url = `/uploads/${req.files['urun_gorsel'][0].filename}`;
        }

        if (req.files['model_url']) {
            // Eski dosyayı sil
            if (model_url) {
                const filePath = path.join(__dirname, model_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            model_url = `/uploads/${req.files['model_url'][0].filename}`;
        }

        // SQL sorgusu
        const [result] = await pool.execute(
            `UPDATE urunler SET
                kategori_id = ?,
                urun_adi = ?,
                urun_aciklama = ?,
                fiyat = ?,
                gorsel_url = ?,
                model_url = ?,
                model_olcek = ?,
                model_rotasyon = ?,
                stok_durumu = ?,
                sira_no = ?,
                aktif = 1
            WHERE urun_id = ?`,
            [
                kategori_id,
                urun_adi,
                urun_aciklama || '',
                parseFloat(fiyat),
                gorsel_url,
                model_url,
                parseFloat(model_olcek || 1.0),
                model_rotasyon || '0,0,0',
                parseInt(stok_durumu || 0),
                parseInt(sira_no || 0),
                urunId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        res.json({
            success: true,
            message: 'Ürün başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Ürün güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});
// Tek ürün getirme endpoint'i
app.get('/api/urun/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [urun] = await pool.execute(
            'SELECT * FROM urunler WHERE urun_id = ?',
            [id]
        );

        if (urun.length === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        // Ürün özelliklerini getir
        const [ozellikler] = await pool.execute(
            'SELECT * FROM urun_ozellikleri WHERE urun_id = ? AND aktif = 1',
            [id]
        );

        res.json({
            success: true,
            urun: {
                ...urun[0],
                ozellikler
            }
        });

    } catch (error) {
        console.error('Ürün getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});
// Ürün silme endpoint'i
app.delete('/api/urun/:id', async (req, res) => {
    try {
        // Oturum kontrolü
        if (!req.session.yonetici) {
            return res.status(401).json({ error: 'Oturum gerekli' });
        }

        const urun_id = req.params.id;

        // Ürün bilgisini ve sahipliğini kontrol et (kategoriler -> restoranlar -> yonetici)
        const [urunler] = await pool.execute(
            `SELECT u.urun_id, u.gorsel_url, u.model_url
             FROM urunler u
             JOIN kategoriler k ON u.kategori_id = k.kategori_id
             JOIN restoranlar r ON k.restoran_id = r.restoran_id
             WHERE u.urun_id = ? AND r.yonetici_id = ?`,
            [urun_id, req.session.yonetici.id]
        );

        if (urunler.length === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı' });
        }

        const { gorsel_url, model_url } = urunler[0];

        // İlişkili özellikleri sil
        await pool.execute('DELETE FROM urun_ozellikleri WHERE urun_id = ?', [urun_id]);

        // Ürünü sil
        await pool.execute('DELETE FROM urunler WHERE urun_id = ?', [urun_id]);

        // Dosyaları sil (varsa)
        const tryUnlink = (urlPath) => {
            try {
                if (!urlPath) return;
                // URL '/uploads/...' ise gerçek dosya yolu 'public/uploads/...' olacaktır
                const filePath = urlPath.startsWith('/uploads/')
                    ? path.join(__dirname, 'public', urlPath.replace(/^\//, ''))
                    : path.join(__dirname, urlPath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.warn('Dosya silme uyarısı:', e.message);
            }
        };

        tryUnlink(gorsel_url);
        tryUnlink(model_url);

        res.json({ success: true, message: 'Ürün başarıyla silindi' });
    } catch (error) {
        console.error('Ürün silme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});
// ==================== TEMA ROUTES ====================

// Restoranın temalarını getir
app.get('/api/tema/restoran/:restoran_id', authMiddleware, async (req, res) => {
    try {
        const { restoran_id } = req.params;
        
        const [temalar] = await pool.execute(
            'SELECT * FROM menu_temalari WHERE restoran_id = ? ORDER BY tema_id ASC',
            [restoran_id]
        );

        res.json({
            success: true,
            temalar
        });

    } catch (error) {
        console.error('Tema getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Tema oluştur
app.post('/api/tema', authMiddleware, async (req, res) => {
    try {
        const { 
            restoran_id, 
            tema_adi, 
            arkaplan_rengi, 
            metin_rengi, 
            vurgu_rengi 
        } = req.body;

        const [result] = await pool.execute(
            `INSERT INTO menu_temalari 
            (restoran_id, tema_adi, arkaplan_rengi, metin_rengi, vurgu_rengi) 
            VALUES (?, ?, ?, ?, ?)`,
            [restoran_id, tema_adi, arkaplan_rengi, metin_rengi, vurgu_rengi]
        );

        res.json({
            success: true,
            message: 'Tema başarıyla oluşturuldu',
            tema_id: result.insertId
        });

    } catch (error) {
        console.error('Tema oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== YONETICI ROUTES ====================

// Restoranın yöneticilerini getir
app.get('/api/yonetici/restoran/:restoran_id', authMiddleware, async (req, res) => {
    try {
        const { restoran_id } = req.params;
        
        const [yoneticiler] = await pool.execute(
            'SELECT yonetici_id, ad, soyad, email, telefon, aktif, son_giris_tarihi FROM yoneticiler WHERE restoran_id = ? ORDER BY yonetici_id ASC',
            [restoran_id]
        );

        res.json({
            success: true,
            yoneticiler
        });

    } catch (error) {
        console.error('Yönetici getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Yönetici oluştur
app.post('/api/yonetici', authMiddleware, async (req, res) => {
    try {
        const { 
            restoran_id, 
            ad, 
            soyad, 
            email, 
            sifre, 
            telefon 
        } = req.body;

        // Email kontrolü
        const [existing] = await pool.execute(
            'SELECT * FROM yoneticiler WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor' });
        }

        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(sifre, 10);

        const [result] = await pool.execute(
            `INSERT INTO yoneticiler 
            (restoran_id, ad, soyad, email, sifre, telefon) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [restoran_id, ad, soyad, email, hashedPassword, telefon]
        );

        res.json({
            success: true,
            message: 'Yönetici başarıyla oluşturuldu',
            yonetici_id: result.insertId
        });

    } catch (error) {
        console.error('Yönetici oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Profil bilgilerini getir
app.get('/api/yonetici/profil', authMiddleware, async (req, res) => {
    try {
        const yonetici_id = req.session.yonetici.id;
        
        const [yoneticiler] = await pool.execute(
            'SELECT yonetici_id, ad, soyad, email, telefon, son_giris_tarihi FROM yoneticiler WHERE yonetici_id = ?',
            [yonetici_id]
        );

        if (yoneticiler.length === 0) {
            return res.status(404).json({ error: 'Yönetici bulunamadı' });
        }

        res.json({
            success: true,
            yonetici: yoneticiler[0]
        });

    } catch (error) {
        console.error('Profil getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Profil güncelle
app.put('/api/yonetici/profil', authMiddleware, async (req, res) => {
    try {
        const yonetici_id = req.session.yonetici.id;
        const { ad, soyad, email, telefon } = req.body;

        // Email kontrolü (kendi emaili hariç)
        const [existing] = await pool.execute(
            'SELECT * FROM yoneticiler WHERE email = ? AND yonetici_id != ?',
            [email, yonetici_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor' });
        }

        await pool.execute(
            `UPDATE yoneticiler 
            SET ad = ?, soyad = ?, email = ?, telefon = ?
            WHERE yonetici_id = ?`,
            [ad, soyad, email, telefon, yonetici_id]
        );

        // Session'ı güncelle
        req.session.yonetici.ad = ad;
        req.session.yonetici.soyad = soyad;
        req.session.yonetici.email = email;

        res.json({
            success: true,
            message: 'Profil başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Profil şifre değiştir
app.patch('/api/yonetici/profil/sifre', authMiddleware, async (req, res) => {
    try {
        const yonetici_id = req.session.yonetici.id;
        const { mevcut_sifre, yeni_sifre } = req.body;

        // Mevcut şifreyi kontrol et
        const [yoneticiler] = await pool.execute(
            'SELECT sifre FROM yoneticiler WHERE yonetici_id = ?',
            [yonetici_id]
        );

        if (yoneticiler.length === 0) {
            return res.status(404).json({ error: 'Yönetici bulunamadı' });
        }

        const sifreGecerli = await bcrypt.compare(mevcut_sifre, yoneticiler[0].sifre);

        if (!sifreGecerli) {
            return res.status(400).json({ error: 'Mevcut şifre yanlış' });
        }

        // Yeni şifreyi hashle
        const hashedPassword = await bcrypt.hash(yeni_sifre, 10);

        await pool.execute(
            'UPDATE yoneticiler SET sifre = ? WHERE yonetici_id = ?',
            [hashedPassword, yonetici_id]
        );

        res.json({
            success: true,
            message: 'Şifre başarıyla değiştirildi'
        });

    } catch (error) {
        console.error('Profil şifre değiştirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== TEST ENDPOINTS ====================

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API çalışıyor' });
});

// Test yönetici oluşturma endpoint'i
app.post('/api/test/create-admin', async (req, res) => {
    try {
        // Önce foreign key'i kaldır, sonra tabloyu sil ve yeniden oluştur
        try {
            await pool.execute(`ALTER TABLE restoranlar DROP FOREIGN KEY fk_restoran_yonetici`);
        } catch (error) {
            // Foreign key yoksa hata vermez
        }
        await pool.execute(`DROP TABLE IF EXISTS yoneticiler`);
        await pool.execute(`
            CREATE TABLE yoneticiler (
                yonetici_id INT AUTO_INCREMENT PRIMARY KEY,
                restoran_id INT NULL,
                ad VARCHAR(100) NOT NULL,
                soyad VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                sifre VARCHAR(255) NOT NULL,
                telefon VARCHAR(20),
                oturum_aktif TINYINT(1) DEFAULT 0,
                olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const [result] = await pool.execute(
            `INSERT INTO yoneticiler 
            (ad, soyad, email, sifre, telefon, oturum_aktif) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            ['Admin', 'Kullanıcı', 'admin@restoran.com', hashedPassword, '5551234567', 0]
        );

        res.json({
            success: true,
            message: 'Test yönetici oluşturuldu',
            email: 'admin@restoran.com',
            password: 'admin123'
        });
    } catch (error) {
        console.error('Test yönetici oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası', details: error.message });
    }
});

// Debug endpoint
app.post('/api/debug', (req, res) => {
    console.log('Debug endpoint çağrıldı');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    res.json({ success: true, message: 'Debug endpoint çalışıyor', body: req.body });
});

// ==================== STATIC ROUTES ====================



// Admin paneli
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// HTML sayfası (kullanıcı görsün diye)
app.get('/menu/:qrKodu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'restoran.html'));
});
// Menü verilerini getiren endpoint
app.get('/api/restoran-menu/:qrKodu', async (req, res) => {
  const qrKodu = req.params.qrKodu;

  try {
    // 1. QR koduna göre restoranı bul
    const [restoranResult] = await pool.query(
      'SELECT * FROM restoranlar WHERE qr_kodu = ?',
      [qrKodu]
    );

    if (restoranResult.length === 0) {
      return res.status(404).json({ error: 'Restoran bulunamadı' });
    }

    const restoran = restoranResult[0];

    // 2. Restoranın kategorilerini al
    const [kategoriResult] = await pool.query(
      'SELECT * FROM kategoriler WHERE restoran_id = ? AND aktif = 1 ORDER BY kategori_sira ASC',
      [restoran.restoran_id]
    );

    // 3. Her kategori için ürünleri çek
    if (kategoriResult.length === 0) {
      return res.json({ restoran, kategoriler: [] });
    }

    const kategoriIDs = kategoriResult.map(k => k.kategori_id);
    const [urunResult] = await pool.query(
      'SELECT * FROM urunler WHERE kategori_id IN (?) AND aktif = 1 ORDER BY sira_no ASC',
      [kategoriIDs]
    );

    // Ürünleri kategorilere göre grupla
    const kategoriler = kategoriResult.map(kat => ({
      ...kat,
      urunler: urunResult.filter(u => u.kategori_id === kat.kategori_id)
    }));

    // 4. JSON olarak tüm veriyi dön
    return res.json({
      restoran,
      kategoriler
    });

  } catch (err) {
    console.error('Veritabanı hatası:', err);
    return res.status(500).json({ error: 'Veritabanı hatası' });
  }
});

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint bulunamadı' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});


// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// ==================== SERVER START ====================

// Veritabanı bağlantısını test et
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Veritabanı bağlantısı başarılı!');
        connection.release();
    } catch (error) {
        console.error('Veritabanı bağlantı hatası:', error.message);
    }
}

// Server başlatma
app.listen(PORT,'0.0.0.0',  () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`Admin Panel: http://localhost:${PORT}/admin`);
    
    
});