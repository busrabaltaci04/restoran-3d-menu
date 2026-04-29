document.addEventListener('DOMContentLoaded', function () {
    const menuContainer = document.getElementById('menu-container');
    const kategoriNav = document.getElementById('kategori-nav');
    const statusElement = document.getElementById('status');
    const restoranAdiElement = document.getElementById('restoran-adi');
    const restoranAciklamaElement = document.getElementById('restoran-aciklama');
    const restoranLogoElement = document.getElementById('restoran-logo');
    const arInfoElement = document.querySelector('.ar-info');

    // WebXR desteğini bilgilendir (fallback ile devam edebiliriz, erken çıkma yok)
    if (!navigator.xr) {
        statusElement.textContent = "Cihazınızda WebXR yok. Kamera ile QR üstü AR moduna geçilecek.";
        statusElement.style.display = "block";
    }

// Markerless-lite: ARCore/WebXR olmadan, kamerayı arka plan yapıp modeli ekrana dokunarak yerleştir.
// Özellikler: tek/double tap ile yerleştir, sürükle-döndür-zoom, cihaz eğimine göre hafif parallax.
async function startMarkerlessLiteMode(modelUrl) {
    const menu = document.getElementById('menu-container');
    const nav = document.getElementById('kategori-nav');
    const header = document.querySelector('header');
    let arContainer = document.getElementById('ar-container');
    if (!arContainer) {
        arContainer = document.createElement('div');
        arContainer.id = 'ar-container';
        // Stil atamalarını CSS'e bırak (restoranStyless.css -> #ar-container)
        document.body.appendChild(arContainer);
    }
    const statusElement = document.getElementById('status');

    document.body.classList.add('ar-active');
    if (menu) menu.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (header) header.style.display = 'none';
    arContainer.style.display = 'block';
    arContainer.innerHTML = '';

    // Güvenli bağlam şartı
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        if (statusElement) {
            statusElement.textContent = 'Kamera erişimi için HTTPS gereklidir. Lütfen güvenli bağlantı üzerinden deneyin.';
            statusElement.style.display = 'block';
        }
        // UI geri yükle
        if (menu) menu.style.display = 'grid';
        if (nav) nav.style.display = 'flex';
        if (header) header.style.display = '';
        document.body.classList.remove('ar-active');
        return;
    }

    // Kamera arka planı
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    arContainer.appendChild(video);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'absolute';
    canvas.style.left = 0;
    canvas.style.top = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    arContainer.appendChild(canvas);

    // Exit butonu
    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Çık';
    exitBtn.className = 'exit-ar-button';
    // Konum ve görünüm restoranStyless.css'deki .exit-ar-button tarafından yönetilir
    arContainer.appendChild(exitBtn);

    // İpucu bandı
    if (statusElement) {
        statusElement.textContent = 'Ekrana dokunarak modeli yerleştirin. İki parmakla büyütüp döndürebilirsiniz.';
        statusElement.style.display = 'block';
    }

    // Kamera başlatıcı (QR modundakiyle aynı mantık)
    async function getBestCameraStream() {
        try { return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
        catch (err1) {
            try { return await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
            catch (err2) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videos = devices.filter(d => d.kind === 'videoinput');
                let rear = videos.find(d => /back|rear|environment/i.test(d.label));
                if (!rear && videos.length > 0) rear = videos[videos.length - 1];
                if (!rear) throw err2 || err1;
                return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: rear.deviceId } }, audio: false });
            }
        }
    }

    // Kullanıcı jesti için buton
    const startCamBtn = document.createElement('button');
    startCamBtn.textContent = 'Kamerayı Başlat';
    startCamBtn.className = 'exit-ar-button';
    // Ortalamayı inline bırakıyoruz, görünümü CSS yönetiyor
    startCamBtn.style.position = 'absolute';
    startCamBtn.style.left = '50%';
    startCamBtn.style.top = '50%';
    startCamBtn.style.transform = 'translate(-50%, -50%)';
    startCamBtn.style.zIndex = '10000';
    arContainer.appendChild(startCamBtn);

    let stream;
    async function startCamera(flow) {
        try {
            stream = await getBestCameraStream();
            video.srcObject = stream;
            try { await video.play(); if (startCamBtn.parentElement) startCamBtn.remove(); } catch (_) {}
        } catch (e) {
            console.error('[Markerless] getUserMedia hatası:', e);
            if (statusElement) {
                statusElement.textContent = 'Kamera açılamadı: ' + (e && e.message ? e.message : 'Bilinmeyen hata');
                statusElement.style.display = 'block';
            }
        }
    }
    startCamera('auto');
    startCamBtn.addEventListener('click', () => startCamera('user'));

    function resize() {
        const w = arContainer.clientWidth;
        const h = arContainer.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Snapshot renderer ve model yükleme
    let snapRenderer = null, snapScene = null, snapCamera = null, snapModel = null;
    try {
        if (!window.THREE) { try { await loadScript('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'); } catch (_) {} }
        if (window.THREE && !THREE.GLTFLoader) { try { await loadScript('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js'); } catch (_) {} }
        if (window.THREE && THREE.GLTFLoader) {
            const snapshotSize = 256;
            snapRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            snapRenderer.setSize(snapshotSize, snapshotSize);
            snapScene = new THREE.Scene();
            snapCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            snapCamera.position.set(0, 0, 2.2);
            const amb = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(1,1,1);
            snapScene.add(amb, dir);
            const loader = new THREE.GLTFLoader();
            const gltf = await loader.loadAsync(modelUrl);
            snapModel = gltf.scene;
            const box = new THREE.Box3().setFromObject(snapModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.0 / maxDim;
            snapModel.scale.set(scale, scale, scale);
            const center = box.getCenter(new THREE.Vector3());
            snapModel.position.sub(center);
            snapScene.add(snapModel);
        }
    } catch (e) { console.warn('[Markerless] Snapshot hazırlanamıyor:', e && e.message ? e.message : e); }

    // Poz durumu
    let placed = false;
    const state = {
        cx: null,
        cy: null,
        size: Math.min(canvas.width, canvas.height) * 0.35,
        rot: 0, // ekranda dönme (yaw)
        pitch: DEFAULT_PITCH,
    };

    // Parallax: cihaz eğimine göre küçük ofset
    let parallax = { x: 0, y: 0 };
    let emaPar = { x: 0, y: 0 };
    const onDO = (e) => {
        const gamma = (e.gamma || 0); // y ekseni, sağ-sol
        const beta = (e.beta || 0);   // x ekseni, ileri-geri
        // Ekran boyutuna göre küçük bir çarpan
        const maxShift = Math.min(canvas.width, canvas.height) * 0.015; // %1.5
        parallax.x = (gamma / 45) * maxShift;
        parallax.y = (beta / 45) * maxShift;
    };
    try { window.addEventListener('deviceorientation', onDO); } catch (_) {}

    // Jestler: tek parmak sürükle, iki parmak pinch-rotate
    let pointers = new Map();
    const getDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const getAngle = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    let base = { size: 0, rot: 0 };
    arContainer.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, e);
        if (!placed && pointers.size === 1) {
            const p = e;
            state.cx = p.clientX; state.cy = p.clientY; placed = true;
            if (statusElement) { statusElement.textContent = 'Sürükle, iki parmakla döndürüp büyüt.'; statusElement.style.display = 'block'; }
        }
        e.preventDefault();
    });
    arContainer.addEventListener('pointermove', (e) => {
        if (!placed) return;
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, e);
        const arr = Array.from(pointers.values());
        if (arr.length === 1) {
            const p = arr[0];
            state.cx = p.clientX; state.cy = p.clientY;
        } else if (arr.length >= 2) {
            const a = arr[0], b = arr[1];
            const dist = getDist(a, b);
            const ang = getAngle(a, b);
            if (!base.dist) { base = { dist, ang, size: state.size, rot: state.rot }; }
            const scale = dist / (base.dist || dist);
            state.size = Math.max(80, Math.min(Math.min(canvas.width, canvas.height) * 0.9, base.size * scale));
            let delta = ang - base.ang;
            while (delta > Math.PI) delta -= 2*Math.PI;
            while (delta < -Math.PI) delta += 2*Math.PI;
            state.rot = base.rot + delta;
            // orta noktayı da takip et
            state.cx = (a.clientX + b.clientX) / 2;
            state.cy = (a.clientY + b.clientY) / 2;
        }
        e.preventDefault();
    });
    const endPtr = (e) => { pointers.delete(e.pointerId); base = { size: state.size, rot: state.rot }; };
    arContainer.addEventListener('pointerup', endPtr);
    arContainer.addEventListener('pointercancel', endPtr);

    // Çıkış ve temizlik
    function cleanup() {
        try { window.removeEventListener('deviceorientation', onDO); } catch (_) {}
        if (animId) cancelAnimationFrame(animId);
        try { if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
        if (menu) menu.style.display = 'grid';
        if (nav) nav.style.display = 'flex';
        if (header) header.style.display = '';
        document.body.classList.remove('ar-active');
        if (arContainer) arContainer.remove();
        if (statusElement) { statusElement.textContent = ''; statusElement.style.display = 'none'; }
    }
    exitBtn.onclick = cleanup;
    window.__stopMarkerlessLiteMode = cleanup;

    // Render döngüsü
    let animId;
    (function loop() {
        if (video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Parallax EMA
            emaPar.x = emaPar.x + (parallax.x - emaPar.x) * 0.15;
            emaPar.y = emaPar.y + (parallax.y - emaPar.y) * 0.15;
            if (placed && snapRenderer && snapScene && snapCamera) {
                // Model rotasyonu (ekran uzayında): yaw=state.rot, pitch varsayılan
                snapModel.rotation.y = state.rot;
                snapModel.rotation.x = state.pitch;
                snapRenderer.render(snapScene, snapCamera);
                // Gölge
                const drawCx = (state.cx ?? canvas.width/2) + emaPar.x;
                const drawCy = (state.cy ?? canvas.height*0.6) + emaPar.y;
                const shadowY = drawCy + state.size * 0.06;
                const shadowRx = state.size * 0.45;
                const shadowRy = state.size * 0.18;
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.filter = 'blur(6px)';
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.beginPath();
                ctx.ellipse(drawCx, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Model görüntüsü: alt taban zemine otursun
                ctx.save();
                ctx.translate(drawCx, drawCy);
                ctx.rotate(state.rot);
                ctx.drawImage(snapRenderer.domElement, -state.size/2, -state.size, state.size, state.size);
                ctx.restore();
            }
        }
        animId = requestAnimationFrame(loop);
    })();
}

// Basit Android tespiti
function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

// Chrome major versiyon tespiti (Android/desktop fark etmeksizin)
function getChromeMajorVersion() {
    try {
        const m = navigator.userAgent.match(/Chrome\/([0-9]+)/i);
        return m ? parseInt(m[1], 10) : 0;
    } catch (_) {
        return 0;
    }
}

    let currentKategori = null;
    let allKategoriler = [];

    // QR kodu URL'den al
    const pathParts = window.location.pathname.split('/');
    const qr_kodu = pathParts[pathParts.length - 1];

    if (!qr_kodu) {
        menuContainer.innerHTML = '<p class="error">QR kodu bulunamadı.</p>';
        return;
    }

    // Menü verilerini backend'den getir
    fetch(`https://96ef1ce9d525.ngrok-free.app/api/restoran-menu/${qr_kodu}`)
        .then(response => {
            if (!response.ok) throw new Error('Veri alınamadı');
            return response.json();
        })
        .then(data => {
            // Restoran bilgilerini güncelle
            if (data.restoran) {
                restoranAdiElement.textContent = data.restoran.restoran_adi || 'Lezzet Durağı';
                restoranAciklamaElement.textContent = data.restoran.restoran_aciklama || 'AR destekli dijital menü';
                
                // Logo varsa ayarla
                if (data.restoran.restoran_logo) {
                    restoranLogoElement.src = data.restoran.restoran_logo;
                    restoranLogoElement.style.display = 'block';
                } else {
                    restoranLogoElement.style.display = 'none';
                }
            }

            allKategoriler = data.kategoriler;

            // Kategori navigasyonunu oluştur
            createKategoriNav();

            // İlk kategoriyi göster
            if (allKategoriler.length > 0) {
                showKategori(allKategoriler[0]);
            } else {
                menuContainer.innerHTML = '<p class="info">Bu restoranda henüz menü eklenmemiş.</p>';
            }
        })
        .catch(error => {
            console.error("Veri yüklenirken hata:", error);
            menuContainer.innerHTML = '<p class="error">Menü yüklenirken hata oluştu.</p>';
        });

    function createKategoriNav() {
        kategoriNav.innerHTML = '';
        allKategoriler.forEach((kategori, index) => {
            const kategoriBtn = document.createElement('button');
            kategoriBtn.className = 'kategori-btn';
            kategoriBtn.textContent = kategori.kategori_adi;
            kategoriBtn.onclick = () => {
                document.querySelectorAll('.kategori-btn').forEach(btn => btn.classList.remove('active'));
                kategoriBtn.classList.add('active');
                showKategori(kategori);
            };
            if (index === 0) {
                kategoriBtn.classList.add('active');
            }
            kategoriNav.appendChild(kategoriBtn);
        });
    }

    function showKategori(kategori) {
        currentKategori = kategori;
        menuContainer.innerHTML = '';

        const kategoriBaslik = document.createElement('h2');
        kategoriBaslik.className = 'kategori-baslik';
        kategoriBaslik.textContent = kategori.kategori_adi;
        menuContainer.appendChild(kategoriBaslik);

        if (!kategori.urunler || kategori.urunler.length === 0) {
            menuContainer.innerHTML += '<p class="info">Bu kategoride ürün bulunmamaktadır.</p>';
            return;
        }

        kategori.urunler.forEach(urun => {
            const yemekCard = document.createElement('div');
            yemekCard.className = 'yemek-card';

            yemekCard.innerHTML = `
                <img src="${urun.gorsel_url}" alt="${urun.urun_adi}" class="yemek-gorsel">
                <div class="yemek-bilgi">
                    <div class="yemek-baslik">
                        <span class="yemek-isim">${urun.urun_adi}</span>
                        <span class="yemek-fiyat">${parseFloat(urun.fiyat).toFixed(2)} ₺</span>
                    </div>
                    <p class="yemek-aciklama">${urun.urun_aciklama || ''}</p>
                    
                        <button class="model-buton-ar" 
                                data-model="${urun.model_url}" 
                                data-isim="${urun.urun_adi}" 
                                data-olcek="${urun.model_olcek}" 
                                data-rotasyon="${urun.model_rotasyon}">
                            AR'da Görüntüle
                        </button>
                    
                </div>
            `;

            menuContainer.appendChild(yemekCard);
        });

        // AR butonlarına event ekle
        document.querySelectorAll('.model-buton-ar').forEach(button => {
            button.addEventListener('click', async function () {
                const modelUrl = this.getAttribute('data-model');
                const modelName = this.getAttribute('data-isim');
                const modelScale = parseFloat(this.getAttribute('data-olcek')) || 1.0;
                const modelRotation = this.getAttribute('data-rotasyon') || '0,0,0';

                // AR başlatmadan önce restoran bilgilerini ve info alanını gizle
                document.querySelector('header').style.display = 'none';
                if (arInfoElement) arInfoElement.style.display = 'none';

                try {
                    // Android: önce ARCore hizmet var/yok kontrolü ve yönlendirme
                    if (isAndroid()) {
                        const canWebXR = await supportsImmersiveAR();
                        if (canWebXR) {
                            await startAR(modelUrl);
                            statusElement.textContent = `${modelName} yükleniyor...`;
                            statusElement.style.display = 'block';
                            return;
                        }
                        // WebXR desteklenmiyor: modern Chrome ise Play Store'a yönlendir, değilse QR'a düş
                        const chromeMajor = getChromeMajorVersion();
                        if (chromeMajor >= 81) {
                            // Google Play Services for AR (ARCore) yükleme sayfası
                            window.open('https://play.google.com/store/apps/details?id=com.google.ar.core', '_blank');
                            // Ayrıca fallback sunalım (kullanıcı geri dönerse QR ile görsün)
                            await startQRMarkerMode(modelUrl);
                            statusElement.textContent = `${modelName} için Google Play Services for AR gerekli. Yükleme sayfasına yönlendirildiniz; bu arada QR modu açıldı.`;
                            statusElement.style.display = 'block';
                            // Yükleme sonrasında kullanıcı uygulamaya dönerse periyodik kontrol ile otomatik AR başlat
                            try {
                                let waited = 0;
                                const maxWaitMs = 3 * 60 * 1000; // 3 dk
                                const stepMs = 5000; // 5 sn
                                const timer = setInterval(async () => {
                                    try {
                                        const ok = await supportsImmersiveAR();
                                        if (ok) {
                                            clearInterval(timer);
                                            if (window.__stopQRMarkerMode) {
                                                try { window.__stopQRMarkerMode(); } catch (_) {}
                                            }
                                            await startAR(modelUrl);
                                            statusElement.textContent = `${modelName} için AR başlatılıyor...`;
                                            statusElement.style.display = 'block';
                                        }
                                    } catch (_) {}
                                    waited += stepMs;
                                    if (waited >= maxWaitMs) {
                                        clearInterval(timer);
                                    }
                                }, stepMs);
                            } catch (_) {}
                            return;
                        } else {
                            // Eski tarayıcı: QR fallback
                            await startQRMarkerMode(modelUrl);
                            statusElement.textContent = `Cihaz/tarayıcı AR'ı desteklemiyor. ${modelName} kamera (QR) modunda gösteriliyor.`;
                            statusElement.style.display = 'block';
                            return;
                        }
                    }

                    // Android değilse mevcut akış
                    await startAR(modelUrl);
                    statusElement.textContent = `${modelName} yükleniyor...`;
                    statusElement.style.display = 'block';
                } catch (error) {
                    console.error("AR başlatılamadı:", error);
                    statusElement.textContent = `AR başlatılamadı: ${error.message}`;
                    statusElement.style.display = 'block';
                    
                    // Hata durumunda restoran bilgilerini tekrar göster
                    document.querySelector('header').style.display = '';
                    if (arInfoElement) arInfoElement.style.display = 'block';
                }
            });
        });

        // 'Kameradan Görüntüle' butonu ve eventleri kaldırıldı; tek akış AR düğmesi ile yönetilir.
    }
});
// Global değişkenler
let currentModelUrl = '';
let arSession = null;
let camera, scene, renderer;
let model;
let hitTestSource = null;
let reticle = null;
let localReferenceSpace = null;
let trackingStarted = false;
let lastVisibleTime = Date.now();
let anchor = null; // WebXR anchor (sahneyi telefondan bağımsız sabitlemek için)
let anchorGroup = null; // Anchor'a bağlı üç boyutlu grup (model bunun çocuğu olur)

