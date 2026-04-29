// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.apiBaseUrl = 'https://96ef1ce9d525.ngrok-free.app';
        this.fetchOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };
        
        const savedUser = localStorage.getItem('currentUser');
        this.currentUser = savedUser ? JSON.parse(savedUser) : null;
        this.currentRestoran = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupFileUploads();
        this.checkAuth();
        this.loadRestoranOptions()
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        };
    }

    async checkAuth() {
        try {
            console.log('Auth check başlatılıyor...');
            console.log('API URL:', `${this.apiBaseUrl}/api/auth/check`);
            
            const response = await fetch(`${this.apiBaseUrl}/api/auth/check`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Auth response:', data);

            if (data.authenticated) {
                this.currentUser = data.yonetici;
                localStorage.setItem('currentUser', JSON.stringify(data.yonetici));
                this.showAdminPanel();
                return true;
            } else {
                this.showLoginModal();
                return false;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            console.error('Error details:', error.message);
            this.showLoginModal();
            return false;
        }
    }

    showLoginModal() {
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
    }

    showAdminPanel() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
    }

    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = `${this.currentUser.ad} ${this.currentUser.soyad}`;
        }
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('.nav-link').dataset.section;
                this.navigateToSection(section);
            });
        });

        // Form events
        this.bindFormEvents();
    }

    bindFormEvents() {
        // Restoran form
        const restoranForm = document.getElementById('restoranFormElement');
        if (restoranForm) {
            restoranForm.onsubmit = (e) => {
                e.preventDefault();
                this.createRestoran();
            };
        }

        

        const urunForm = document.getElementById('urunFormElement');
if (urunForm) {
    urunForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const isEditMode = urunForm.dataset.editMode === 'true';
        const urunId = urunForm.dataset.editId;
        
        if (isEditMode && urunId) {
            this.updateUrun(urunId);
        } else {
            this.createUrun();
        }
    });
}

        // Tema form
        const temaForm = document.getElementById('temaFormElement');
        if (temaForm) {
            temaForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTema();
            });
        }

        // Profil form
        const profilForm = document.getElementById('profilFormElement');
        if (profilForm) {
            profilForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateProfil();
            });
        }

        // Şifre form
        const sifreForm = document.getElementById('sifreFormElement');
        if (sifreForm) {
            sifreForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }
    }

    async login() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: document.getElementById('email').value,
                    sifre: document.getElementById('password').value
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.yonetici;
                localStorage.setItem('currentUser', JSON.stringify(data.yonetici));
                this.showAdminPanel();
            } else {
                alert(data.error || 'Giriş başarısız');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Sunucuya bağlanılamadı');
        }
    }

    async logout() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = null;
                localStorage.removeItem('currentUser');
                this.showLoginModal();
                console.log('Çıkış başarılı');
            } else {
                alert('Çıkış yapılırken bir hata oluştu');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Çıkış yapılırken bir hata oluştu');
        }
    }

    async validateSession() {
        try {
            console.log('Session validation başlatılıyor...');
            console.log('API URL:', `${this.apiBaseUrl}/api/auth/validate-session`);
            
            const response = await fetch(`${this.apiBaseUrl}/api/auth/validate-session`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('Validate session response status:', response.status);

            if (response.status === 404) {
                console.error('Endpoint bulunamadı!');
                return false;
            }

            if (response.status === 405) {
                console.error('Yanlış HTTP methodu kullanıldı!');
                return false;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error text:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Validate session response data:', data);
            return data.valid;
        } catch (error) {
            console.error('Session validation error:', error);
            console.error('Error details:', error.message);
            return false;
        }
    }

    navigateToSection(section) {
        // Aktif nav link'ini güncelle
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Aktif content section'ı güncelle
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(section).classList.add('active');

        // Sayfa başlığını güncelle
        const titles = {
            dashboard: 'Dashboard',
            restoranlar: 'Restoranlarım',
            kategoriler: 'Kategoriler',
            urunler: 'Ürünler',
            temalar: 'Temalar',
            'qr-kodlar': 'QR Kodlar',
            profil: 'Profil'
        };
        document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

        // Section'a özel yükleme
        this.loadSection(section);
    }

    loadSection(section) {
        switch(section) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'restoranlar':
                this.loadRestoranlar();
                break;
            case 'kategoriler':
                this.loadKategoriler();
                break;
            case 'urunler':
                this.loadUrunler();
                break;
            case 'temalar':
                this.loadTemalar();
                break;
            case 'qr-kodlar':
                this.loadQRKodlar();
                break;
            case 'profil':
                this.loadProfil();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/dashboard`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });
            const data = await response.json();
            
            document.getElementById('restoranSayisi').textContent = data.restoranSayisi || 0;
            document.getElementById('kategoriSayisi').textContent = data.kategoriSayisi || 0;
            document.getElementById('urunSayisi').textContent = data.urunSayisi || 0;
            document.getElementById('qrSayisi').textContent = data.qrSayisi || 0;
            
            // Son aktiviteler
            const activitiesDiv = document.getElementById('recentActivities');
            if (data.aktiviteler && data.aktiviteler.length > 0) {
                activitiesDiv.innerHTML = data.aktiviteler.map(activity => 
                    `<div class="activity-item">
                        <i class="fas fa-clock"></i>
                        <span>${activity.aciklama}</span>
                        <small>${activity.tarih}</small>
                    </div>`
                ).join('');
            } else {
                activitiesDiv.innerHTML = '<p>Henüz aktivite bulunmuyor.</p>';
            }
        } catch (error) {
            console.error('Dashboard yükleme hatası:', error);
        }
    }

    async createRestoran() {
        try {
            if (!this.currentUser) {
                console.error('Oturum bulunamadı');
                this.showLoginModal();
                return;
            }

            const form = document.getElementById('restoranFormElement');
            const formData = new FormData(form);

            // Seçili kategorileri ekle
            const selectedKategoriler = this.getSelectedKategoriler();
            formData.append('kategoriler', JSON.stringify(selectedKategoriler));

            // Form verilerini debug et
            console.log('Form element:', form);
            console.log('Form data entries:');
            for (let [key, value] of formData.entries()) {
                console.log(`${key}: ${value}`);
            }

            // Session'ı doğrula
            const isSessionValid = await this.validateSession();
            if (!isSessionValid) {
                console.error('Session geçersiz');
                this.showLoginModal();
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/restoran`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                
                if (response.status === 401) {
                    localStorage.removeItem('currentUser');
                    this.currentUser = null;
                    this.showLoginModal();
                    return;
                }
                throw new Error(errorData.error || 'Server error');
            }

            const data = await response.json();
            console.log('Restoran create response:', data);

            if (data.success) {
                alert('Restoran başarıyla oluşturuldu!');
                this.hideForm('restoranForm');
                await this.loadRestoranlar();
            } else {
                alert(data.error || 'Restoran oluşturulurken hata oluştu');
            }
        } catch (error) {
            console.error('Restoran oluşturma hatası:', error);
            alert('Restoran oluşturulurken hata oluştu');
        }
    }

    // Restoran düzenleme
    async editRestoran(restoranId) {
        try {
            console.log('editRestoran çağrıldı, restoranId:', restoranId);
            // Restoran bilgilerini getir
            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });

            console.log('API response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Restoran bilgileri alınamadı');
            }

            const data = await response.json();
            console.log('API response data:', data);
            const restoran = data.restoran;

            // Form alanlarını doldur
            console.log('Form alanları dolduruluyor...');
            const restoranAdiElement = document.getElementById('restoranAdi');
            const restoranAciklamaElement = document.getElementById('restoranAciklama');
            const restoranTemaElement = document.getElementById('restoranTema');
            
            console.log('Form elementleri:', {
                restoranAdi: restoranAdiElement,
                restoranAciklama: restoranAciklamaElement,
                restoranTema: restoranTemaElement
            });
            
            if (restoranAdiElement) restoranAdiElement.value = restoran.restoran_adi;
            if (restoranAciklamaElement) restoranAciklamaElement.value = restoran.restoran_aciklama || '';
            if (restoranTemaElement) restoranTemaElement.value = restoran.restoran_tema || 'light';

            // Mevcut logo varsa göster
            if (restoran.restoran_logo) {
                const logoPreview = document.getElementById('logoPreview');
                logoPreview.innerHTML = `<img src="${this.apiBaseUrl}${restoran.restoran_logo}" alt="Mevcut Logo" style="max-width: 100px; height: auto;">`;
                document.getElementById('logoFileName').textContent = 'Mevcut logo korunacak';
            }

            // Form'u düzenleme moduna al
            console.log('Form düzenleme moduna alınıyor...');
            const form = document.getElementById('restoranFormElement');
            console.log('Form elementi:', form);
            
            if (form) {
                form.dataset.editMode = 'true';
                form.dataset.editId = restoranId;

                // Submit event'ini güncelle
                form.onsubmit = (e) => {
                    e.preventDefault();
                    console.log('Edit mode: Güncelleme çağrılıyor, restoranId:', restoranId);
                    this.updateRestoran(restoranId);
                };

                // Form başlığını güncelle
                const titleElement = document.querySelector('#restoranForm .form-content h3');
                if (titleElement) titleElement.textContent = 'Restoran Düzenle';
                
                // Buton metnini güncelle
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Güncelle';

                // Formu göster
                console.log('Form gösteriliyor...');
                this.showForm('restoranForm');
            } else {
                console.error('Form elementi bulunamadı!');
            }

        } catch (error) {
            console.error('Restoran düzenleme hatası:', error);
            alert('Restoran bilgileri alınırken hata oluştu');
        }
    }

    // Restoran güncelleme
    async updateRestoran(restoranId) {
        try {
            console.log('updateRestoran çağrıldı, restoranId:', restoranId);
            const form = document.getElementById('restoranFormElement');
            const formData = new FormData(form);

            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}`, {
                method: 'PUT',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Güncelleme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert('Restoran başarıyla güncellendi!');
                this.hideForm('restoranForm');
                this.resetEditMode();
                await this.loadRestoranlar();
            } else {
                alert(data.error || 'Restoran güncellenirken hata oluştu');
            }
        } catch (error) {
            console.error('Restoran güncelleme hatası:', error);
            alert('Restoran güncellenirken hata oluştu');
        }
    }

    // Düzenleme modunu sıfırla
    resetEditMode() {
        const form = document.getElementById('restoranFormElement');
        delete form.dataset.editMode;
        delete form.dataset.editId;
        
        // Submit event'ini geri al
        form.onsubmit = (e) => {
            e.preventDefault();
            console.log('Create mode: Yeni restoran oluşturuluyor');
            this.createRestoran();
        };

        // Form başlığını geri al
        document.querySelector('#restoranForm .form-content h3').textContent = 'Restoran Ekle/Düzenle';
        
        // Buton metnini geri al
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Kaydet';
    }

    // Restoran aktif/pasif yapma
    async toggleRestoran(restoranId) {
        try {
            if (!confirm('Restoran durumunu değiştirmek istediğinizden emin misiniz?')) {
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}/toggle`, {
                method: 'PATCH',
                credentials: 'include',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Durum değiştirme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                await this.loadRestoranlar(); // Listeyi yenile
            } else {
                alert(data.error || 'Durum değiştirilirken hata oluştu');
            }
        } catch (error) {
            console.error('Restoran durum değiştirme hatası:', error);
            alert('Restoran durumu değiştirilirken hata oluştu');
        }
    }

    // Restoran silme
    async deleteRestoran(restoranId) {
        try {
            if (!confirm('Bu restoranı silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve tüm kategoriler, ürünler ve QR kodları da silinecektir.')) {
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Silme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert('Restoran başarıyla silindi!');
                await this.loadRestoranlar(); // Listeyi yenile
            } else {
                alert(data.error || 'Restoran silinirken hata oluştu');
            }
        } catch (error) {
            console.error('Restoran silme hatası:', error);
            alert('Restoran silinirken hata oluştu');
        }
    }

    // QR Kod görüntüleme
    async viewQRCode(restoranId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}/qr`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error('QR kod alınamadı');
            }
            
            const data = await response.json();
            
            // QR kod modal'ı göster
            this.showQRModal(data.qr_image, data.qr_url);
        } catch (error) {
            console.error('QR kod görüntüleme hatası:', error);
            alert('QR kod görüntülenirken hata oluştu');
        }
    }

    // QR Modal göster
    showQRModal(qrImage, qrUrl) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content qr-modal">
                <h3><i class="fas fa-qrcode"></i> QR Kod</h3>
                <div class="qr-content">
                    <img src="${qrImage}" alt="QR Kod" style="max-width: 300px; width: 100%;">
                    <p><strong>QR URL:</strong> <a href="${qrUrl}" target="_blank">${qrUrl}</a></p>
                </div>
                <div class="form-actions">
                    <button onclick="this.closest('.modal').remove()" class="btn-secondary">Kapat</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Kategori oluşturma
    async createKategori() {
        console.log('createKategori çağrıldı');
        try {
            const restoranId = document.getElementById('restoranSelect').value;
            if (!restoranId) {
                alert('Lütfen önce bir restoran seçin!');
                return;
            }

            const formData = {
                restoran_id: restoranId,
                kategori_adi: document.getElementById('kategoriAdi').value,
                kategori_sira: document.getElementById('kategoriSira').value
            };

            const response = await fetch(`${this.apiBaseUrl}/api/kategori`, {
                method: 'POST',
                ...this.fetchOptions,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Kategori başarıyla oluşturuldu!');
                this.hideForm('kategoriForm');
                this.loadKategoriler();
            } else {
                alert(data.error || 'Kategori oluşturulurken hata oluştu');
            }
        } catch (error) {
            console.error('Kategori oluşturma hatası:', error);
            alert('Kategori oluşturulurken hata oluştu');
        }
    }

async createUrun() {
    try {
        // 1. Kategori validasyonu
        const kategoriSelect = document.getElementById('kategoriSelectUrun');
        if (!kategoriSelect) {
            throw new Error("Kategori seçim elementi bulunamadı");
        }
        
        const kategoriId = kategoriSelect.value;
        if (!kategoriId) {
            alert('Lütfen bir kategori seçin!');
            return;
        }

        // 2. Form verilerini hazırla
        const form = document.getElementById('urunFormElement');
        if (!form) {
            throw new Error("Form elementi bulunamadı");
        }

        const formData = new FormData(form);
        
        // 3. Sayısal değerleri formatla
        const formatNumber = (value, defaultValue = 0) => {
            const num = parseFloat(value);
            return isNaN(num) ? defaultValue : num;
        };

        formData.set('kategori_id', kategoriId);
        formData.set('fiyat', formatNumber(formData.get('fiyat'), 0).toFixed(2));
        formData.set('sira_no', formatNumber(formData.get('sira_no'), 0));
        formData.set('model_olcek', formatNumber(formData.get('model_olcek'), 1.0));
        formData.set('model_rotasyon', formData.get('model_rotasyon') || '0,0,0');
        formData.set('stok_durumu', formatNumber(formData.get('stok_durumu'), 0));

        // 4. API isteği
        const response = await fetch(`${this.apiBaseUrl}/api/urun`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        // 5. Yanıt işleme
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // 6. Başarı durumu
        if (data.success) {
            alert('Ürün başarıyla oluşturuldu!');
            this.hideForm('urunForm');
            this.resetUrunForm(); // Hata yönetimi artık bu fonksiyonun içinde
            await this.loadUrunler();
        } else {
            throw new Error(data.error || 'Ürün oluşturulamadı');
        }
    } catch (error) {
        console.error('Ürün oluşturma hatası:', {
            message: error.message,
            stack: error.stack
        });
        alert(`Ürün oluşturulamadı: ${error.message}`);
    }
}
async editUrun(urunId) {
    try {
        // 1. Validasyonlar
        if (!urunId) {
            throw new Error("Ürün ID belirtilmedi");
        }
        
        console.log("Ürün Düzenleme Başlıyor. ID:", urunId);

        // 2. Loading state
        const formTitle = document.querySelector('#urunForm .form-title');
        if (formTitle) formTitle.textContent = "Yükleniyor...";

        // 3. API İsteği
        const response = await fetch(`${this.apiBaseUrl}/api/urun/${urunId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
        });

        // 4. HTTP Hata Kontrolleri
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("API Yanıtı:", data);

        // 5. Veri Validasyonu
        if (!data.success || !data.urun) {
            throw new Error(data.message || "Geçersiz ürün verisi");
        }

        // 6. Formu Doldur
        await this.fillUrunForm(data.urun);

        // 7. Formu Göster
        this.showForm('urunForm');
        console.log("Ürün formu başarıyla dolduruldu");

    } catch (error) {
        console.error("Ürün Düzenleme Hatası:", {
            error: error.message,
            stack: error.stack
        });
        
        alert(`Hata: ${error.message}\nDetaylar konsolda görüntülendi.`);
    }
}
async fillUrunForm(urun) {
    try {
        console.log("Ürün formu dolduruluyor:", urun);

        // 1. Form Elementlerini Seç (HTML yapınıza göre güncellendi)
        const getElement = (id) => document.getElementById(id) || console.warn(`Element bulunamadı: ${id}`);
        
        const elements = {
            urunAdi: getElement('urunAdi'),
            urunAciklama: getElement('urunAciklama'),
            urunFiyat: getElement('urunFiyat'),
            urunOlcek: getElement('urunOlcek'),
            urunRotasyon: getElement('urunRotasyon'),
            kategoriSelect: getElement('kategoriSelectUrun') // Eğer varsa
        };

        // 2. Değerleri Ata (HTML ID'lerine göre güncellendi)
        if (elements.urunAdi) elements.urunAdi.value = urun.urun_adi || '';
        if (elements.urunAciklama) elements.urunAciklama.value = urun.urun_aciklama || '';
        if (elements.urunFiyat) elements.urunFiyat.value = parseFloat(urun.fiyat || 0).toFixed(2);
        if (elements.urunOlcek) elements.urunOlcek.value = urun.model_olcek || '1.0';
        if (elements.urunRotasyon) elements.urunRotasyon.value = urun.model_rotasyon || '0,0,0';
        
        // 3. Dosya Önizlemeleri (HTML yapınıza göre güncellendi)
        const updateFileInfo = (fileNameId, previewId, url) => {
            const fileNameElement = getElement(fileNameId);
            const previewElement = getElement(previewId);
            
            if (fileNameElement) {
                fileNameElement.textContent = url ? url.split('/').pop() : 'Dosya seçilmedi';
            }
            
            if (previewElement) {
                if (url) {
                    if (previewId === 'gorselPreview') {
                        previewElement.innerHTML = `<img src="${this.apiBaseUrl}${url}" alt="Ürün Görseli" style="max-width:100px;">`;
                    } else {
                        // Model için bilgi gösterimi
                        previewElement.innerHTML = `
                            <div style="display:flex; align-items:center; gap:8px; color:#4CAF50;">
                                <i class="fas fa-check-circle"></i>
                                <span>3D Model Yüklü</span>
                            </div>
                        `;
                    }
                } else {
                    previewElement.innerHTML = '';
                }
            }
        };

        // Görsel ve model bilgilerini güncelle
        updateFileInfo('gorselFileName', 'gorselPreview', urun.gorsel_url);
        updateFileInfo('modelFileName', null, urun.model_url); // Model için preview alanı yoksa null

        // 4. Form Modunu ve Başlığını Ayarla
        const form = getElement('urunFormElement');
        if (form) {
            form.dataset.editMode = 'true';
            form.dataset.editId = urun.urun_id;

            const title = document.querySelector('#urunForm h3');
            if (title) title.textContent = `Ürün Düzenle: ${urun.urun_adi}`;
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Güncelle';
        }

        console.log("Form başarıyla dolduruldu:", {
            urunAdi: urun.urun_adi,
            gorsel: urun.gorsel_url,
            model: urun.model_url
        });

    } catch (error) {
        console.error("Form doldurma hatası:", {
            error: error.message,
            stack: error.stack,
            urunData: urun
        });
        alert("Ürün bilgileri yüklenirken hata oluştu");
    }
}
// Ürün güncelleme fonksiyonu
async updateUrun(urunId) {
    try {
        const form = document.getElementById('urunFormElement');
        const formData = new FormData(form);

        // Kategori ID'yi ekle
        const kategoriId = document.getElementById('kategoriSelectUrun').value;
        formData.set('kategori_id', kategoriId);

        const response = await fetch(`${this.apiBaseUrl}/api/urun/${urunId}`, {
            method: 'PUT',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Güncelleme hatası');
        }

        const data = await response.json();

        if (data.success) {
            alert('Ürün başarıyla güncellendi!');
            this.hideForm('urunForm');
            this.resetUrunForm();
            this.loadUrunler();
        } else {
            alert(data.error || 'Ürün güncellenirken hata oluştu');
        }
    } catch (error) {
        console.error('Ürün güncelleme hatası:', error);
        alert('Ürün güncellenirken hata oluştu: ' + error.message);
    }
}

resetUrunForm() {
    try {
        console.log("Form resetleme başlıyor...");
        
        // 1. Form elementini güvenli şekilde al
        const form = document.getElementById('urunFormElement');
        if (!form) {
            console.warn("Form elementi bulunamadı!");
            return;
        }

        // 2. Formu resetle
        form.reset();
        
        // 3. Düzenleme modunu kapat
        delete form.dataset.editMode;
        delete form.dataset.editId;
        
        // 4. Başlık ve buton metinlerini güncelle (null kontrolü ile)
        const safeSetText = (selector, text) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = text;
            else console.warn(`Element bulunamadı: ${selector}`);
        };

        safeSetText('#urunForm .form-title', 'Yeni Ürün Ekle');
        safeSetText('#urunForm button[type="submit"]', 'Kaydet');

        // 5. Önizlemeleri temizle
        const clearPreview = (previewId, fileNameId) => {
            const preview = document.getElementById(previewId);
            const fileName = document.getElementById(fileNameId);
            
            if (preview) preview.innerHTML = '';
            else console.warn(`Preview elementi bulunamadı: ${previewId}`);
            
            if (fileName) fileName.textContent = 'Dosya seçilmedi';
            else console.warn(`FileName elementi bulunamadı: ${fileNameId}`);
        };

        clearPreview('gorselPreview', 'gorselFileName');
        clearPreview('modelPreview', 'modelFileName');

        console.log("Form başarıyla resetlendi");
    } catch (error) {
        console.error("Form resetleme hatası:", error);
    }
}

    // Tema oluşturma
    async createTema() {
        try {
            const restoranId = document.getElementById('restoranSelectTema').value;
            if (!restoranId) {
                alert('Lütfen önce bir restoran seçin!');
                return;
            }

            const formData = {
                restoran_id: restoranId,
                tema_adi: document.getElementById('temaAdi').value,
                arkaplan_rengi: document.getElementById('arkaplanRengi').value,
                metin_rengi: document.getElementById('metinRengi').value,
                vurgu_rengi: document.getElementById('vurguRengi').value
            };

            const response = await fetch(`${this.apiBaseUrl}/api/tema`, {
                method: 'POST',
                ...this.fetchOptions,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Tema başarıyla oluşturuldu!');
                this.hideForm('temaForm');
                this.loadTemalar();
            } else {
                alert(data.error || 'Tema oluşturulurken hata oluştu');
            }
        } catch (error) {
            console.error('Tema oluşturma hatası:', error);
            alert('Tema oluşturulurken hata oluştu');
        }
    }

    // Profil güncelleme
    async updateProfil() {
        try {
            const formData = {
                ad: document.getElementById('profilAd').value,
                soyad: document.getElementById('profilSoyad').value,
                email: document.getElementById('profilEmail').value,
                telefon: document.getElementById('profilTelefon').value
            };

            const response = await fetch(`${this.apiBaseUrl}/api/yonetici/profil`, {
                method: 'PUT',
                ...this.fetchOptions,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Profil başarıyla güncellendi!');
                this.resetForm('profilFormElement');
                this.loadProfil();
            } else {
                alert(data.error || 'Profil güncellenirken hata oluştu');
            }
        } catch (error) {
            console.error('Profil güncelleme hatası:', error);
            alert('Profil güncellenirken hata oluştu');
        }
    }

    // Şifre değiştirme
    async changePassword() {
        try {
            const yeniSifre = document.getElementById('yeniSifre').value;
            const yeniSifreTekrar = document.getElementById('yeniSifreTekrar').value;

            // Şifre kontrolü
            if (yeniSifre !== yeniSifreTekrar) {
                alert('Yeni şifreler eşleşmiyor!');
                return;
            }

            const formData = {
                mevcut_sifre: document.getElementById('mevcutSifre').value,
                yeni_sifre: yeniSifre
            };

            const response = await fetch(`${this.apiBaseUrl}/api/yonetici/profil/sifre`, {
                method: 'PATCH',
                ...this.fetchOptions,
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Şifre başarıyla değiştirildi!');
                this.resetForm('sifreFormElement');
            } else {
                alert(data.error || 'Şifre değiştirilirken hata oluştu');
            }
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            alert('Şifre değiştirilirken hata oluştu');
        }
    }

    showForm(formId) {
        if (formId === 'restoranForm') {
            const form = document.getElementById('restoranFormElement');
            // Eğer form düzenleme modunda değilse sıfırla
            if (!form.dataset.editMode) {
                this.resetEditMode();
            }
            // Restoran seçeneklerini yükle
            this.loadRestoranOptions();
            // Kategorileri yükle
            this.loadKategorilerForRestoran();
        } else if (formId === 'kategoriForm') {
            // Kategori formu açıldığında restoranları yükle
            this.loadRestoranOptions();
            
            // Eğer düzenleme modunda değilse, restoran seçimini kontrol et
            const form = document.getElementById('kategoriFormElement');
            if (!form.dataset.editMode) {
                const restoranId = document.getElementById('restoranSelect').value;
                if (!restoranId) {
                    alert('Lütfen önce bir restoran seçin!');
                    this.hideForm('kategoriForm');
                    return;
                }
            }
        }
        document.getElementById(formId).style.display = 'flex';
    }

    resetForm(formId) {
        document.getElementById(formId).reset();
        const previews = document.querySelectorAll('.image-preview');
        previews.forEach(preview => {
            preview.innerHTML = '';
            preview.classList.add('empty');
        });
    }

    hideForm(formId) {
        document.getElementById(formId).style.display = 'none';
        this.resetForm(formId + 'Element');
        if (formId === 'restoranForm') {
            this.resetEditMode();
        }
    }

    // Restoranlar yükleme
    async loadRestoranlar() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/restoran`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            
            const listDiv = document.getElementById('restoranlarList');
            if (data.restoranlar && data.restoranlar.length > 0) {
                listDiv.innerHTML = data.restoranlar.map(restoran => `
                    <div class="restoran-card">
                        <div class="restoran-header">
                            <div class="restoran-logo">
                                ${restoran.restoran_logo ? 
                                    `<img src="${this.apiBaseUrl}${restoran.restoran_logo}" alt="${restoran.restoran_adi} Logo" onerror="this.style.display='none'">` : 
                                    `<div class="logo-placeholder">
                                        <i class="fas fa-store"></i>
                                    </div>`
                                }
                            </div>
                            <div class="restoran-status ${restoran.aktif ? 'active' : 'inactive'}">
                                <i class="fas fa-${restoran.aktif ? 'check-circle' : 'pause-circle'}"></i>
                                ${restoran.aktif ? 'Aktif' : 'Pasif'}
                            </div>
                        </div>
                        
                        <div class="restoran-content">
                            <h3 class="restoran-title">${restoran.restoran_adi}</h3>
                            <p class="restoran-description">${restoran.restoran_aciklama || 'Açıklama bulunmuyor'}</p>
                            
                            <div class="restoran-stats">
                                <div class="stat-item">
                                    <i class="fas fa-list"></i>
                                    <span>${restoran.kategori_sayisi || 0} Kategori</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-hamburger"></i>
                                    <span>${restoran.urun_sayisi || 0} Ürün</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-qrcode"></i>
                                    <span>QR Kod</span>
                                </div>
                            </div>
                            
                            <div class="restoran-meta">
                                <span class="creation-date">
                                    <i class="fas fa-calendar"></i>
                                    ${new Date(restoran.olusturulma_tarihi).toLocaleDateString('tr-TR')}
                                </span>
                                <span class="theme-badge ${restoran.restoran_tema || 'light'}">
                                    <i class="fas fa-palette"></i>
                                    ${restoran.restoran_tema === 'dark' ? 'Koyu' : 'Açık'} Tema
                                </span>
                            </div>
                        </div>
                        
                        <div class="restoran-actions">
                            <button onclick="adminPanel.viewQRCode(${restoran.restoran_id})" class="btn-action btn-qr" title="QR Kod Görüntüle">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button onclick="adminPanel.editRestoran(${restoran.restoran_id})" class="btn-action btn-edit" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="adminPanel.toggleRestoran(${restoran.restoran_id})" class="btn-action btn-toggle ${restoran.aktif ? 'btn-warning' : 'btn-success'}" title="${restoran.aktif ? 'Pasif Yap' : 'Aktif Yap'}">
                                <i class="fas fa-${restoran.aktif ? 'pause' : 'play'}"></i>
                            </button>
                            <button onclick="adminPanel.deleteRestoran(${restoran.restoran_id})" class="btn-action btn-delete" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                listDiv.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-store"></i>
                        </div>
                        <h3>Henüz Restoran Yok</h3>
                        <p>İlk restoranınızı oluşturmak için "Yeni Restoran" butonuna tıklayın.</p>
                        <button onclick="adminPanel.showForm('restoranForm')" class="btn-primary">
                            <i class="fas fa-plus"></i> İlk Restoranı Oluştur
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Restoranlar yükleme hatası:', error);
            const listDiv = document.getElementById('restoranlarList');
            listDiv.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Yükleme Hatası</h3>
                    <p>Restoranlar yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</p>
                </div>
            `;
        }
    }

    setupFileUploads() {
        // Logo yükleme
        document.getElementById('restoranLogo').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('logoFileName').textContent = file.name;
                this.previewImage(file, 'logoPreview');
            }
        });

        // Ürün görseli yükleme
        document.getElementById('urunGorsel').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('gorselFileName').textContent = file.name;
                this.previewImage(file, 'gorselPreview');
            }
        });

        // Model yükleme
        document.getElementById('urunModel').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('modelFileName').textContent = file.name;
            }
        });
    }

    // Resim önizleme fonksiyonu
    previewImage(file, previewElementId) {
        const preview = document.getElementById(previewElementId);
        preview.innerHTML = '';
        preview.classList.remove('empty');

        if (file.type.match('image.*')) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                preview.appendChild(img);
            }
            
            reader.readAsDataURL(file);
        } else {
            preview.classList.add('empty');
            preview.textContent = 'Geçersiz dosya formatı. Lütfen bir resim dosyası seçin.';
        }
    }

    // Form gönderiminde dosya işleme
    async handleFormSubmitWithFiles(formId, endpoint) {
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Form gönderim hatası:', error);
            throw error;
        }
    }

    // Kategoriler yükleme
    async loadKategoriler() {
        try {
            // Önce restoran seçeneklerini yükle
            
            
            const restoranId = document.getElementById('restoranSelect').value;
            if (!restoranId) {
                document.getElementById('kategorilerList').innerHTML = '<p>Lütfen önce bir restoran seçin.</p>';
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/kategori?restoran_id=${restoranId}`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });
            const data = await response.json();
            
            const listDiv = document.getElementById('kategorilerList');
            if (data.kategoriler && data.kategoriler.length > 0) {
                listDiv.innerHTML = data.kategoriler.map(kategori => `
                    <div class="card">
                        <div class="card-header">
                            <h4>${kategori.kategori_adi}</h4>
                        </div>
                        <div class="card-body">
                            <p>Sıra: ${kategori.kategori_sira}</p>
                            <p>Ürün Sayısı: ${kategori.urun_sayisi || 0}</p>
                        </div>
                        <div class="card-footer">
                            <button onclick="adminPanel.editKategori(${kategori.kategori_id})" class="btn-edit">Düzenle</button>
                            <button onclick="adminPanel.deleteKategori(${kategori.kategori_id})" class="btn-delete">Sil</button>
                        </div>
                    </div>
                `).join('');
            } else {
                listDiv.innerHTML = '<p>Bu restoran için kategori bulunmuyor.</p>';
            }
        } catch (error) {
            console.error('Kategoriler yükleme hatası:', error);
        }
    }

    async loadUrunler() {
        
    const kategoriId = document.getElementById('kategoriSelectUrun').value;
    if (!kategoriId) return;

    const urunlerList = document.getElementById('urunlerList');
    urunlerList.innerHTML = '<div class="loading-spinner"></div>';

    try {
        
        const response = await fetch(`${this.apiBaseUrl}/api/urun/kategori/${kategoriId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!data.success) return;

        urunlerList.innerHTML = ''; // Loading spinner'ı temizle

        data.urunler.forEach((urun, idx) => {
            const card = document.createElement('div');
            card.className = 'urun-card';
            card.innerHTML = `
                <div class="urun-card-inner">
                    <div class="urun-media">
                        <!-- Görsel ve Model Container -->
                        <div class="media-container">
                            <div class="urun-gorsel" style="background-image: url('${urun.gorsel_url || '/img/no-image.png'}')">
                                ${!urun.gorsel_url ? '<i class="fas fa-image no-image-icon"></i>' : ''}
                            </div>
                            <div class="urun-model-container" id="modelPreview-${urun.urun_id}">
                                ${!urun.model_url ? '<div class="no-model"><i class="fas fa-cube"></i><span>3D Model Yok</span></div>' : ''}
                            </div>
                        </div>
                        
                        <!-- Ürün Bilgileri -->
                        <div class="urun-info">
                            <div class="urun-header">
                                <h3 class="urun-title">${urun.urun_adi}</h3>
                                <div class="urun-fiyat">₺${parseFloat(urun.fiyat).toFixed(2)}</div>
                            </div>
                            
                            <div class="urun-aciklama">
                                <p>${urun.urun_aciklama || 'Açıklama bulunmamaktadır.'}</p>
                            </div>
                            
                            <div class="urun-meta">
                                <span class="urun-id">#${urun.urun_id}</span>
                                
                                    
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="urun-actions">
                        <button class="btn-action btn-edit" onclick="adminPanel.editUrun(${urun.urun_id})" title="Düzenle">
                            <i class="fas fa-edit"></i>
                            <span>Düzenle</span>
                        </button>
                        <button class="btn-action btn-delete" onclick="adminPanel.deleteUrun(${urun.urun_id})" title="Sil">
                            <i class="fas fa-trash-alt"></i>
                            <span>Sil</span>
                        </button>
                        <button class="btn-action btn-view" onclick="adminPanel.viewUrun(${urun.urun_id})" title="Detaylar">
                            <i class="fas fa-eye"></i>
                            <span>Detaylar</span>
                        </button>
                    </div>
                </div>
            `;
            urunlerList.appendChild(card);

            // 3D model önizlemesi ekle
            if (urun.model_url) {
                setTimeout(() => {
                    this.renderModelPreview(`modelPreview-${urun.urun_id}`, urun.model_url);
                }, 100);
            }
        });
    } catch (error) {
        urunlerList.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ürünler yüklenirken bir hata oluştu</p>
                <button class="btn-retry" onclick="adminPanel.loadUrunler()">Tekrar Dene</button>
            </div>
        `;
        console.error('Ürün yükleme hatası:', error);
    }
}

    renderModelPreview(containerId, modelUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.style.cursor = 'grab'; // Fare imleci değişimi

    // Sahne, kamera ve renderer oluşturma
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Işık ekleme
    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Model yükleme ve döndürme kontrolü
    let model;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let autoRotate = true;
    let rotationSpeed = 0.005;

    // Model yükleme
    const loader = new THREE.GLTFLoader();
    loader.load(modelUrl, function(gltf) {
        model = gltf.scene;
        scene.add(model);

        // Modelin sınırlarını hesapla
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        // Modeli merkeze taşı
        model.position.x += (model.position.x - center.x);
        model.position.y += (model.position.y - center.y);
        model.position.z += (model.position.z - center.z);

        // Kamerayı model boyutuna göre ayarla
        camera.position.z = size * 1.5;
        camera.lookAt(center);

        // Otomatik ölçeklendirme
        const scale = Math.min(
            1.0, 
            container.clientWidth / (size * 2),
            container.clientHeight / (size * 2)
        );
        model.scale.set(scale, scale, scale);

        // Fare olayları
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            autoRotate = false;
            container.style.cursor = 'grabbing';
            previousMousePosition = { 
                x: e.clientX || e.touches[0].clientX, 
                y: e.clientY || e.touches[0].clientY 
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const mouseX = e.clientX || e.touches[0].clientX;
            const mouseY = e.clientY || e.touches[0].clientY;
            
            const deltaMove = {
                x: mouseX - previousMousePosition.x,
                y: mouseY - previousMousePosition.y
            };
            
            model.rotation.y += deltaMove.x * 0.01;
            model.rotation.x += deltaMove.y * 0.01;
            
            previousMousePosition = { x: mouseX, y: mouseY };
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = 'grab';
            // 2 saniye hareketsiz kalırsa otomatik dönmeye devam et
            setTimeout(() => {
                if (!isDragging) autoRotate = true;
            }, 2000);
        });

        // Dokunmatik ekran desteği
        container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            autoRotate = false;
            previousMousePosition = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const deltaMove = {
                x: e.touches[0].clientX - previousMousePosition.x,
                y: e.touches[0].clientY - previousMousePosition.y
            };
            
            model.rotation.y += deltaMove.x * 0.01;
            model.rotation.x += deltaMove.y * 0.01;
            
            previousMousePosition = { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY 
            };
        }, { passive: false });

        document.addEventListener('touchend', () => {
            isDragging = false;
            setTimeout(() => {
                if (!isDragging) autoRotate = true;
            }, 2000);
        });

        // Animasyon fonksiyonu
        function animate() {
            requestAnimationFrame(animate);
            
            // Otomatik döndürme
            if (autoRotate && !isDragging) {
                model.rotation.y += rotationSpeed;
            }
            
            renderer.render(scene, camera);
        }
        animate();

        // Pencere boyutu değiştiğinde ayarlamaları yap
        window.addEventListener('resize', function() {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });

    }, undefined, function(error) {
        console.error('GLB model yüklenemedi:', error);
        container.innerHTML = '<span style="color:red;">Model yüklenemedi.</span>';
    });
}
    // QR Kodlar yükleme
    async loadQRKodlar() {
        try {
            const restoranId = document.getElementById('restoranSelectQR').value;
            if (!restoranId) {
                document.getElementById('qrKodlarList').innerHTML = '<p>Lütfen önce bir restoran seçin.</p>';
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/restoran/${restoranId}/qr`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });
            const data = await response.json();
            
            const listDiv = document.getElementById('qrKodlarList');
            if (data.qr_kod) {
                listDiv.innerHTML = `
                    <div class="qr-card">
                        <div class="qr-info">
                            <h4>QR Kod</h4>
                            <p>Kod: ${data.qr_kod}</p>
                            <p>URL: ${data.qr_url}</p>
                        </div>
                        <div class="qr-image">
                            <img src="${data.qr_image}" alt="QR Kod" />
                        </div>
                        <div class="qr-actions">
                            <button onclick="adminPanel.downloadQR('${data.qr_kod}')" class="btn-primary">
                                <i class="fas fa-download"></i> İndir
                            </button>
                            <button onclick="adminPanel.regenerateQR(${restoranId})" class="btn-warning">
                                <i class="fas fa-sync"></i> Yenile
                            </button>
                        </div>
                    </div>
                `;
            } else {
                listDiv.innerHTML = '<p>Bu restoran için QR kod bulunamadı.</p>';
            }
        } catch (error) {
            console.error('QR Kodlar yükleme hatası:', error);
        }
    }

    // Profil yükleme
    async loadProfil() {
        if (this.currentUser) {
            document.getElementById('profilAd').value = this.currentUser.ad || '';
            document.getElementById('profilSoyad').value = this.currentUser.soyad || '';
            document.getElementById('profilEmail').value = this.currentUser.email || '';
            document.getElementById('profilTelefon').value = this.currentUser.telefon || '';
        }
    }

    // Restoran seçeneklerini yükleme
    async loadRestoranOptions() {
        try {
            console.log('loadRestoranOptions çağrıldı');
            const response = await fetch(`${this.apiBaseUrl}/api/restoran`, {
                ...this.fetchOptions,
                method: 'GET'
            });
            const data = await response.json();
            console.log('Restoran verileri:', data);
            
            const selects = ['restoranSelect', 'restoranSelectUrun', 'restoranSelectTema', 'restoranSelectQR', 'restoranSelectKategori'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                console.log(`${selectId} elementi:`, select);
                if (select) {
                    // SEÇİLİ RESTORANI KORU
                    const prevValue = select.value;
                    select.innerHTML = '<option value="">Restoran Seçin</option>';
                    if (data.restoranlar) {
                        data.restoranlar.forEach(restoran => {
                            select.innerHTML += `<option value="${restoran.restoran_id}">${restoran.restoran_adi}</option>`;
                        });
                        console.log(`${selectId} güncellendi, ${data.restoranlar.length} restoran eklendi`);
                    }
                    // YENİDEN SEÇİLİ YAP
                    if (prevValue) select.value = prevValue;
                }
            });
        } catch (error) {
            console.error('Restoran seçenekleri yükleme hatası:', error);
        }
    }

    // Kategori seçeneklerini yükleme (ürünler için)
    async loadKategorilerForUrun() {
        try {
            const restoranId = document.getElementById('restoranSelectUrun').value;
            if (!restoranId) {
                document.getElementById('kategoriSelectUrun').innerHTML = '<option value="">Kategori Seçin</option>';
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/kategori?restoran_id=${restoranId}`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });
            const data = await response.json();
            
            const select = document.getElementById('kategoriSelectUrun');
            select.innerHTML = '<option value="">Kategori Seçin</option>';
            if (data.kategoriler) {
                data.kategoriler.forEach(kategori => {
                    select.innerHTML += `<option value="${kategori.kategori_id}">${kategori.kategori_adi}</option>`;
                });
            }
        } catch (error) {
            console.error('Kategori seçenekleri yükleme hatası:', error);
        }
    }

    // Dashboard yüklendiğinde restoran seçeneklerini de yükle
    async loadDashboard() {
        await this.loadRestoranOptions();
        // ... mevcut dashboard yükleme kodu
    }

    // Kategori seçme fonksiyonları
    async loadKategorilerForRestoran() {
        try {
            const restoranId = document.getElementById('restoranSelectKategori').value;
            if (!restoranId) {
                const kategoriList = document.getElementById('kategoriList');
                if (kategoriList) {
                    kategoriList.innerHTML = '<p>Önce bir restoran seçin</p>';
                }
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/kategori?restoran_id=${restoranId}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            
            const kategoriList = document.getElementById('kategoriList');
            if (kategoriList) {
                if (data.kategoriler && data.kategoriler.length > 0) {
                    kategoriList.innerHTML = data.kategoriler.map(kategori => `
                        <div class="kategori-item" data-kategori-id="${kategori.kategori_id}">
                            <div class="kategori-info">
                                <input type="checkbox" id="kategori_${kategori.kategori_id}" value="${kategori.kategori_id}">
                                <span class="kategori-name">${kategori.kategori_adi}</span>
                            </div>
                            <button type="button" class="kategori-remove" onclick="adminPanel.removeKategoriFromRestoran(${kategori.kategori_id})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('');
                } else {
                    kategoriList.innerHTML = '<p>Bu restoran için kategori bulunamadı</p>';
                }
            }
        } catch (error) {
            console.error('Kategoriler yükleme hatası:', error);
        }
    }

    addKategoriToRestoran() {
        const kategoriList = document.getElementById('kategoriList');
        const kategoriName = prompt('Kategori adını girin:');
        
        if (kategoriName && kategoriName.trim()) {
            const kategoriId = Date.now(); // Geçici ID
            const kategoriItem = document.createElement('div');
            kategoriItem.className = 'kategori-item';
            kategoriItem.dataset.kategoriId = kategoriId;
            kategoriItem.innerHTML = `
                <div class="kategori-info">
                    <input type="checkbox" id="kategori_${kategoriId}" value="${kategoriId}" checked>
                    <span class="kategori-name">${kategoriName}</span>
                </div>
                <button type="button" class="kategori-remove" onclick="adminPanel.removeKategoriFromRestoran(${kategoriId})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            kategoriList.appendChild(kategoriItem);
        }
    }

    removeKategoriFromRestoran(kategoriId) {
        const kategoriItem = document.querySelector(`[data-kategori-id="${kategoriId}"]`);
        if (kategoriItem) {
            kategoriItem.remove();
        }
    }

    getSelectedKategoriler() {
        const checkboxes = document.querySelectorAll('#kategoriList input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    // Kategori düzenleme
    async editKategori(kategoriId) {
        try {
            console.log('editKategori çağrıldı, kategoriId:', kategoriId);
            
            const response = await fetch(`${this.apiBaseUrl}/api/kategori/${kategoriId}`, {
                method: 'GET',
                credentials: 'include',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error('Kategori bilgileri alınamadı');
            }

            const data = await response.json();
            const kategori = data.kategori;

            // Form alanlarını doldur
            document.getElementById('kategoriAdi').value = kategori.kategori_adi;
            document.getElementById('kategoriSira').value = kategori.kategori_sira || 0;
            
            // Restoran seçimini gizle
            const restoranSelect = document.getElementById('restoranSelect');
            if (restoranSelect) {
                restoranSelect.style.display = 'none';
            }

            // Form'u düzenleme moduna al
            const form = document.getElementById('kategoriFormElement');
            form.dataset.editMode = 'true';
            form.dataset.editId = kategoriId;

            // Form submit event'ini güncelle
            form.onsubmit = (e) => {
                e.preventDefault();
                this.updateKategori(kategoriId);
            };

            // Form başlığını ve buton metnini güncelle
            document.querySelector('#kategoriForm .form-content h3').textContent = 'Kategori Düzenle';
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Güncelle';

            this.showForm('kategoriForm');

        } catch (error) {
            console.error('Kategori düzenleme hatası:', error);
            alert('Kategori bilgileri alınırken hata oluştu');
        }
    }

    // Kategori güncelleme
    async updateKategori(kategoriId) {
        try {
            const kategoriAdi = document.getElementById('kategoriAdi').value;
            // Sıra no için varsayılan değer 0 kullan
            const kategoriSira = parseInt(document.getElementById('kategoriSira').value) || 0;

            console.log('Gönderilecek veriler:', {
                kategori_adi: kategoriAdi,
                kategori_sira: kategoriSira
            });

            const response = await fetch(`${this.apiBaseUrl}/api/kategori/${kategoriId}`, {
                method: 'PUT',
                ...this.fetchOptions,
                body: JSON.stringify({
                    kategori_adi: kategoriAdi,
                    kategori_sira: kategoriSira
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Güncelleme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert('Kategori başarıyla güncellendi!');
                this.hideForm('kategoriForm');
                this.resetKategoriEditMode();
                await this.loadKategoriler();
            } else {
                alert(data.error || 'Kategori güncellenirken hata oluştu');
            }
        } catch (error) {
            console.error('Kategori güncelleme hatası:', error);
            alert('Kategori güncellenirken hata oluştu');
        }
    }
    
    resetKategoriEditMode() {
        const form = document.getElementById('kategoriFormElement');
        
        // Edit modunu kaldır
        delete form.dataset.editMode;
        delete form.dataset.editId;

        // Form submit event'ini sıfırla
        form.onsubmit = (e) => {
            e.preventDefault();
            this.createKategori();
        };

        // Başlık ve buton metnini sıfırla
        document.querySelector('#kategoriForm .form-content h3').textContent = 'Yeni Kategori';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Kaydet';

        // Form alanlarını temizle
        form.reset();

        // Restoran select alanını göster
        const restoranSelect = document.getElementById('restoranSelect');
        if (restoranSelect) {
            restoranSelect.style.display = 'block';
        }
    }
    
    // Ürün silme
    async deleteUrun(urunId) {
        try {
            if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.')) {
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/urun/${urunId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Silme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert('Ürün başarıyla silindi!');
                await this.loadUrunler();
            } else {
                alert(data.error || 'Ürün silinirken hata oluştu');
            }
        } catch (error) {
            console.error('Ürün silme hatası:', error);
            alert('Ürün silinirken hata oluştu');
        }
    }


    // Kategori silme
    async deleteKategori(kategoriId) {
        try {
            if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz ve tüm ürünler de silinecektir.')) {
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/api/kategori/${kategoriId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Silme hatası');
            }

            const data = await response.json();

            if (data.success) {
                alert('Kategori başarıyla silindi!');
                await this.loadKategoriler(); // Listeyi yenile
            } else {
                alert(data.error || 'Kategori silinirken hata oluştu');
            }
        } catch (error) {
            console.error('Kategori silme hatası:', error);
            alert('Kategori silinirken hata oluştu');
        }
    }


    
}
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebarOverlay = document.querySelector('.sidebar-overlay') || document.createElement('div');
    
    // Eğer overlay yoksa oluşturalım
    if (!document.querySelector('.sidebar-overlay')) {
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
    }

    // Menü toggle fonksiyonu
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        document.body.classList.toggle('no-scroll');
    }

    // Menü butonuna tıklama
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Event bubbling'i engelle
        toggleSidebar();
    });

    // Overlay'e tıklama
    sidebarOverlay.addEventListener('click', function(e) {
        // Sadece overlay aktifken kapatma işlemi yap
        if (sidebarOverlay.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // Dokümana tıklayarak menüyü kapatma
    document.addEventListener('click', function(e) {
        // Eğer tıklanan element sidebar veya içindeki bir element değilse ve sidebar aktifse
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target) && 
            sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // ESC tuşuyla kapatma
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // Ekran boyutu değiştiğinde kontrol
    window.addEventListener('resize', function() {
        if (window.innerWidth > 992) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    });
});

// Admin panel instance'ı oluştur
let adminPanel;

// DOM yüklendiğinde admin panel'i başlat
document.addEventListener('DOMContentLoaded', function() {
    adminPanel = new AdminPanel();
    // Global olarak erişilebilir yap
    window.adminPanel = adminPanel;
});