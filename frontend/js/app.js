const app = {
    userId: null,
    tonConnectUI: null,
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    currentCaptcha: '',
    isAdmin: false,
    userAccessLevel: 0,
    userData: { name: 'USER', access_tier: 0 },
    lastView: 'consent', // Memoria de pantalla actual[cite: 8]
    tempPostMedia: null, // Buffer de imagen cargada para publicaciones

    // ==========================================
    // 1. UTILIDADES Y SISTEMA
    // ==========================================
    haptic(style) {
        try { 
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred(style); 
            }
        } catch (e) {}
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) { 
            toast.innerText = msg; 
            toast.classList.add('show'); 
            setTimeout(() => toast.classList.remove('show'), 3000); 
        }
    },

    copyText(text) { 
        navigator.clipboard.writeText(text).then(() => this.showToast('¡Copiado! 📋')); 
    },

    openLink(url) {
        if (window.Telegram?.WebApp?.openLink) { 
            window.Telegram.WebApp.openLink(url); 
        } else { 
            window.open(url, '_blank'); 
        }
    },

    async refreshUserData() {
        if (!this.userId) this.initUserId();
        if (!this.userId) return;

        try {
            let balance = 0;
            if (typeof fetchWalletBalance === 'function') {
                const wallet = await fetchWalletBalance(this.userId);
                balance = wallet.alpha_balance;
            } else {
                const res = await fetch(`${this.backendUrl}/wallet/balance/${this.userId}`);
                if (res.ok) {
                    const data = await res.json();
                    balance = data.balance_alfa_coins ?? 0;
                }
            }

            const balanceDisplays = document.querySelectorAll('#wallet-balance, .wallet-balance-val');
            balanceDisplays.forEach(el => {
                el.innerText = `${balance} $ALPHA`;
            });
        } catch (err) {
            console.warn('[WALLET REFRESH ERROR]:', err);
        }
    },

    updateProfileUI() {
        // Cargar Alias[cite: 8]
        const savedName = localStorage.getItem('alpha_user_name') || this.userData?.name;
        const aliasInput = document.getElementById('prof-alias');
        if (aliasInput && savedName) {
            aliasInput.value = savedName;
            this.userData.name = savedName;
        }

        // Cargar Biografía[cite: 8]
        const savedBio = localStorage.getItem('alpha_user_bio');
        const bioInput = document.getElementById('prof-bio');
        if (bioInput && savedBio) {
            bioInput.value = savedBio;
        }

        // Cargar Foto de Perfil[cite: 8]
        const savedAvatar = localStorage.getItem('alpha_user_avatar');
        const avatarImg = document.getElementById('prof-avatar-img');
        if (avatarImg && savedAvatar) {
            avatarImg.src = savedAvatar;
            avatarImg.classList.remove('hidden');
        }

        // Cargar Rango[cite: 8]
        const rankDisplay = document.getElementById('prof-rank');
        if (rankDisplay) {
            const ranks = ['ESPÍA 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICONIC 💎'];
            rankDisplay.innerText = ranks[this.userData?.access_tier || 0] || ranks[0];
        }
    },

    initUserId() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            this.userId = window.Telegram.WebApp.initDataUnsafe.user.id;
        } else if (typeof getSessionUser === 'function') {
            this.userId = getSessionUser().user_id;
        } else {
            let localId = localStorage.getItem("alpha_user_id");
            if (!localId) {
                localId = "99" + Math.floor(100000 + Math.random() * 900000);
                localStorage.setItem("alpha_user_id", localId);
            }
            this.userId = parseInt(localId);
        }
    },

    // ==========================================
    // 2. GESTIÓN DE PERFIL Y AVATAR
    // ==========================================
    triggerAvatarInput() {
        this.haptic('light');
        const input = document.getElementById('avatar-file-input');
        if (input) input.click();
    },

    handleAvatarChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const avatarUrl = e.target.result;
            localStorage.setItem('alpha_user_avatar', avatarUrl);
            
            const avatarImg = document.getElementById('prof-avatar-img');
            if (avatarImg) {
                avatarImg.src = avatarUrl;
                avatarImg.classList.remove('hidden');
            }
            this.showToast('¡Foto de perfil actualizada! 📸');
        };
        reader.readAsDataURL(file);
    },

    saveProfile() {
        this.haptic('medium');
        const aliasInput = document.getElementById('prof-alias');
        const bioInput = document.getElementById('prof-bio');

        const newName = aliasInput ? aliasInput.value.trim() : '';
        const newBio = bioInput ? bioInput.value.trim() : '';

        if (newName) {
            this.userData.name = newName;
            localStorage.setItem('alpha_user_name', newName);
        }
        if (newBio) {
            localStorage.setItem('alpha_user_bio', newBio);
        }

        if (this.userId && typeof syncUserSession === 'function') {
            syncUserSession();
        }

        this.showToast('¡Perfil guardado correctamente! 🛡️');
        this.updateProfileUI();
    },

    // ==========================================
    // 3. BILLETERA Y TONCONNECT
    // ==========================================
    async connectWallet() {
        try {
            this.haptic('medium');
            this.initUserId();

            if (window.TON_CONNECT_UI) {
                if (!this.tonConnectUI) {
                    this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ 
                        manifestUrl: window.location.origin + '/tonconnect-manifest.json' 
                    });

                    this.tonConnectUI.onStatusChange(async (wallet) => {
                        if (wallet?.account) {
                            this.showToast('¡Billetera conectada con éxito! 💎');
                            try {
                                await fetch(`${this.backendUrl}/wallet/connect-ton`, {
                                    method: "POST", 
                                    headers: { "Content-Type": "application/json" }, 
                                    body: JSON.stringify({ 
                                        user_id: this.userId || 0, 
                                        ton_address: wallet.account.address 
                                    })
                                });
                            } catch (apiErr) { 
                                console.warn(apiErr); 
                            }
                            await this.refreshUserData();
                        }
                    });
                }
                await this.tonConnectUI.openModal();
            }
        } catch (err) { 
            this.showToast('⚠️ Error abriendo la billetera.'); 
        }
    },

    async rechargeAlphaCoins(amountTon, alphaAmount) {
        try {
            this.haptic('heavy');
            if (!this.tonConnectUI?.connected) { 
                this.showToast('⚠️ Conecta tu billetera TON primero.'); 
                return; 
            }

            this.showToast('Preparando transacción TON...');
            const nanoTonAmount = Math.floor(amountTon * 1000000000).toString();
            const transaction = { 
                validUntil: Math.floor(Date.now() / 1000) + 360, 
                messages: [{ 
                    address: "UQDWI2auHgQ5a9KnWn9_by-RSswIaKfz38b_Yib_cIy-Jklp", 
                    amount: nanoTonAmount 
                }] 
            };

            const result = await this.tonConnectUI.sendTransaction(transaction);
            this.showToast('¡Pago en TON procesado! Acreditando... 💎');

            await fetch(`${this.backendUrl}/wallet/recharge`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ 
                    user_id: this.userId || 0, 
                    amount_ton: amountTon, 
                    alpha_added: alphaAmount, 
                    boc: result?.boc || "DIRECT_TX" 
                }) 
            });

            await this.refreshUserData();
            this.showToast(`¡Recarga exitosa! +${alphaAmount} $ALPHA 🚀`);
        } catch (err) { 
            this.showToast('⚠️ Transacción cancelada o fallida.'); 
        }
    },

    // ==========================================
    // 4. CAPTCHA Y VISTAS
    // ==========================================
    switchView(viewName) {
        const views = ['consent', 'login', 'captcha', 'register', 'lang', 'feed', 'upload'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            window.scrollTo(0, 0); 
            if (viewName !== 'lang') {
                this.lastView = viewName; 
            }
        }
    },

    goHome() { 
        this.haptic('light'); 
        this.closeModals(); 
        this.switchView('feed'); 
        this.renderFeed();
    },

    acceptConsent() {
        this.haptic('medium');
        try { localStorage.setItem('alpha_consent', 'true'); } catch (e) {}
        this.switchView('captcha');
        this.generateCaptcha();
    },

    generateCaptcha() {
        this.haptic('light');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        this.currentCaptcha = code;
        const display = document.getElementById('captcha-display');
        if (display) display.innerText = code;
        const input = document.getElementById('captcha-input');
        if (input) input.value = '';
    },

    verifyCaptcha() {
        this.haptic('medium');
        const input = document.getElementById('captcha-input');
        const display = document.getElementById('captcha-display');
        const actualCaptcha = (this.currentCaptcha || (display ? display.innerText : '')).trim();
        const userValue = input ? input.value.trim().toUpperCase() : '';

        if (userValue === actualCaptcha && userValue !== '') {
            this.showToast('¡Verificación exitosa! 🛡️');
            this.switchView('login');
        } else {
            this.showToast('⚠️ Código incorrecto.');
            this.generateCaptcha();
        }
    },

    // ==========================================
    // 5. MODALES VISUALES
    // ==========================================
    closeModals() {
        this.haptic('light');
        ['modal-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-banks', 'modal-chat'].forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.add('hidden');
        });
    },

    openProfile() { 
        this.closeModals(); 
        document.getElementById('modal-profile')?.classList.remove('hidden'); 
        this.updateProfileUI();
        this.refreshUserData();
    },
    openMenuModal() { this.closeModals(); document.getElementById('modal-catalog')?.classList.remove('hidden'); },
    openCommunitiesModal() { this.closeModals(); document.getElementById('modal-communities')?.classList.remove('hidden'); },
    openSupport() { this.closeModals(); document.getElementById('modal-chat')?.classList.remove('hidden'); },
    openManualBanks() { this.closeModals(); document.getElementById('modal-banks')?.classList.remove('hidden'); },
    openUploadPanel() { this.closeModals(); this.switchView('upload'); },
    openRoleModal() { this.closeModals(); document.getElementById('modal-role')?.classList.remove('hidden'); },
    openPaymentFlow(plan, price, link, tier) { this.closeModals(); document.getElementById('modal-payment')?.classList.remove('hidden'); },
    closePaymentModal() { document.getElementById('modal-payment')?.classList.add('hidden'); },

    // ==========================================
    // 6. INTERACCIÓN Y SESIÓN
    // ==========================================
    checkSession() {
        try {
            this.initUserId();
            const savedLang = localStorage.getItem('alpha_lang') || 'es';
            this.currentLang = savedLang;
            const langText = document.getElementById('fab-lang-text');
            if (langText) langText.innerText = savedLang.toUpperCase();
            if (typeof window.applyTranslations === 'function') window.applyTranslations(savedLang);

            const isLoggedIn = localStorage.getItem('alpha_logged_in');
            const hasConsent = localStorage.getItem('alpha_consent');

            if (isLoggedIn === 'true') { 
                this.switchView('feed'); 
                this.updateProfileUI();
                this.refreshUserData();
                this.renderFeed();
            } else if (hasConsent === 'true') { 
                this.switchView('login'); 
            } else { 
                this.switchView('consent'); 
            }
        } catch (e) {}
    },

    loginWithTelegram() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        this.switchView('feed'); 
        this.updateProfileUI();
        this.refreshUserData();
        this.renderFeed();
    },
    loginWithPhone() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        this.switchView('feed'); 
        this.updateProfileUI();
        this.refreshUserData();
        this.renderFeed();
    },
    registerWithData() { this.haptic('medium'); this.switchView('login'); },
    registerWithGoogle() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        this.switchView('feed'); 
        this.updateProfileUI();
        this.refreshUserData();
        this.renderFeed();
    },
    exitApp() { if (window.Telegram?.WebApp) window.Telegram.WebApp.close(); },
    logout() { 
        this.haptic('medium'); 
        localStorage.removeItem('alpha_logged_in'); 
        this.switchView('consent'); 
    },

    // ==========================================
    // 7. IDIOMA Y ADMIN
    // ==========================================
    toggleLanguage() { this.haptic('medium'); this.switchView('lang'); },
    
    setLanguage(lang) { 
        this.haptic('light');
        localStorage.setItem('alpha_lang', lang);
        this.currentLang = lang;
        const langText = document.getElementById('fab-lang-text');
        if (langText) langText.innerText = lang.toUpperCase();
        if (typeof window.applyTranslations === 'function') window.applyTranslations(lang);
        this.showToast(`Idioma: ${lang.toUpperCase()}`);
        this.switchView(this.lastView || 'consent');
    },

    toggleAdminSecret() { 
        this.haptic('light');
        this.initUserId();
        const MI_TELEGRAM_ID = 8269470905; 

        if (this.userId == MI_TELEGRAM_ID) {
            this.isAdmin = !this.isAdmin; 
            this.showToast(this.isAdmin ? 'Admin Mode ON 👑' : 'Admin Mode OFF');
            this.haptic('medium');
        } else {
            this.showToast(`Acceso denegado 🚫 (Tu ID es: ${this.userId})`);
            this.haptic('heavy');
        }
    },
    
    // ==========================================
    // 8. MURO, SUBIDA DE POSTS Y PROPINAS
    // ==========================================
    previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        const reader = new FileReader();
        reader.onload = (e) => {
            this.tempPostMedia = e.target.result;
            const uploadTxt = document.getElementById('txt-upload');
            if (uploadTxt) uploadTxt.innerText = `¡Imagen cargada! 📸 (${file.name})`;
            this.showToast('Foto cargada correctamente 📸');
        };
        reader.readAsDataURL(file);
    },

    publishPost() {
        this.haptic('medium');
        const descInput = document.getElementById('admin-text-es');
        const levelSelect = document.getElementById('admin-level');

        const content = descInput ? descInput.value.trim() : '';
        const tierRequired = levelSelect ? parseInt(levelSelect.value) : 0;

        if (!content && !this.tempPostMedia) {
            this.showToast('⚠️ Ingresa una descripción o selecciona una imagen.');
            return;
        }

        const newPost = {
            id: Date.now(),
            creator_id: this.userId || 99999,
            author_name: this.userData?.name || "Cyber Operative",
            content: content,
            media_url: this.tempPostMedia,
            tier: tierRequired,
            likes: 0
        };

        let localPosts = [];
        try {
            localPosts = JSON.parse(localStorage.getItem('alpha_local_posts') || '[]');
        } catch (e) {
            localPosts = [];
        }
        localPosts.unshift(newPost);
        localStorage.setItem('alpha_local_posts', JSON.stringify(localPosts));

        // Limpiar inputs
        if (descInput) descInput.value = '';
        this.tempPostMedia = null;
        const uploadTxt = document.getElementById('txt-upload');
        if (uploadTxt) uploadTxt.innerText = 'Tocar para subir archivo';
        const fileInput = document.getElementById('admin-file');
        if (fileInput) fileInput.value = '';

        this.showToast('¡Publicación subida al muro con éxito! 🚀');
        this.switchView('feed');
        this.renderFeed();
    },

    async renderFeed() {
        const feedContainer = document.getElementById('feed-container') || document.querySelector('#view-feed .feed-posts');
        if (!feedContainer) return;

        try {
            let posts = [];
            if (typeof fetchGlobalFeed === 'function') {
                posts = await fetchGlobalFeed(this.userId || 0);
            } else {
                const res = await fetch(`${this.backendUrl}/get-posts`);
                if (res.ok) {
                    const data = await res.json();
                    posts = data.posts || data || [];
                }
            }

            let localPosts = [];
            try {
                localPosts = JSON.parse(localStorage.getItem('alpha_local_posts') || '[]');
            } catch (e) {
                localPosts = [];
            }

            const allPosts = [...localPosts, ...(Array.isArray(posts) ? posts : [])];

            if (!allPosts || allPosts.length === 0) {
                allPosts.push({
                    id: 1,
                    creator_id: 99999,
                    author_name: "Alpha Operative",
                    content: "Bienvenido al Muro VIP de Alpha Vault. Apoya a los creadores enviando propinas en tokens $ALPHA.",
                    media_url: null,
                    likes: 24
                });
            }

            feedContainer.innerHTML = allPosts.map(post => `
                <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="font-bold text-amber-400">@${post.author_name || 'Creador VIP'}</div>
                        <span class="text-xs text-neutral-500">ID #${post.id}</span>
                    </div>
                    ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${post.content}</p>` : ''}
                    ${post.media_url ? `<img src="${post.media_url}" class="rounded-xl w-full max-h-72 object-cover mb-3 border border-neutral-800" alt="Media"/>` : ''}
                    <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                        <span class="text-xs text-neutral-400">❤️ ${post.likes || 0} Likes</span>
                        <button onclick="app.sendTipFromPost(${post.creator_id || 99999}, 10, ${post.id})" class="bg-amber-500 hover:bg-amber-600 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 text-xs shadow-md transition active:scale-95">
                            🪙 Dar 10 $ALPHA
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.warn('[FEED RENDER ERROR]:', err);
        }
    },

    async sendTipFromPost(creatorId, amount, postId = null) {
        try {
            this.haptic('medium');
            this.initUserId();

            if (!this.userId) {
                this.showToast('⚠️ Debes iniciar sesión para dar propinas.');
                return;
            }

            this.showToast('Procesando propina... ⚡');
            const result = await sendAlphaTip(this.userId, creatorId, amount, postId);

            if (result && result.status === 'success') {
                this.showToast(`¡Propina de ${result.amount_sent} $ALPHA enviada! 🚀`);
                await this.refreshUserData();
            }
        } catch (error) {
            this.showToast(`⚠️ ${error.message || 'Error al procesar la propina.'}`);
        }
    },

    simulateAndPay() { this.showToast('Simulando pago...'); },
    startVideoCall() { this.showToast('Conectando Video Llamada Segura... 📹'); },
    sendChatMessage() { 
        const i = document.getElementById('chat-input'); 
        if (i?.value) { 
            this.showToast('Mensaje enviado'); 
            i.value = ''; 
        } 
    },
    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },
    selectCreatorRole() { this.showToast('Rol de Creador seleccionado'); this.closeModals(); },
    selectFanRole() { this.showToast('Rol de Fan seleccionado'); this.closeModals(); }
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => {
    app.checkSession(); 
    if (typeof app.generateCaptcha === 'function') app.generateCaptcha();
});