// Basit Safari tespiti (WebXR yoksa QR fallback)
function isSafari() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafariDesktop = /^((?!chrome|android).)*safari/i.test(ua);
    return isIOS || isSafariDesktop;
}

async function supportsImmersiveAR() {
    try {
        if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        return !!supported;
    } catch (_) {
        return false;
    }
}

// Genel AR başlatıcı: WebXR varsa startARScene, yoksa QR fallback
async function startAR(modelUrl) {
    const statusEl = document.getElementById('status');
    // Android + Chrome + WebXR destekliyse ARCore kurulu olup olmadığını isSessionSupported dolaylı gösterir
    const canWebXR = await supportsImmersiveAR();
    if (canWebXR) {
        try {
            return await startARScene(modelUrl);
        } catch (e) {
            console.warn('[AR] startARScene hata, markerless-lite fallback:', e && e.message ? e.message : e);
            if (statusEl) {
                statusEl.textContent = 'AR başlatılamadı, Markerless moduna geçiliyor...';
                statusEl.style.display = 'block';
            }
            return startMarkerlessLiteMode(modelUrl);
        }
    }

    // Bilgilendir ve QR fallback'e geç
    if (statusEl) {
        statusEl.textContent = isSafari()
            ? 'Safari/WebXR desteği yok. Markerless moda geçiliyor.'
            : 'WebXR/ARCore desteklenmiyor. Markerless moda geçiliyor.';
        statusEl.style.display = 'block';
    }
    return startMarkerlessLiteMode(modelUrl);
}

