# Restoran QR Menü Admin Paneli

Modern ve kullanıcı dostu QR menü yönetim sistemi. Restoranlar için 3D model desteği, özelleştirilebilir temalar ve detaylı analitik raporlar sunar.

## Özellikler

- 🏪 **Restoran Yönetimi**: Restoran bilgileri, logo ve tema ayarları
- 📱 **QR Kod Sistemi**: Otomatik QR kod oluşturma ve yönetimi
- 🍽️ **Menü Yönetimi**: Kategori ve ürün ekleme/düzenleme
- 🎨 **3D Model Desteği**: Ürünler için GLB/GLTF formatında 3D modeller
- 🎨 **Tema Sistemi**: Özelleştirilebilir renk şemaları
- 👥 **Yönetici Yönetimi**: Çoklu yönetici desteği
- 📊 **Analitik**: QR tarama istatistikleri ve raporlar
- 🔐 **Güvenlik**: Şifreli kimlik doğrulama sistemi

## Teknolojiler

- **Backend**: Node.js, Express.js
- **Veritabanı**: MySQL
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Kimlik Doğrulama**: bcryptjs, express-session
- **QR Kod**: qrcode
- **3D Model**: GLB/GLTF format desteği

## Kurulum

### Gereksinimler

- Node.js (v14 veya üzeri)
- MySQL (v8.0 veya üzeri)
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın**
   ```bash
   git clone <repository-url>
   cd restoranadmin
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Veritabanını kurun**
   - MySQL'de `restoranarmenü` adında bir veritabanı oluşturun
   - Verdiğiniz SQL script'ini çalıştırın

4. **Çevre değişkenlerini ayarlayın**
   ```bash
   # config.env dosyasını düzenleyin
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=restoranarmenü
   DB_PORT=3306
   SESSION_SECRET=your_secret_key
   PORT=3000
   ```

5. **Uygulamayı başlatın**
   ```bash
   npm start
   # veya geliştirme modu için
   npm run dev
   ```

6. **Tarayıcıda açın**
   - Ana sayfa: http://localhost:3000
   - Admin paneli: http://localhost:3000/admin

## Kullanım

### İlk Kurulum

1. Admin paneline gidin
2. İlk yönetici hesabını oluşturun
3. Restoran bilgilerini girin
4. Kategoriler ve ürünler ekleyin
5. QR kodunuzu indirin ve masalara yerleştirin

### Restoran Yönetimi

- **Restoran Oluşturma**: Temel bilgiler, logo ve tema ayarları
- **QR Kod**: Otomatik oluşturulan QR kod ile menüye erişim
- **İstatistikler**: Tarama sayıları ve analitik raporlar

### Menü Yönetimi

- **Kategoriler**: Ürün grupları oluşturma ve sıralama
- **Ürünler**: Detaylı ürün bilgileri, fiyat ve 3D modeller
- **Özellikler**: Ürün varyasyonları (ekstra malzemeler, boyutlar)

### Tema Sistemi

- **Renk Şemaları**: Arkaplan, metin ve vurgu renkleri
- **Özelleştirme**: Restoran markasına uygun tasarım
- **Önizleme**: Canlı tema önizlemesi

## API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/login` - Giriş yapma
- `POST /api/auth/logout` - Çıkış yapma
- `GET /api/auth/check` - Oturum kontrolü

### Restoran
- `POST /api/restoran` - Restoran oluşturma
- `GET /api/restoran/:id` - Restoran bilgileri
- `PUT /api/restoran/:id` - Restoran güncelleme
- `GET /api/restoran/:id/stats` - İstatistikler

### Kategoriler
- `GET /api/kategori/restoran/:restoran_id` - Kategorileri listele
- `POST /api/kategori` - Kategori oluştur
- `PUT /api/kategori/:id` - Kategori güncelle
- `DELETE /api/kategori/:id` - Kategori sil

### Ürünler
- `GET /api/urun/kategori/:kategori_id` - Ürünleri listele
- `POST /api/urun` - Ürün oluştur
- `PUT /api/urun/:id` - Ürün güncelle
- `DELETE /api/urun/:id` - Ürün sil

### Temalar
- `GET /api/tema/restoran/:restoran_id` - Temaları listele
- `POST /api/tema` - Tema oluştur
- `PUT /api/tema/:id` - Tema güncelle
- `DELETE /api/tema/:id` - Tema sil

### Yöneticiler
- `GET /api/yonetici/restoran/:restoran_id` - Yöneticileri listele
- `POST /api/yonetici` - Yönetici oluştur
- `PUT /api/yonetici/:id` - Yönetici güncelle
- `DELETE /api/yonetici/:id` - Yönetici sil

## Veritabanı Yapısı

### Ana Tablolar
- `restoranlar` - Restoran bilgileri
- `kategoriler` - Menü kategorileri
- `urunler` - Ürün bilgileri (3D model desteği)
- `urun_ozellikleri` - Ürün varyasyonları
- `menu_temalari` - Tema ayarları
- `yoneticiler` - Yönetici hesapları
- `qr_loglari` - QR tarama kayıtları

## Güvenlik

- Şifreler bcrypt ile hashlenir
- Session tabanlı kimlik doğrulama
- SQL injection koruması
- XSS koruması
- CSRF koruması

## Geliştirme

### Proje Yapısı
```
restoranadmin/
├── config/
│   └── database.js
├── routes/
│   ├── auth.js
│   ├── restoran.js
│   ├── kategori.js
│   ├── urun.js
│   ├── tema.js
│   └── yonetici.js
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   └── admin.html
├── server.js
├── package.json
└── README.md
```

### Geliştirme Komutları
```bash
# Geliştirme sunucusu
npm run dev

# Production build
npm start

# Bağımlılıkları güncelle
npm update
```

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## İletişim

- Proje Sahibi: Büşra Baltacı
- Email: busrabaltaci04@gmail.com
- Proje Linki: https://github.com/busrabaltaci04/restoran-3d-menu

## Teşekkürler

- Font Awesome ikonları
- Express.js framework
- MySQL veritabanı
- QR kod kütüphanesi 