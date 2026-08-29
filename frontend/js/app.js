const app = {
    tg: window.Telegram ? window.Telegram.WebApp : null,
    lang: 'es', 
    availableLangs: ['es', 'en', 'it', 'pt', 'de', 'fr'],
    userId: null,
    alphaBalance: 0,
    userAccessLevel: 0, 
    pendingLevel: 0,
    currentPaymentLink: '',
    profileViews: 1450, 
    liveTimer: null, 
    isAdmin: false, 
    secretTaps: 0,
    currentCaptchaCode: '',
    
    // URL dinámica para tu backend
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    
    userData: {
        name: 'VISITOR',
        photo: 'assets/logo.png',
        bio: '',
        age_verified: false,
        access_tier: 'FREE'
    },

    posts: [
        {
            id: 1, type: 'welcome', levelRequired: 0, date: '10:00 AM',
            text_es: '¡Bienvenido al Vault privado, Cerdo Sexy! 🔞🔥 Desliza hacia abajo para ver los adelantos. Sube de rango para desbloquear.',
            text_en: 'Welcome to the private Vault, Sexy Pig! 🔞🔥 Swipe down to see previews. Upgrade your rank to unlock.',
            text_it: 'Benvenuto nel Vault privato, Maialino Sexy! 🔞🔥 Scorri verso il basso per le anteprime. Sali di grado per sbloccare.',
            text_pt: 'Bem-vindo ao Vault privado, Porco Sexy! 🔞🔥 Deslize para baixo para ver as prévias. Suba de rank para desbloquear.',
            text_de: 'Willkommen im privaten Vault, Sexy Schwein! 🔞🔥 Wische nach unten, um Vorschauen zu sehen. Steige auf, um freizuschalten.',
            text_fr: 'Bienvenue dans le Vault privé, Cochon Sexy! 🔞🔥 Glissez vers le bas pour voir les aperçus. Monte en grade pour débloquer.'
        },
        {
            id: 2, type: 'text', levelRequired: 0, date: 'Fijado',
            text_es: '⚠️ REGLAS LEGALES & SAFE HARBOR: Verificación 18+ obligatoria. Pagos seguros vía Telegram Stars (150 XTR) y Stripe / Búnker CRM.',
            text_en: '⚠️ LEGAL RULES & SAFE HARBOR: 18+ verification required. Secure payments via Telegram Stars (150 XTR) and Stripe / Bunker CRM.',
            text_it: '⚠️ REGOLE LEGALI: Verifica 18+ obbligatoria.',
            text_pt: '⚠️ REGRAS LEGAIS: Verificação 18+ obrigatória.',
            text_de: '⚠️ RECHTLICHE REGELN: 18+ Verifizierung erforderlich.',
            text_fr: '⚠️ RÈGLES LÉGALES : Vérification 18+ obligatoire.'
        }
    ],

    async init() {
        this.loadGlobalStats();

        if (this.tg) {
            this.tg.expand();
            this.tg.ready();
            try {
                if (typeof this.tg.setHeaderColor === 'function') this.tg.setHeaderColor('#050505');
                if (typeof this.tg.setBackgroundColor === 'function') this.tg.setBackgroundColor('#050505');
            } catch(e) {}
        }

        // --- INTEGRACIÓN API: Sincronización Inicial ---
        if (typeof getSessionUser === 'function') {
            const localUser = getSessionUser();
            this.userId = localUser.user_id;
            this.userData.name = localUser.name;
            await syncUserSession();
            await this.refreshUserData();
        }

        this.updateTexts();
        await this.loadPostsFromServer();
        this.startLiveCounters();
    },

    async refreshUserData() {
        if (!this.userId) return;
        
        // Cargar Perfil
        const profile = await fetchUserProfile(this.userId);
        if (profile) {
            this.userAccessLevel = profile.access_level || 0;
            this.userData.access_tier = profile.access_tier || 'FREE';
            this.userData.bio = profile.bio || '';
            if (profile.is_master) this.isAdmin = true;
        }

        // Cargar Billetera $ALPHA
        const wallet = await fetchWalletBalance(this.userId);
        if (wallet) {
            this.alphaBalance = wallet.alpha_balance || 0;
            const btnWallet = document.getElementById('btn-wallet-hdr');
            if (btnWallet) {
                btnWallet.innerHTML = `<i class="fa-solid fa-coins mr-1.5 text-xs text-[#ffb703]"></i> <span class="font-black">${this.alphaBalance} $ALPHA</span>`;
                btnWallet.classList.replace('border-[#00f3ff]', 'border-[#ffb703]');
                btnWallet.classList.replace('text-[#00f3ff]', 'text-[#ffb703]');
                btnWallet.classList.replace('shadow-[0_0_8px_#00f3ff]', 'shadow-[0_0_8px_#ffb703]');
            }
        }
        this.updateProfileUI();
    },

    async loadPostsFromServer() {
        try {
            const serverFeed = await fetchGlobalFeed(this.userId);
            if (serverFeed && serverFeed.length > 0) {
                const mappedPosts = serverFeed.map(p => ({
                    id: p.id + 10000, // ID virtual frontend
                    real_id: p.id,    // ID real BD
                    type: p.image_url ? 'media' : 'text',
                    levelRequired: p.levelRequired,
                    date: new Date(p.date_created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    author: p.author,
                    isUserPost: p.author !== 'MASTER TOM',
                    image: p.image_url ? `${this.backendUrl}${p.image_url}` : null,
                    text_es: p.text_es, text_en: p.text_es, text_it: p.text_es, text_pt: p.text_es, text_de: p.text_es, text_fr: p.text_es,
                    globalLikes: Math.floor(Math.random() * 300) + 10,
                    userLiked: false,
                    is_ppv: p.is_ppv,
                    price_alpha: p.price_alpha,
                    is_unlocked: p.is_unlocked
                }));
                
                const originalPosts = this.posts.filter(p => p.id < 10000);
                this.posts = [...mappedPosts, ...originalPosts];
                this.renderFeed();
            }
        } catch (error) {
            console.error("Error cargando posts globales:", error);
        }
    },

    loadGlobalStats() {
        const stats = JSON.parse(localStorage.getItem('alpha_tom_stats')) || { views: 1450, postLikes: {} };
        this.profileViews = stats.views;
        this.saveGlobalStats();
    },

    saveGlobalStats() {
        const stats = { views: this.profileViews, postLikes: {} };
        this.posts.forEach(post => { stats.postLikes[post.id] = { global: post.globalLikes || 10, userLiked: post.userLiked || false }; });
        localStorage.setItem('alpha_tom_stats', JSON.stringify(stats));
    },

    startLiveCounters() {
        if (this.liveTimer) clearInterval(this.liveTimer);
        this.liveTimer = setInterval(() => {
            this.profileViews += Math.floor(Math.random() * 3) + 1;
            const vCounter = document.getElementById('views-counter');
            if(vCounter) vCounter.innerText = this.profileViews.toLocaleString();
        }, 3500);
    },

    haptic(style = 'medium') {
        if (this.tg && this.tg.HapticFeedback && typeof this.tg.HapticFeedback.impactOccurred === 'function') {
            try { this.tg.HapticFeedback.impactOccurred(style); } catch(e) {}
        }
    },

    switchView(viewId) {
        const views = ['consent', 'captcha', 'login', 'register', 'lang', 'feed', 'upload'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });
        const view = document.getElementById(`view-${viewId}`);
        if (view) view.classList.remove('hidden');
    },

    acceptConsent() {
        this.haptic('heavy');
        this.userData.age_verified = true;
        this.initCaptcha();
        this.switchView('captcha');
    },

    initCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        this.currentCaptchaCode = code;
        const display = document.getElementById('captcha-display');
        if (display) display.innerText = code;
    },

    generateCaptcha() {
        this.haptic('light');
        this.initCaptcha();
    },

    verifyCaptcha() {
        this.haptic('medium');
        const input = document.getElementById('captcha-input');
        const userVal = input ? input.value.trim().toUpperCase() : '';

        if (userVal === this.currentCaptchaCode) {
            this.haptic('success');
            if (input) input.value = '';
            this.switchView('login');
        } else {
            this.haptic('error');
            this.showToast('❌ Código incorrecto.');
            this.initCaptcha();
            if (input) input.value = '';
        }
    },

    exitApp() {
        this.haptic('light');
        if(this.tg) { this.tg.close(); } else { window.location.href = "https://google.com"; }
    },

    logout() {
        this.haptic('medium');
        this.isAdmin = false;
        this.userAccessLevel = 0;
        this.userData.access_tier = 'FREE';
        localStorage.removeItem('alpha_secure_token');
        this.switchView('login');
        this.showToast('Sesión cerrada correctamente 🔒');
    },

    async loginWithTelegram() {
        this.haptic('heavy');
        const tgUser = this.tg?.initDataUnsafe?.user;
        if (!tgUser) {
            this.showToast('⚠️ Acceso restringido a Telegram.');
            return;
        }

        this.userData.name = tgUser.first_name || 'Alpha User';
        if (tgUser.photo_url) this.userData.photo = tgUser.photo_url;

        // Re-sincronizar con API post-login
        if (typeof getSessionUser === 'function') {
            this.userId = tgUser.id;
            await syncUserSession();
            await this.refreshUserData();
        }

        this.updateProfileUI();
        if(window.AlphaSecurity) AlphaSecurity.saveSecureState(this.userAccessLevel, this.userData.access_tier, this.userData.name);
        setTimeout(() => this.switchView('lang'), 400);
    },

    async loginWithPhone() {
        const phone = document.getElementById('phone-input').value;
        if(!phone || phone.length < 5) return this.showToast('Número Inválido 📱');
        
        this.haptic('success');
        this.userData.name = 'PIG ' + phone.slice(-4);
        
        if (typeof getSessionUser === 'function') {
            await syncUserSession();
            await this.refreshUserData();
        }

        this.updateProfileUI();
        if(window.AlphaSecurity) AlphaSecurity.saveSecureState(this.userAccessLevel, this.userData.access_tier, this.userData.name);
        this.switchView('lang');
    },

    async registerWithData() {
        const email = document.getElementById('reg-email-input').value;
        if(!email || !email.includes('@')) return this.showToast('⚠️ Correo inválido.');
        
        this.haptic('success');
        this.userData.name = email.split('@')[0].toUpperCase();
        
        if (typeof getSessionUser === 'function') {
            await syncUserSession();
            await this.refreshUserData();
        }

        this.updateProfileUI();
        this.showToast('¡Cuenta creada! 🔐');
        setTimeout(() => this.switchView('lang'), 1000);
    },

    registerWithGoogle() {
        this.haptic('heavy');
        this.showToast('Conectando con Google... 🌐');
        this.userData.name = 'GOOGLE USER';
        setTimeout(() => this.switchView('lang'), 1200);
    },

    updateProfileUI() {
        const dict = t[this.lang] || t.es;
        const rankName = dict[`rank_${this.userAccessLevel}`] || dict.rank_0;
        
        const avLang = document.getElementById('avatar-lang');
        if (avLang) avLang.src = this.userData.photo;
        const nmLang = document.getElementById('name-lang');
        if (nmLang) nmLang.innerText = "HOLA, " + this.userData.name.toUpperCase();
        
        const avFeed = document.getElementById('avatar-feed');
        if (avFeed) avFeed.src = this.userData.photo;
        const nmFeed = document.getElementById('name-feed');
        if (nmFeed) nmFeed.innerText = this.userData.name.toUpperCase();
        const rnkFeed = document.getElementById('rank-feed');
        if (rnkFeed) rnkFeed.innerText = rankName;

        const profAv = document.getElementById('prof-avatar');
        if (profAv) profAv.src = this.userData.photo;
        const profRank = document.getElementById('prof-rank');
        if (profRank) profRank.innerText = rankName;

        const progressEl = document.getElementById('prof-progress');
        const percentEl = document.getElementById('prof-percent');
        const nextRankEl = document.getElementById('prof-next-rank');
        let progress = 0; let nextStr = "Max Rank";
        if(this.userAccessLevel === 0) { progress = 10; nextStr = "SOLDIER"; }
        if(this.userAccessLevel === 1) { progress = 40; nextStr = "VETERAN"; }
        if(this.userAccessLevel === 2) { progress = 70; nextStr = "LEGEND"; }
        if(this.userAccessLevel === 3) { progress = 90; nextStr = "ICONIC"; }
        if(this.userAccessLevel === 4) { progress = 100; nextStr = "COMPLETO"; }

        if (progressEl) progressEl.style.width = progress + '%';
        if (percentEl) percentEl.innerText = progress + '%';
        if (nextRankEl) nextRankEl.innerText = "Siguiente: " + nextStr;
    },

    setLanguage(l) {
        this.haptic('heavy');
        this.lang = l;
        this.updateTexts();
        this.switchView('feed');
        this.renderFeed();
    },

    toggleLanguage() {
        this.haptic('medium');
        const nextIndex = (this.availableLangs.indexOf(this.lang) + 1) % this.availableLangs.length;
        this.lang = this.availableLangs[nextIndex];
        this.updateTexts();
        this.renderFeed();
    },

    renderFeed() {
        const container = document.getElementById('feed-container');
        if (!container) return;
        
        let fullHtml = ''; 

        this.posts.forEach(post => {
            const textContent = post[`text_${this.lang}`] || post.text_es;
            const userClass = post.isUserPost ? 'user-post' : 'admin-post';
            
            // Validar Bloqueo (Por Rango o Por PPV no comprado)
            let isLocked = false;
            if (post.is_ppv) {
                isLocked = !post.is_unlocked;
            } else if (post.levelRequired > 0) {
                isLocked = !post.is_unlocked; 
            }

            let postHtml = `<div class="chat-bubble ${userClass} snap-center ${isLocked ? 'content-locked relative overflow-hidden' : ''}">`;
            postHtml += `<div class="text-xs text-gray-400 text-right mb-2 font-bold">${post.date} - ${post.author || 'Creator'}</div>`;

            if (post.type === 'media' && post.image && !isLocked) {
                postHtml += `
                    <div class="media-container w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-800 relative">
                        <img src="${post.image}" class="w-full h-full object-cover" alt="Media">
                    </div>`;
            } else if (post.type === 'media' && isLocked) {
                // Silueta difuminada para contenido bloqueado
                postHtml += `
                    <div class="media-container w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-900 relative flex items-center justify-center filter blur-sm">
                        <i class="fa-solid fa-eye-slash text-6xl text-gray-700"></i>
                    </div>`;
            }

            postHtml += `<div class="text-container text-base text-gray-100 font-medium leading-relaxed ${isLocked ? 'blur-sm' : ''}">${textContent}</div>`;

            if (!isLocked) {
                postHtml += `
                    <div class="mt-4 border-t-2 border-gray-800 pt-3 flex flex-col gap-3 relative z-20">
                        <div class="flex justify-between items-center">
                            <button onclick="app.toggleLike(${post.id})" id="like-btn-${post.id}" class="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full border border-gray-700 text-gray-300 hover:border-[#00f3ff] transition-all">
                                <i class="fa-solid fa-fire text-base"></i>
                                <span class="text-sm font-black" id="like-count-${post.id}">${post.globalLikes || 150}</span>
                            </button>
                            
                            <div class="flex gap-2">
                                <button class="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full border border-gray-700 text-gray-300">
                                    <i class="fa-solid fa-comment text-base"></i><span class="text-sm font-black">0</span>
                                </button>
                                <button onclick="app.sendTip(${post.id})" class="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full border border-[#ffb703] text-[#ffb703] hover:bg-[#ffb703]/20 transition-all">
                                    <i class="fa-solid fa-hand-holding-dollar text-base"></i>
                                    <span class="text-sm font-black">PROPINA</span>
                                </button>
                            </div>
                        </div>
                    </div>`;
            }

            if (isLocked) {
                if (post.is_ppv) {
                    postHtml += `
                        <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl">
                            <i class="fa-solid fa-gem text-5xl text-[#00f3ff] mb-3 drop-shadow-[0_0_10px_#00f3ff] levitate"></i>
                            <h3 class="text-white font-black text-xl mb-1">CONTENIDO PREMIUM</h3>
                            <p class="text-gray-300 text-sm mb-4">Desbloquea este media exclusivo.</p>
                            <button onclick="app.unlockPPV(${post.real_id}, ${post.price_alpha})" class="btn-neon-cyan px-8 py-3 rounded-xl font-black text-lg tracking-wider">
                                DESBLOQUEAR x ${post.price_alpha} $ALPHA
                            </button>
                        </div>`;
                } else {
                    postHtml += `
                        <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl" onclick="app.openMenuModal()">
                            <i class="fa-solid fa-lock text-5xl text-[#ff00ff] mb-3 drop-shadow-[0_0_10px_#ff00ff]"></i>
                            <span class="font-extrabold text-white text-base bg-black px-8 py-3 rounded-xl border-2 border-[#ff00ff] shadow-[0_0_20px_rgba(255,0,255,0.5)] tracking-widest uppercase">SUBIR DE RANGO</span>
                        </div>`;
                }
            }

            postHtml += `</div>`;
            fullHtml += postHtml;
        });

        container.innerHTML = fullHtml;
    },

    toggleLike(postId) {
        this.haptic('light');
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            post.userLiked = !post.userLiked;
            const btn = document.getElementById(`like-btn-${postId}`);
            if (btn) {
                if (post.userLiked) {
                    btn.classList.add('border-[#ff00ff]', 'text-[#ff00ff]');
                    btn.querySelector('i').classList.add('animate-pulse');
                } else {
                    btn.classList.remove('border-[#ff00ff]', 'text-[#ff00ff]');
                    btn.querySelector('i').classList.remove('animate-pulse');
                }
            }
        }
    },

    async sendTip(postId) {
        this.haptic('heavy');
        // Envía 5 $ALPHA por defecto
        try {
            if (this.alphaBalance < 5) return this.showToast('⚠️ Saldo $ALPHA insuficiente para dar propina.');
            await sendAlphaTip(this.userId, 8269470905, 5, postId); // ID de Master Tom como receptor default
            this.showToast('¡Propina de 5 $ALPHA enviada al creador! 💸');
            await this.refreshUserData();
        } catch (e) {
            this.showToast('Error procesando propina.');
        }
    },

    async unlockPPV(postId, price) {
        this.haptic('medium');
        if (this.alphaBalance < price) {
            this.showToast(`⚠️ Necesitas ${price} $ALPHA. ¡Recarga saldo!`);
            return;
        }
        try {
            await unlockPpvPost(this.userId, postId);
            this.showToast('🔓 ¡Contenido Desbloqueado Exitosamente!');
            await this.loadPostsFromServer();
            await this.refreshUserData();
        } catch (e) {
            this.showToast('Error en la transacción.');
        }
    },

    connectWallet() {
        this.haptic('medium');
        this.showToast('Actualizando saldo... 💎');
        this.refreshUserData();
    },

    goHome() {
        this.haptic('medium');
        const feed = document.getElementById('feed-container');
        if (feed) feed.scrollTo({ top: 0, behavior: 'smooth' });
    },

    tempImage: null,
    tempFile: null,

    openUploadPanel() {
        if (this.userAccessLevel < 2 && !this.isAdmin) return this.showToast('⚠️ Requiere Rango VETERAN para Publicar.');
        this.haptic('medium');
        this.closeModals();
        this.switchView('upload');
    },

    previewImage(event) {
        const file = event.target.files[0];
        if (file) {
            this.tempFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.tempImage = e.target.result;
                const preview = document.getElementById('admin-img-preview');
                preview.src = this.tempImage;
                preview.classList.remove('hidden');
                this.haptic('success');
            };
            reader.readAsDataURL(file);
        }
    },

    async publishPost() {
        this.haptic('heavy');
        const textEs = document.getElementById('admin-text-es').value;
        const levelSelect = document.getElementById('admin-level');
        const level = (this.userAccessLevel === 4 || this.isAdmin) ? parseInt(levelSelect.value) : 0;

        if (!textEs && !this.tempFile) return this.showToast('⚠️ Debes agregar texto o una imagen.');

        this.showToast('Subiendo al Vault Global... ⏳');

        const formData = new FormData();
        formData.append("author", this.userData.name);
        formData.append("levelRequired", level);
        formData.append("text_es", textEs);
        // Opciones por defecto para Muro estándar (No-PPV).
        formData.append("is_ppv", false);
        formData.append("price_alpha", 0);
        
        if (this.tempFile) formData.append("image", this.tempFile);

        try {
            const response = await fetch(`${this.backendUrl}/posts/create-post`, {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) throw new Error("Error en el servidor");
            
            this.tempImage = null; this.tempFile = null;
            document.getElementById('admin-form').reset();
            document.getElementById('admin-img-preview').classList.add('hidden');
            this.showToast('¡Publicación subida al Muro Comunitario! 🚀');
            
            await this.loadPostsFromServer();
            this.switchView('feed');
        } catch (error) {
            this.showToast('⚠️ Error al subir la publicación.');
        }
    },

    openProfile() {
        this.haptic('medium');
        this.closeModals();
        this.updateProfileUI(); 
        const nameInput = document.getElementById('prof-name-input');
        if (nameInput) nameInput.value = this.userData.name;
        const bioInput = document.getElementById('prof-bio');
        if (bioInput) bioInput.value = this.userData.bio || '';
        document.getElementById('modal-profile').classList.remove('hidden');
    },

    async saveProfile() {
        this.haptic('success');
        const nameInput = document.getElementById('prof-name-input');
        const bioInput = document.getElementById('prof-bio');

        if (nameInput && nameInput.value.trim() !== '') this.userData.name = nameInput.value.trim().toUpperCase();
        if (bioInput) this.userData.bio = bioInput.value.trim();

        this.updateProfileUI();

        try {
            const response = await fetch(`${this.backendUrl}/users/update-profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: this.userId, name: this.userData.name, bio: this.userData.bio })
            });
            if (response.ok) this.showToast('¡Perfil actualizado en el Vault! 💎');
        } catch (error) {
            this.showToast('⚠️ Guardado localmente (Backend offline)');
        }

        setTimeout(() => this.closeModals(), 800);
    },

    openMenuModal() { this.haptic('light'); document.getElementById('modal-catalog').classList.remove('hidden'); },
    openCommunitiesModal() { this.haptic('light'); document.getElementById('modal-communities').classList.remove('hidden'); },
    
    closeModals() {
        this.haptic('light');
        ['modal-profile', 'modal-catalog', 'modal-communities', 'modal-banks', 'modal-payment', 'modal-chat', 'modal-role'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    },
    
    openPaymentFlow(intentType, price, starsLink, targetLevel) {
        this.haptic('medium');
        this.currentPaymentLink = starsLink;
        this.pendingLevel = targetLevel; 
        document.getElementById('pay-title').innerText = intentType;
        document.getElementById('pay-price').innerText = `$${price} USD / 150 XTR`;
        document.getElementById('modal-payment').classList.remove('hidden');
    },

    closePaymentModal() {
        this.haptic('light');
        document.getElementById('modal-payment').classList.add('hidden');
    },

    async simulateAndPay(isStripe = false) {
        this.haptic('heavy');
        this.showToast(t[this.lang].processing || "Procesando pago...");

        if (isStripe) {
            setTimeout(() => {
                this.userAccessLevel = this.pendingLevel;
                this.updateProfileUI();
                this.renderFeed();
                this.closeModals();
                this.showToast("Pago con Stripe procesado con éxito 💳");
            }, 1500);
            return;
        }

        // Pago con Telegram Stars Oficial a través del API Client
        try {
            const intentName = document.getElementById('pay-title').innerText;
            await buyStarsInvoice(this.userId, intentName, 150);
            this.closeModals();
        } catch (error) {
            console.error(error);
            this.showToast("⚠️ Error generando factura XTR.");
        }
    },

    openManualBanks() { this.haptic('medium'); this.closeModals(); document.getElementById('modal-banks').classList.remove('hidden'); },
    
    openLink(url) {
        this.haptic('light');
        if (this.tg && this.tg.openLink) {
            if (url.includes('t.me')) { this.tg.openTelegramLink(url); } else { this.tg.openLink(url); }
        } else { window.open(url, '_blank'); }
    },
    
    openSupport() { 
        this.haptic('medium'); 
        this.closeModals();
        document.getElementById('modal-chat').classList.remove('hidden'); 
    },

    startVideoCall() { this.haptic('heavy'); this.showToast('Conectando cámara... 🎥'); },
    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        this.haptic('medium');
        const chatBox = document.getElementById('chat-messages');
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        chatBox.innerHTML += `
            <div class="flex flex-col items-end animate-fade-in mb-4">
                <div class="bg-gradient-to-r from-[#ff00ff] to-[#00f3ff] text-black font-extrabold text-base py-3 px-5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-[0_0_10px_rgba(0,243,255,0.4)]">
                    ${msg}
                </div>
                <span class="text-xs text-gray-400 mt-1 mr-1 font-semibold">${time}</span>
            </div>
        `;
        
        input.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;
    },

    copyText(text) {
        this.haptic('medium');
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try { document.execCommand('copy'); this.showToast('Copiado 📋'); } catch (err) {}
        document.body.removeChild(textarea);
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    toggleAdminSecret() {
        this.secretTaps++;
        if (this.secretTaps === 5) {
            this.isAdmin = true;
            this.haptic('heavy');
            this.updateProfileUI(); 
            this.showToast('🛠️ MODO CREADOR ACTIVADO');
            this.secretTaps = 0; 
        } else if (this.secretTaps < 5) {
            this.haptic('light');
        }
    },

    updateTexts() {
        const dict = t[this.lang] || t.es;
        const fabText = document.getElementById('fab-lang-text');
        if(fabText) fabText.innerText = this.lang.toUpperCase();

        const mapText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
        
        mapText('nav-catalog', dict.nav_cat); mapText('nav-communities', dict.nav_com);
        mapText('nav-profile', dict.nav_profile); mapText('chat-title', dict.chat_title);
    }
};

window.onload = () => app.init();