// Dinamik script yükleyici (jsQR için)
async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// QR fallback: kamerayı aç, herhangi bir QR kodu üzerinde modeli görüntüle
async function startQRMarkerMode(modelUrl) {
    const menu = document.getElementById('menu-container');
    const nav = document.getElementById('kategori-nav');
    const header = document.querySelector('header');
    let arContainer = document.getElementById('ar-container');
    if (!arContainer) {
        arContainer = document.createElement('div');
        arContainer.id = 'ar-container';
        arContainer.style.position = 'relative';
        arContainer.style.width = '100%';
        arContainer.style.height = '100vh';
        document.body.appendChild(arContainer);
    }
    const statusElement = document.getElementById('status');

    document.body.classList.add('ar-active');
    if (menu) menu.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (header) header.style.display = 'none';
    arContainer.style.display = 'block';
    arContainer.innerHTML = '';

    // Güvenli bağlam kontrolü (iOS/Safari ve çoğu tarayıcı kamera için HTTPS ister)
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        if (statusElement) {
            statusElement.textContent = 'Kamera erişimi için HTTPS gereklidir. Lütfen güvenli bağlantı üzerinden deneyin.';
            statusElement.style.display = 'block';
        }
        // Geri dönmeden önce UI'yı eski haline getir
        if (menu) menu.style.display = 'grid';
        if (nav) nav.style.display = 'flex';
        if (header) header.style.display = '';
        document.body.classList.remove('ar-active');
        return;
    }

    // Tap-to-place modu: QR taramayı pas geç
    const TAP_MODE = true;
    if (!TAP_MODE) {
        // jsQR'i arka planda yükle (kamerayı bekletme)
        (async () => {
            if (!window.jsQR) {
                try { await loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'); } catch (_) {}
            }
        })();
    }

    // Kamera akışı
    const video = document.createElement('video');
    // iOS/Safari için gerekli inline ayarları
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    arContainer.appendChild(video);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.style.position = 'absolute';
    canvas.style.left = 0;
    canvas.style.top = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    arContainer.appendChild(canvas);

    // Model snapshot renderer (THREE yoksa engel olmasın)
    let snapRenderer = null, snapScene = null, snapCamera = null, snapModel = null;
    try {
        // THREE yoksa CDN'den yüklemeyi dene (sessiz)
        if (!window.THREE) {
            try { await loadScript('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js'); } catch (_) {}
        }
        if (window.THREE && !THREE.GLTFLoader) {
            try { await loadScript('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js'); } catch (_) {}
        }
        if (window.THREE && THREE.GLTFLoader) {
            const snapshotSize = 256;
            snapRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            snapRenderer.setSize(snapshotSize, snapshotSize);
            snapScene = new THREE.Scene();
            snapCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            snapCamera.position.set(0, 0, 2.2);
            const amb = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
            const dir = new THREE.DirectionalLight(0xffffff, 0.8);
            dir.position.set(1, 1, 1);
            snapScene.add(amb, dir);

            const loader = new THREE.GLTFLoader();
            const gltf = await loader.loadAsync(modelUrl);
            snapModel = gltf.scene;
            // Otomatik ölçekle ve merkeze al
            const box = new THREE.Box3().setFromObject(snapModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.0 / maxDim;
            snapModel.scale.set(scale, scale, scale);
            const center = box.getCenter(new THREE.Vector3());
            snapModel.position.sub(center);
            snapScene.add(snapModel);
            snapRenderer.render(snapScene, snapCamera);
        } else {
            console.warn('[QR] THREE veya GLTFLoader yok; snapshot atlanıyor.');
        }
    } catch (e) {
        console.warn('[QR] Snapshot hazırlanamıyor:', e && e.message ? e.message : e);
        // Snapshot başarısız olsa da QR akışı devam edebilir; kullanıcıya engel olmayalım
    }

    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Çık';
    exitBtn.className = 'exit-ar-button';
    arContainer.appendChild(exitBtn);

    // Kilit butonu (tap-to-place modunda gerek yok)
    const lockBtn = document.createElement('button');
    lockBtn.textContent = 'Kilitle';
    // AR sahnesindeki taşı/kilitle tasarımıyla aynı görünmesi için id ver
    lockBtn.id = 'move-model';
    arContainer.appendChild(lockBtn);
    if (TAP_MODE) { lockBtn.style.display = 'none'; }
    // Tap-to-place: ek ekstra buton yok
    // Mobilde sürüklemede sayfanın kaymasını engelle
    try { arContainer.style.touchAction = 'none'; } catch (_) {}

    // Tarayıcının medya API'lerini kontrol et
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusElement) {
            statusElement.textContent = 'Tarayıcınız kamera erişimini desteklemiyor.';
            statusElement.style.display = 'block';
        }
        // UI restore
        if (menu) menu.style.display = 'grid';
        if (nav) nav.style.display = 'flex';
        if (header) header.style.display = '';
        document.body.classList.remove('ar-active');
        return;
    }

    // En iyi kamerayı seçmek ve güvenli şekilde başlatmak için yardımcılar
    async function getBestCameraStream() {
        // 1) environment dene
        try {
            console.log('[QR] getUserMedia (environment ideal) deneniyor...');
            return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        } catch (err1) {
            console.warn('[QR] environment ile başlatılamadı:', err1 && err1.name);
            // 2) kısıtsız dene
            try {
                console.log('[QR] getUserMedia (varsayılan) deneniyor...');
                return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (err2) {
                console.warn('[QR] varsayılan ile başlatılamadı:', err2 && err2.name);
                // 3) rear cihazı enumerate edip seç
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videos = devices.filter(d => d.kind === 'videoinput');
                    let rear = videos.find(d => /back|rear|environment/i.test(d.label));
                    if (!rear && videos.length > 0) rear = videos[videos.length - 1];
                    if (!rear) throw err2 || err1;
                    console.log('[QR] getUserMedia (deviceId) deneniyor...', rear.label || rear.deviceId);
                    return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: rear.deviceId } }, audio: false });
                } catch (err3) {
                    console.error('[QR] Kamera hiç başlatılamadı. Hatalar:', err1, err2, err3);
                    throw err3 || err2 || err1;
                }
            }
        }
    }

    // Kullanıcı jesti gerektiren tarayıcılar için her zaman görünür bir "Kamerayı Başlat" butonu ekle
    const startCamBtn = document.createElement('button');
    startCamBtn.textContent = 'Kamerayı Başlat';
    startCamBtn.className = 'exit-ar-button';
    startCamBtn.style.position = 'absolute';
    startCamBtn.style.left = '50%';
    startCamBtn.style.top = '50%';
    startCamBtn.style.transform = 'translate(-50%, -50%)';
    startCamBtn.style.zIndex = '10000';
    arContainer.appendChild(startCamBtn);

    let stream;
    async function startCamera(flow) {
        try {
            stream = await getBestCameraStream();
            console.log('[QR] getUserMedia stream alındı. (flow=' + flow + ')');
            video.srcObject = stream;
            try {
                await video.play();
                console.log('[QR] video.play() başarılı.');
                if (startCamBtn.parentElement) startCamBtn.remove();
            } catch (playErr) {
                console.warn('[QR] video.play() başarısız:', playErr);
                // Buton zaten görünür; kullanıcı tıklayınca tekrar deneyeceğiz
            }
        } catch (e) {
            console.error('[QR] getUserMedia hatası:', e);
            if (statusElement) {
                const advice = (e && e.name === 'NotAllowedError')
                  ? 'İzin verilmedi. Lütfen tarayıcı ayarlarından bu site için Kamera izni verin.'
                  : (e && e.name === 'NotFoundError')
                  ? 'Kamera bulunamadı. Başka bir tarayıcı ya da cihaz deneyin.'
                  : 'Bilinmeyen hata.';
                statusElement.textContent = 'Kamera açılamadı: ' + (e && e.message ? e.message : advice);
                statusElement.style.display = 'block';
            }
            // Otomatik akış başarısız ise, buton ile kullanıcıya yeniden denet
        }
    }

    // 1) Otomatik başlatmayı dene (başarısız olsa da UI açık kalır)
    startCamera('auto');

    // 2) Kullanıcı butona tıklarsa tekrar dene (çoğu tarayıcıda izin diyaloğunu tetikler)
    startCamBtn.addEventListener('click', () => startCamera('user'), { once: false });

    function resize() {
        const w = arContainer.clientWidth;
        const h = arContainer.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        // Tüm çizimleri DPR ile ölçekle (metinler ve çizgiler dahil)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Sık kaybolmayı önlemek için EMA ve kilit durumu (QR modu için)
    let detectEvery = 2; // her 2 karede bir QR tara
    let frameCount = 0;
    let qrAnim = null;
    let emaCx = null, emaCy = null, emaSize = null, emaAngle = null;
    const EMA_ALPHA = 0.25; // yumuşatma katsayısı
    const SIZE_MULT = 2.0; // modeli QR kenarına göre daha büyük yerleştir
    const LOCK_SIZE_MULT = 2.2; // kilitliyken biraz daha büyük tut
    const MIN_SIZE = 140; // minimum piksel boyutu (biraz daha büyük, daha stabil görünüm)
    const MAX_SCREEN_RATIO = 0.9; // ekranın max %90'ı
    const DEFAULT_YAW = 0;       // ilk pozda kullanıcıya baksın
    const DEFAULT_PITCH = 0.80;  // üst kısım kullanıcıya dönük olsun (hafif öne eğik)
    let lastSeenTs = 0; // en son QR görüldüğü zaman
    let hasLock = false;
    let lockPose = null; // {cx, cy, size, angle}
    // Kullanıcı dönüşü (kilitliyken parmakla döndürme)
    let userRotY = 0; // yaw
    let userRotX = 0; // pitch
    let baseRotY = 0; // kilitleme anındaki temel rotasyon yaw
    let baseRotX = 0; // kilitleme anındaki temel rotasyon pitch
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    if (!TAP_MODE) lockBtn.addEventListener('click', () => {
        if (!hasLock) {
            // O anki EMA pozunu al ve biraz büyük tut, sonra dondur
            if (emaCx != null) {
                lockPose = { cx: emaCx, cy: emaCy, size: emaSize * LOCK_SIZE_MULT };
                hasLock = true;
                lockBtn.textContent = 'Kilidi Kaldır';
                // Kilit anındaki rotasyonu temel al, kullanıcı dönüşünü sıfırla
                // Kilit anında varsayılan bakışa sabitle (üst yüz bize dönük)
                baseRotY = DEFAULT_YAW;
                baseRotX = DEFAULT_PITCH;
                userRotY = 0;
                userRotX = 0;
            }
        } else {
            hasLock = false;
            lockPose = null;
            lockBtn.textContent = 'Kilitle';
            userRotY = 0;
            userRotX = 0;
        }
    });

    // Tap-to-place jestleri: tek parmak taşır, iki parmak yalnızca döndürür (ölçek kapalı)
    let tpPlaced = false;
    const FIXED_SIZE_FRAC = 0.35; // ekranda sabit oran ("gerçek dünyaya" yakın görünüm için tek ölçü)
    const tpState = { cx: null, cy: null, size: Math.min(canvas.width, canvas.height) * FIXED_SIZE_FRAC, rot: 0 };
    if (TAP_MODE) {
        const updateFixedSize = () => { tpState.size = Math.min(canvas.width, canvas.height) * FIXED_SIZE_FRAC; };
        window.addEventListener('resize', updateFixedSize);
        const pointers = new Map();
        let base = { ang: 0, rot: 0 };
        const getAngle = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
        arContainer.addEventListener('pointerdown', (e) => {
            pointers.set(e.pointerId, e);
            if (!tpPlaced && pointers.size === 1) {
                tpState.cx = e.clientX; tpState.cy = e.clientY; tpPlaced = true;
            }
            e.preventDefault();
        });
        arContainer.addEventListener('pointermove', (e) => {
            if (!tpPlaced) return;
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, e);
            const arr = Array.from(pointers.values());
            if (arr.length === 1) {
                const p = arr[0]; tpState.cx = p.clientX; tpState.cy = p.clientY;
            } else if (arr.length >= 2) {
                const a = arr[0], b = arr[1];
                const ang = getAngle(a, b);
                if (base.ang === 0 && base.rot === 0) { base = { ang, rot: tpState.rot }; }
                let delta = ang - base.ang; while (delta > Math.PI) delta -= 2*Math.PI; while (delta < -Math.PI) delta += 2*Math.PI;
                tpState.rot = base.rot + delta; // yalnızca döndür
                tpState.cx = (a.clientX + b.clientX) / 2; tpState.cy = (a.clientY + b.clientY) / 2;
            }
            e.preventDefault();
        });
        const endPtr = (e) => { pointers.delete(e.pointerId); base = { ang: 0, rot: tpState.rot }; };
        arContainer.addEventListener('pointerup', endPtr);
        arContainer.addEventListener('pointercancel', endPtr);
    } else {
        // Kilitliyken parmakla döndürme (QR modu)
        arContainer.addEventListener('pointerdown', (e) => {
            if (!hasLock) return;
            isDragging = true;
            const p = e.touches && e.touches[0] ? e.touches[0] : e;
            lastPointerX = p.clientX || 0;
            lastPointerY = p.clientY || 0;
            e.preventDefault();
        });
        arContainer.addEventListener('pointermove', (e) => {
            if (!hasLock || !isDragging) return;
            const p = e.touches && e.touches[0] ? e.touches[0] : e;
            const x = p.clientX || lastPointerX;
            const y = p.clientY || lastPointerY;
            const dx = x - lastPointerX;
            const dy = y - lastPointerY;
            lastPointerX = x;
            lastPointerY = y;
            userRotY += dx * 0.03; // yaw
            userRotX += -dy * 0.03; // pitch
            const wrap = (a) => { if (!isFinite(a)) return 0; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
            userRotY = wrap(userRotY); userRotX = wrap(userRotX);
            e.preventDefault();
        });
        const endDrag = (e) => { if (!hasLock) return; isDragging = false; e && e.preventDefault && e.preventDefault(); };
        arContainer.addEventListener('pointerup', endDrag);
        arContainer.addEventListener('pointercancel', endDrag);
    }

    (function loop() {
        if (video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (TAP_MODE) {
                // Tap-to-place çizimi
                if (tpPlaced && snapModel && snapRenderer && snapScene && snapCamera) {
                    snapModel.rotation.y = tpState.rot;
                    snapModel.rotation.x = DEFAULT_PITCH;
                    snapRenderer.render(snapScene, snapCamera);
                    const shadowY = tpState.cy + tpState.size * 0.06;
                    const shadowRx = tpState.size * 0.45;
                    const shadowRy = tpState.size * 0.18;
                    ctx.save();
                    ctx.globalAlpha = 0.35;
                    ctx.filter = 'blur(6px)';
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.beginPath();
                    ctx.ellipse(tpState.cx, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    ctx.save();
                    ctx.translate(tpState.cx, tpState.cy);
                    ctx.rotate(tpState.rot);
                    ctx.drawImage(snapRenderer.domElement, -tpState.size/2, -tpState.size, tpState.size, tpState.size);
                    ctx.restore();
                }
            } else {
                // QR tabanlı çizim
                // 1) Belirli aralıklarla QR tespiti yap
                if (frameCount % detectEvery === 0) {
                    try {
                        if (!window.jsQR) throw new Error('jsQR not ready');
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
                        if (code && code.location) {
                            const loc = code.location;
                            const topDx = loc.topRightCorner.x - loc.topLeftCorner.x;
                            const topDy = loc.topRightCorner.y - loc.topLeftCorner.y;
                            const botDx = loc.bottomRightCorner.x - loc.bottomLeftCorner.x;
                            const botDy = loc.bottomRightCorner.y - loc.bottomLeftCorner.y;
                            const topEdge = Math.sqrt(topDx*topDx + topDy*topDy);
                            const botEdge = Math.sqrt(botDx*botDx + botDy*botDy);
                            const edge = (topEdge + botEdge) / 2;
                            const bx = (loc.bottomLeftCorner.x + loc.bottomRightCorner.x) / 2;
                            const by = (loc.bottomLeftCorner.y + loc.bottomRightCorner.y) / 2;
                            const angleNow = Math.atan2(botDy, botDx);
                            const sizeNewRaw = Math.max(MIN_SIZE, Math.min(edge * SIZE_MULT, Math.min(canvas.width, canvas.height) * MAX_SCREEN_RATIO));
                            const perspRatio = Math.max(0.6, Math.min(1.4, topEdge / (botEdge || 1)));
                            const sizeNew = sizeNewRaw * (1 - 0.06 * Math.sign(1 - perspRatio));
                            const distDelta = (emaCx == null) ? 0 : Math.hypot((bx - emaCx), (by - emaCy));
                            const sizeDelta = (emaSize == null) ? 0 : Math.abs(sizeNew - emaSize) / Math.max(emaSize || 1, 1);
                            const alpha = (distDelta > 20 || sizeDelta > 0.08) ? 0.38 : 0.16;
                            const alphaAngle = (distDelta > 20 || sizeDelta > 0.08) ? 0.38 : 0.18;
                            if (emaCx == null) { emaCx = bx; emaCy = by; emaSize = sizeNew; emaAngle = angleNow; }
                            else {
                                emaCx = emaCx + (bx - emaCx) * alpha; emaCy = emaCy + (by - emaCy) * alpha; emaSize = emaSize + (sizeNew - emaSize) * alpha;
                                let delta = angleNow - emaAngle; while (delta > Math.PI) delta -= 2*Math.PI; while (delta < -Math.PI) delta += 2*Math.PI; emaAngle = emaAngle + delta * alphaAngle;
                            }
                            lastSeenTs = performance.now();
                            if (hasLock) { lockPose = { cx: emaCx, cy: emaCy, size: emaSize * LOCK_SIZE_MULT, angle: emaAngle }; }
                            // debug çerçeve
                            ctx.strokeStyle = 'rgba(0,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath();
                            ctx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
                            ctx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
                            ctx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
                            ctx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
                            ctx.closePath(); ctx.stroke();
                        }
                    } catch (_) {}
                }
                // 2) Model snapshot'ı çiz
                const now = performance.now();
                let poseToDraw = null;
                if (hasLock && lockPose) poseToDraw = lockPose; else if (emaCx != null && (now - lastSeenTs) < 2500) poseToDraw = { cx: emaCx, cy: emaCy, size: emaSize, angle: emaAngle };
                if (poseToDraw && snapModel && snapRenderer && snapScene && snapCamera) {
                    if (!hasLock) { snapModel.rotation.y = DEFAULT_YAW; snapModel.rotation.x = DEFAULT_PITCH; }
                    else { snapModel.rotation.y = baseRotY + userRotY; snapModel.rotation.x = baseRotX + userRotX; }
                    snapRenderer.render(snapScene, snapCamera);
                    const shadowY = poseToDraw.cy + poseToDraw.size * 0.06; const shadowRx = poseToDraw.size * 0.45; const shadowRy = poseToDraw.size * 0.18;
                    ctx.save(); ctx.globalAlpha = 0.35; ctx.filter = 'blur(6px)'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(poseToDraw.cx, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                    ctx.save(); ctx.translate(poseToDraw.cx, poseToDraw.cy); const drawAngle = (hasLock && lockPose && lockPose.angle != null) ? lockPose.angle : (poseToDraw.angle != null ? poseToDraw.angle : 0); if (!isNaN(drawAngle)) ctx.rotate(drawAngle); ctx.transform(1, 0, 0, 1, 0, 0); ctx.drawImage(snapRenderer.domElement, -poseToDraw.size/2, -poseToDraw.size, poseToDraw.size, poseToDraw.size); ctx.restore();
                }
            }

            frameCount++;
        }
        qrAnim = requestAnimationFrame(loop);
    })();

    function stopQRMarkerMode() {
        cancelAnimationFrame(qrAnim);
        try { video.srcObject && video.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
        arContainer.style.display = 'none';
        arContainer.innerHTML = '';
        if (menu) menu.style.display = 'grid';
        if (nav) nav.style.display = 'flex';
        if (header) header.style.display = '';
        document.body.classList.remove('ar-active');
    }

    exitBtn.onclick = stopQRMarkerMode;
    // Dışarıdan kapatmak için global referans (Android ARCore yükleme sonrası otomatik geçişte kullanılır)
    try { window.__stopQRMarkerMode = stopQRMarkerMode; } catch (_) {}
}

// Sadece bir kez resize event listener ekle
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

async function startARScene(modelUrl) {
    const reticlePositions = [];
    const animations = [];
    // Retikül poz stabilizasyonu için değişkenler
    let emaPos = null; // THREE.Vector3
    let emaQuat = null; // THREE.Quaternion (yalnızca yaw kullanılacak)
    let stabilityFrames = 0;
    let reticleStable = false;
    const POS_ALPHA = 0.2; // EMA katsayısı (pozisyon)
    const ROT_ALPHA = 0.2; // EMA katsayısı (rotasyon)
    const POS_THRESHOLD = 0.01; // 1cm altında dalgalanma
    const YAW_THRESHOLD_DEG = 2; // 2° altında dalgalanma
    const STABLE_REQUIRED_FRAMES = 10; // art arda bu kadar frame stabil olmalı
    let lastStableYaw = 0;
    let planeY = 0; // tespit edilen düzlemin yüksekliği
    let modelBaseOffset = 0; // model alt tabanı ofseti (tablanın üstüne tam otursun)
    const arInfo = document.querySelector('.ar-info');
    if (arInfo) {
        arInfo.style.display = 'none';
    }
    // Eğer bir AR oturumu zaten varsa tekrar başlatma
    if (arSession) {
        return;
    }
    
    // Body'ye AR aktif class'ı ekle
    document.body.classList.add('ar-active');
    
    // Menü alanını gizle
    document.getElementById('menu-container').style.display = 'none';
    // Kategori navigasyonunu gizle
    document.getElementById('kategori-nav').style.display = 'none';
    // Header'ı gizle
    document.querySelector('header').style.display = 'none';
    const statusElement = document.getElementById('status');
    statusElement.style.display = 'none'; // AR başlatılırken ve model yüklenirken gizle
    const arContainer = document.getElementById('ar-container');
    arContainer.style.display = 'block';
    arContainer.style.fontFamily = "'Orbitron', 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    arContainer.style.color = 'white';
    arContainer.style.fontWeight = 'normal';
    arContainer.style.textShadow = 'none';
    arContainer.style.boxShadow = 'none';
    arContainer.style.border = 'none';
    arContainer.style.background = 'transparent';
    arContainer.style.backgroundColor = 'transparent';
    arContainer.style.filter = 'none';
    arContainer.style.webkitFilter = 'none';
    arContainer.style.backdropFilter = 'none';
    arContainer.style.webkitBackdropFilter = 'none';
    arContainer.innerHTML = `
        <button id="exit-ar" class="exit-ar-button" style="display:none;">Çık</button>
        <button id="move-model" class="exit-ar-button" style="display:none;">Taşı</button>
        <div id="ar-loading" class="ar-loading" style="display:block;">Yükleniyor...</div>
    `;
    trackingStarted = false;
    lastVisibleTime = Date.now();

    // Yükleniyor animasyonu ve çıkış butonu referansları
    const arLoading = document.getElementById('ar-loading') || arContainer.querySelector('#ar-loading');
    const exitArButton = document.getElementById('exit-ar') || arContainer.querySelector('#exit-ar');
    const moveModelButton = document.getElementById('move-model') || arContainer.querySelector('#move-model');
    let isMoveMode = false;

    // Three.js sahnesi oluştur
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

    // Renderer oluştur
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Tamamen şeffaf arka plan
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    
    // Canvas'ı tamamen şeffaf yap
    renderer.domElement.style.background = 'transparent';
    renderer.domElement.style.backgroundColor = 'transparent';
    
    arContainer.appendChild(renderer.domElement);

    // Işık ekle
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 3, 3);
    scene.add(directionalLight);

    // Model yükle
    model = null;
    const loader = new THREE.GLTFLoader();
    try {
        const gltf = await loader.loadAsync(modelUrl);
        model = gltf.scene;
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.metalness = 0.3;
                child.material.roughness = 0.7;
            }
        });
        // Model boyutunu otomatik ayarla
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 0.2 / maxDim;
        model.scale.set(scale, scale, scale);
        // Model alt tabanı ofsetini hesapla (scale uygulandıktan sonra tekrar hesapla)
        const bbox2 = new THREE.Box3().setFromObject(model);
        modelBaseOffset = -bbox2.min.y; // taban 0 yüksekliğe gelsin
        model.visible = false;
        scene.add(model);
        // Model yüklendi ama AR oturumu henüz başlamadı, bilgi şeridi hala gizli
    } catch (error) {
        if (arLoading) arLoading.style.display = 'none';
        console.error("Model yüklenemedi:", error);
        statusElement.textContent = "Model yüklenirken hata oluştu: " + error.message;
        statusElement.style.display = 'block';
        return;
    }
    // Animasyon yönetimi
function addAnimation(updateFn, duration) {
    const startTime = performance.now();
    animations.push({ updateFn, startTime, duration });
}

function updateAnimations() {
    const now = performance.now();
    for (let i = animations.length - 1; i >= 0; i--) {
        const anim = animations[i];
        const t = Math.min((now - anim.startTime) / anim.duration, 1);
        anim.updateFn(t);
        if (t >= 1) animations.splice(i, 1);
    }
}

// Modeli yumuşak yerleştirme
function placeModelSmoothly(targetPos, targetQuat) {
    const startPos = model.position.clone();
    const startQuat = model.quaternion.clone();
    addAnimation((t) => {
        model.position.lerpVectors(startPos, targetPos, t);
        THREE.Quaternion.slerp(startQuat, targetQuat, model.quaternion, t);
    }, 500);
}

// Bounce efekti
function bounceEffect() {
    const originalScale = model.scale.clone();
    const minScale = originalScale.clone().multiplyScalar(0.9);

    addAnimation((t) => {
        model.scale.lerpVectors(originalScale, minScale, t);
    }, 150);

    setTimeout(() => {
        addAnimation((t) => {
            model.scale.lerpVectors(minScale, originalScale, t);
        }, 150);
    }, 150);
}



    // Retikül (hedefleme noktası) oluştur
    function createReticle() {
        // Dış halka (modern, temiz)
        const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(0.12, 0.15, 64),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                opacity: 0.7,
                transparent: true,
                depthWrite: false
            })
        );
        outerRing.rotateX(-Math.PI / 2);

        // İç halka (daha ince)
        const innerRing = new THREE.Mesh(
            new THREE.RingGeometry(0.06, 0.09, 64),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                opacity: 0.8,
                transparent: true,
                depthWrite: false
            })
        );
        innerRing.rotateX(-Math.PI / 2);

        // Merkez nokta (küçük ve net)
        const centerDot = new THREE.Mesh(
            new THREE.CircleGeometry(0.015, 32),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                opacity: 0.9,
                transparent: true,
                depthWrite: false
            })
        );
        centerDot.position.y = 0.01;
        centerDot.rotateX(-Math.PI / 2);

        // Retikül için bir grup oluştur
        reticle = new THREE.Group();
        reticle.add(outerRing);
        reticle.add(innerRing);
        reticle.add(centerDot);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        reticle.userData.rings = [outerRing, innerRing, centerDot];
        scene.add(reticle);
    }

    createReticle();

    // WebXR oturumu başlat
    try {
        if (!navigator.xr) {
            throw new Error("Tarayıcınız WebXR desteklemiyor!");
        }
        
        // WebXR desteğini kontrol et
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isSupported) {
            throw new Error("AR oturumu desteklenmiyor!");
        }
        
        arSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local', 'hit-test'],
            optionalFeatures: ['dom-overlay', 'anchors'],
            domOverlay: { root: document.body }
        });
        
        await renderer.xr.setSession(arSession);
        localReferenceSpace = await arSession.requestReferenceSpace('local');
        const viewerSpace = await arSession.requestReferenceSpace('viewer');
        hitTestSource = await arSession.requestHitTestSource({ space: viewerSpace });
        arSession.addEventListener('end', onSessionEnd);

        // Render loop
        renderer.setAnimationLoop((timestamp, frame) => {
            if (!frame) return;
            
            // Sahneyi tamamen şeffaf tut
            renderer.setClearColor(0x000000, 0);
            
            if (hitTestSource && !model.visible) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(localReferenceSpace);
                    if (pose) {
                        const mat4 = new THREE.Matrix4().fromArray(pose.transform.matrix);
                        const pos = new THREE.Vector3().setFromMatrixPosition(mat4);
                        // Yalnızca yaw kullan (zeminle hizalama). Y yönü yukarı olacak şekilde yaw hesapla
                        const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(mat4).sub(pos);
                        const yaw = Math.atan2(forward.x, forward.z);
                        const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

                        // İlk frame'lerde EMA başlat
                        if (!emaPos) {
                            emaPos = pos.clone();
                            emaQuat = yawQuat.clone();
                        } else {
                            // EMA uygula
                            emaPos.lerpVectors(emaPos, pos, POS_ALPHA);
                            THREE.Quaternion.slerp(emaQuat, yawQuat, emaQuat, ROT_ALPHA);
                        }

                        // Stabilite kontrolü
                        const posDev = emaPos.distanceTo(pos);
                        // Yaw farkını derece cinsinden ölç
                        const tmp = emaQuat.clone().conjugate().multiply(yawQuat);
                        const angle = 2 * Math.acos(Math.min(1, Math.max(-1, tmp.w)));
                        const yawDevDeg = THREE.MathUtils.radToDeg(Math.abs(angle));

                        if (posDev < POS_THRESHOLD && yawDevDeg < YAW_THRESHOLD_DEG) {
                            stabilityFrames++;
                            if (stabilityFrames >= STABLE_REQUIRED_FRAMES) {
                                reticleStable = true;
                                lastStableYaw = yaw;
                            }
                        } else {
                            stabilityFrames = Math.max(0, stabilityFrames - 1);
                            reticleStable = false;
                        }

                        // Retikül matrisini EMA ile güncelle
                        const composeQuat = reticleStable ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lastStableYaw, 0)) : emaQuat;
                        const scaleVec = new THREE.Vector3(1, 1, 1);
                        const composed = new THREE.Matrix4().compose(emaPos, composeQuat, scaleVec);
                        reticle.visible = true;
                        reticle.matrix.copy(composed);

                        planeY = emaPos.y; // düzlemin yüksekliği

                        if (!trackingStarted) {
                            if (arLoading) arLoading.style.display = 'none';
                            if (exitArButton) exitArButton.style.display = 'block';
                            statusElement.textContent = "Düz bir yüzey algılandı. Ekrana dokunarak modeli yerleştirin.";
                            statusElement.style.display = 'block';
                            trackingStarted = true;
                        }
                        lastVisibleTime = Date.now();
                    } else {
                        reticle.visible = false;
                    }
                    const elapsed = Date.now() - lastVisibleTime;
                    if (elapsed > 3000 && !model.visible) {
                        statusElement.textContent = "Masayı algılayamıyoruz. Kamerayı hareket ettirin veya masaya doğru tutun.";
                        statusElement.style.display = 'block';
                    }
                } else {
                    reticle.visible = false;
                }
            }

            // Anchor varsa her frame anchor pozunu uygula (model sabit kalsın)
            if (anchor && anchor.anchorSpace && localReferenceSpace) {
                const anchorPose = frame.getPose(anchor.anchorSpace, localReferenceSpace);
                if (anchorPose && anchorGroup) {
                    anchorGroup.visible = true;
                    anchorGroup.matrix.fromArray(anchorPose.transform.matrix);
                }
            }
            // Retikül renk değişimi (animasyonsuz)
            if (reticle && reticle.userData.rings) {
                reticle.userData.rings.forEach((ring, index) => {
                    if (reticle.visible) {
                        // Yüzey algılandığında canlı renkler
                        const colors = [0x00ffff, 0xffffff, 0x00ffff];
                        ring.material.color.setHex(colors[index]);
                        ring.material.opacity = 0.7;
                    } else {
                        // Yüzey algılanmadığında soluk renkler
                        ring.material.color.setHex(0x888888);
                        ring.material.opacity = 0.3;
                    }
                });
            }
            updateAnimations(); // en sonda render'dan önce

            // Sahneyi render et
            renderer.render(scene, camera);
            
        });

        // Kontrolcü oluştur ve dokunma olayını ekle
        const controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        // AR ve model hazır, bilgi şeridini göster
        statusElement.textContent = "Modeli yerleştirmek için bir yüzey bulun ve ekrana dokunun.";
        statusElement.style.display = 'block';
        if (arLoading) arLoading.style.display = 'none';
        if (exitArButton) exitArButton.style.display = 'block';
        if (exitArButton) {
            exitArButton.onclick = () => {
                if (arSession) arSession.end();
            };
        }
        if (moveModelButton) {
    moveModelButton.onclick = () => {
        // Modeli yeniden hareket ettirilebilir moda al
        isMoveMode = true;
        model.visible = false;
        reticle.visible = true;
        statusElement.textContent = "Modeli yeni bir yüzeye yerleştirmek için ekrana dokunun.";
        statusElement.style.display = 'block';
        // Butonu gizle
        moveModelButton.style.display = 'none';
        // Mevcut anchor'ı temizle
        try {
            anchor?.delete?.();
        } catch (e) {}
        anchor = null;
        if (anchorGroup && anchorGroup.parent) {
            anchorGroup.parent.remove(anchorGroup);
        }
        anchorGroup = null;
        // hitTestSource tekrar oluşturulmalı
        (async () => {
            if (arSession) {
                const viewerSpace = await arSession.requestReferenceSpace('viewer');
                hitTestSource = await arSession.requestHitTestSource({ space: viewerSpace });
            }
        })();
    };
}
    } catch (error) {
        if (arLoading) arLoading.style.display = 'none';
        if (exitArButton) exitArButton.style.display = 'block';
        console.error("AR başlatma hatası:", error);
        statusElement.textContent = "AR başlatılamadı. QR moduna geçiliyor...";
        statusElement.style.display = 'block';
        try { await startQRMarkerMode(modelUrl); } catch (_) {}
    }

    function onSelect() {
        if (reticle && reticle.visible && model) {
            if (!model.visible || isMoveMode) {
                const position = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
                const rotation = new THREE.Quaternion().setFromRotationMatrix(reticle.matrix);

                // Anchor destekleniyorsa anchor oluştur ve modele sabit bir referans ver
                (async () => {
                    try {
                        const viewerSpace = await arSession.requestReferenceSpace('viewer');
                        // Hit-test'i yeniden al, en son retikül pozunu baz almak için
                        const newHitTestSource = await arSession.requestHitTestSource({ space: viewerSpace });
                        const frame = renderer.xr.getFrame();
                        let createdAnchor = null;
                        if (frame && newHitTestSource) {
                            const results = frame.getHitTestResults(newHitTestSource);
                            if (results && results[0] && results[0].createAnchor) {
                                createdAnchor = await results[0].createAnchor();
                            }
                        }
                        // Eski hit source'u iptal et
                        try { newHitTestSource?.cancel?.(); } catch (e) {}

                        if (createdAnchor) {
                            // Eski anchor'ı temizle
                            try { anchor?.delete?.(); } catch (e) {}
                            anchor = createdAnchor;

                            // Anchor grubu oluştur
                            if (!anchorGroup) {
                                anchorGroup = new THREE.Group();
                                anchorGroup.matrixAutoUpdate = false;
                                scene.add(anchorGroup);
                            }
                            // Modeli anchor grubuna ekle ve taban hizasını ver
                            anchorGroup.add(model);
                            model.position.set(0, modelBaseOffset, 0);
                            model.quaternion.copy(new THREE.Quaternion()); // anchor yönelimini kullan
                            model.visible = true;
                            reticle.visible = false;
                        } else {
                            // Anchor yoksa mevcut pürüzsüz yerleştirmeyi kullan
                            const targetPos = position.clone();
                            targetPos.y = planeY + modelBaseOffset;
                            model.visible = true;
                            reticle.visible = false;
                            placeModelSmoothly(targetPos, rotation);
                            bounceEffect();
                        }
                    } catch (e) {
                        // Fallback: anchor başarısızsa mevcut pürüzsüz yerleştirme
                        const targetPos = position.clone();
                        targetPos.y = planeY + modelBaseOffset;
                        model.visible = true;
                        reticle.visible = false;
                        placeModelSmoothly(targetPos, rotation);
                        bounceEffect();
                    }
                })();

                if (hitTestSource) {
                    hitTestSource.cancel?.();
                    hitTestSource = null;
                }
                statusElement.textContent = "Model sabitlendi.";
                statusElement.style.display = 'block';
                if (moveModelButton) moveModelButton.style.display = 'block';
                isMoveMode = false;
            }
        }
    }


    // Model döndürme için değişkenler
    let isRotating = false;
    let lastTouchX = 0;
    let rotationStartY = 0;

    // Dokunma eventlerini ekle
    function addModelRotationEvents() {
        if (!renderer || !renderer.domElement) return;
        renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
        renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
        renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
    }
    function removeModelRotationEvents() {
        if (!renderer || !renderer.domElement) return;
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        renderer.domElement.removeEventListener('touchmove', onTouchMove);
        renderer.domElement.removeEventListener('touchend', onTouchEnd);
    }
    function onTouchStart(e) {
        if (model && model.visible && e.touches.length === 1) {
            isRotating = true;
            lastTouchX = e.touches[0].clientX;
            rotationStartY = model.rotation.y;
            e.preventDefault();
        }
    }
    function onTouchMove(e) {
        if (isRotating && model && model.visible && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - lastTouchX;
            // Ekran genişliğine göre hassasiyet ayarı
            const rotationDelta = (deltaX / window.innerWidth) * Math.PI * 2;
            model.rotation.y = rotationStartY + rotationDelta;
            e.preventDefault();
        }
    }
    function onTouchEnd(e) {
        isRotating = false;
    }

    // AR sahnesi açıldığında eventleri ekle
    addModelRotationEvents();

    function onSessionEnd() {
        if (renderer) {
            renderer.setAnimationLoop(null);
            // Renderer ve sahneyi DOM'dan kaldır
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer.dispose();
        }
        // Model döndürme eventlerini kaldır
        removeModelRotationEvents();
        statusElement.textContent = "AR oturumu sonlandı. Yeniden başlatabilirsiniz.";
        statusElement.style.display = 'none';
        arContainer.style.display = 'none';
        document.getElementById('menu-container').style.display = 'grid';
        // Kategori navigasyonunu tekrar göster
        document.getElementById('kategori-nav').style.display = 'flex';
        // Header'ı tekrar göster
        document.querySelector('header').style.display = '';
        // AR container içeriğini temizle
        arContainer.innerHTML = '';
        // Body'den AR aktif class'ını kaldır
        document.body.classList.remove('ar-active');
        // Tüm global değişkenleri temizle
        arSession = null;
        scene = null;
        camera = null;
        renderer = null;
        model = null;
        reticle = null;
        hitTestSource = null;
        localReferenceSpace = null;
        trackingStarted = false;
        isMoveMode = false;
        // Anchor temizliği
        try { anchor?.delete?.(); } catch (e) {}
        anchor = null;
        if (anchorGroup && anchorGroup.parent) {
            anchorGroup.parent.remove(anchorGroup);
        }
        anchorGroup = null;
        const infoElement = document.querySelector('.ar-info');
        if (infoElement) {
            infoElement.style.display = 'block'; // Veya 'flex' eğer flex kullanıyorsanız
        }
    }
    

}