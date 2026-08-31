const app = {
    userId: null,
    tonConnectUI: null,
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    currentCaptcha: '',
    isAdmin: false,
    userAccessLevel: 0,
    userData: { name: 'USER', access_tier: 0, role: 'fan' },
    lastView: 'consent',
    tempPostMedia: null,
    registerRoleSelected: 'fan',
    
    // 🛡️ BUFFER KYC (+18)
    tempKYCDoc: null,
    tempKYCSelfie: null,

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
            setTimeout(() => toast.classList.remove('show'), 3500); 
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

    compressImage(file, maxWidth = 1024, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
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
                    balance = data.balance_alfa_coins ?? data.alpha_balance ?? 0;
                }
            }

            const balanceDisplays = document.querySelectorAll('#prof-alpha-balance, #wallet-balance, .wallet-balance-val');
            balanceDisplays.forEach(el => {
                el.innerText = `${balance} $ALPHA`;
            });
        } catch (err) {
            console.warn('[WALLET REFRESH ERROR]:', err);
        }
    },

    async syncKYCStatus() {
        if (!this.userId) this.initUserId();
        if (!this.userId) return;

        try {
            const res = await fetch(`${this.backendUrl}/kyc/status/${this.userId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.kyc_status) {
                    localStorage.setItem('alpha_kyc_status', data.kyc_status);
                    if (data.role) {
                        this.userData.role = data.role;
                        localStorage.setItem('alpha_user_role', data.role);
                    }
                    if (data.name && data.name !== 'USER') {
                        this.userData.name = data.name;
                        localStorage.setItem('alpha_user_name', data.name);
                    }
                    this.updateProfileUI();
                }
            }
        } catch (err) {
            console.warn('[KYC SYNC ERROR]:', err);
        }
    },

    updateProfileUI() {
        const savedName = localStorage.getItem('alpha_user_name') || this.userData?.name;
        const aliasInput = document.getElementById('prof-alias');
        if (aliasInput && savedName) {
            aliasInput.value = savedName;
            this.userData.name = savedName;
        }

        const nameFeed = document.getElementById('name-feed');
        if (nameFeed && savedName) {
            nameFeed.innerText = savedName;
        }

        const savedBio = localStorage.getItem('alpha_user_bio');
        const bioInput = document.getElementById('prof-bio');
        if (bioInput && savedBio) {
            bioInput.value = savedBio;
        }

        const savedAvatar = localStorage.getItem('alpha_user_avatar');
        const avatarImg = document.getElementById('prof-avatar-img');
        const avatarFeed = document.getElementById('avatar-feed');
        if (savedAvatar) {
            if (avatarImg) {
                avatarImg.src = savedAvatar;
                avatarImg.classList.remove('hidden');
            }
            if (avatarFeed) {
                avatarFeed.src = savedAvatar;
            }
        }

        const rankDisplay = document.getElementById('prof-rank');
        const rankFeed = document.getElementById('rank-feed');
        const ranks = ['ESPÍA 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICONIC 💎'];
        const currentRank = ranks[this.userData?.access_tier || 0] || ranks[0];

        if (rankDisplay) rankDisplay.innerText = currentRank;
        if (rankFeed) rankFeed.innerText = currentRank;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status');
        const kycDescEl = document.getElementById('prof-kyc-desc');
        const kycBtn = document.getElementById('btn-verify-kyc');

        if (kycStatusEl) {
            if (kycStatus === 'verified') {
                kycStatusEl.innerText = 'VERIFICADO (+18) ✅';
                kycStatusEl.className = 'text-xs font-black uppercase text-green-400';
                if (kycDescEl) kycDescEl.innerText = 'Identidad y mayoría de edad confirmada. Acceso total activo.';
                if (kycBtn) kycBtn.classList.add('hidden');
            } else if (kycStatus === 'pending') {
                kycStatusEl.innerText = 'EN REVISIÓN ⏳';
                kycStatusEl.className = 'text-xs font-black uppercase text-amber-400';
                if (kycDescEl) kycDescEl.innerText = 'Tus documentos están siendo auditados por el Búnker Admin.';
                if (kycBtn) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerText = 'SOLICITUD EN PROCESO ⏳';
                    kycBtn.disabled = true;
                }
            } else if (kycStatus === 'rejected') {
                kycStatusEl.innerText = 'RECHAZADO ❌';
                kycStatusEl.className = 'text-xs font-black uppercase text-red-500';
                if (kycDescEl) kycDescEl.innerText = 'Documento o selfie no legible. Por favor vuelve a enviar tus datos.';
                if (kycBtn) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerText = 'REINTENTAR VERIFICACIÓN 🔄';
                    kycBtn.disabled = false;
                }
            } else {
                kycStatusEl.innerText = 'NO VERIFICADO ⚠️';
                kycStatusEl.className = 'text-xs font-black uppercase text-neutral-400';
                if (kycDescEl) kycDescEl.innerText = 'Verifica tu documento oficial y selfie para publicar y monetizar.';
                if (kycBtn) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerText = 'VERIFICAR CUENTA AHORA 🪪';
                    kycBtn.disabled = false;
                }
            }
        }
    },

    updateViewsCounter() {
        let views = parseInt(localStorage.getItem('alpha_real_views') || '0');
        views += 1;
        localStorage.setItem('alpha_real_views', views.toString());

        const viewsEl = document.getElementById('views-counter');
        if (viewsEl) {
            viewsEl.innerText = views.toLocaleString();
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
    // 2. COMPRA DE PAQUETES $ALPHA (STARS & TON)
    // ==========================================
    async buyPackageStars(packageSlug) {
        this.haptic('medium');
        this.initUserId();

        this.showToast('Generando factura de Telegram Stars... ⭐');

        try {
            const res = await fetch(`${this.backendUrl}/payments/create-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.userId,
                    package_slug: packageSlug
                })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success' && data.invoice_link) {
                if (window.Telegram?.WebApp?.openInvoice) {
                    window.Telegram.WebApp.openInvoice(data.invoice_link, async (status) => {
                        if (status === 'paid') {
                            this.haptic('heavy');
                            this.showToast('¡Pago completado! Acreditando tokens... 💎');
                            await this.refreshUserData();
                        } else if (status === 'cancelled') {
                            this.showToast('Pago cancelado');
                        } else if (status === 'failed') {
                            this.showToast('⚠️ El pago con Stars no pudo completarse');
                        }
                    });
                } else {
                    window.open(data.invoice_link, '_blank');
                }
            } else {
                throw new Error(data.detail || 'Error al generar la factura');
            }
        } catch (err) {
            console.error('[BUY STARS ERROR]:', err);
            this.showToast(`⚠️ ${err.message || 'Error con el servidor de pagos'}`);
        }
    },

    async openCatalogPackages() {
        this.closeModals();
        const modal = document.getElementById('modal-catalog');
        if (!modal) return;
        modal.classList.remove('hidden');

        const container = document.getElementById('catalog-packages-list');
        if (!container) return;

        try {
            const res = await fetch(`${this.backendUrl}/payments/packages`);
            if (res.ok) {
                const data = await res.json();
                const packages = data.packages || [];

                container.innerHTML = packages.map(pkg => `
                    <div class="bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col justify-between transition shadow-lg">
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-bold text-amber-400 uppercase">${pkg.badge || '💎 PACK'}</span>
                                ${pkg.bonus_percentage > 0 ? `<span class="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-500/40">+${pkg.bonus_percentage}% EXTRA</span>` : ''}
                            </div>
                            <h4 class="text-base font-black text-white">${pkg.name}</h4>
                            <p class="text-2xl font-black text-amber-400 my-1">${pkg.alpha_total} <span class="text-xs text-neutral-400">$ALPHA</span></p>
                            <p class="text-xs text-neutral-400 mb-3">${pkg.description || 'Tokens válidos para propinas y contenido'}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <button onclick="app.buyPackageStars('${pkg.slug}')" class="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 text-black font-black py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md transition active:scale-95">
                                ⭐ ${pkg.price_stars} Stars
                            </button>
                            <button onclick="app.rechargeAlphaCoins(${pkg.price_ton}, ${pkg.alpha_total})" class="bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-cyan-500/30 font-black py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md transition active:scale-95">
                                💎 ${pkg.price_ton} TON
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.warn('[PACKAGES LOAD ERROR]:', err);
        }
    },

    // ==========================================
    // 3. GESTIÓN DE PERFIL Y AVATAR
    // ==========================================
    triggerAvatarInput() {
        this.haptic('light');
        const input = document.getElementById('avatar-file-input');
        if (input) input.click();
    },

    async handleAvatarChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        this.showToast('Optimizando foto... 📸');
        const avatarUrl = await this.compressImage(file, 400, 0.8);
        localStorage.setItem('alpha_user_avatar', avatarUrl);
        
        const avatarImg = document.getElementById('prof-avatar-img');
        const avatarFeed = document.getElementById('avatar-feed');
        if (avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.classList.remove('hidden');
        }
        if (avatarFeed) {
            avatarFeed.src = avatarUrl;
        }
        this.showToast('¡Foto de perfil actualizada! 📸');
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
    // 4. VERIFICACIÓN KYC (+18)
    // ==========================================
    openKYCModal() {
        this.closeModals();
        document.getElementById('modal-kyc')?.classList.remove('hidden');
    },

    async handleKYCDocPreview(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        this.showToast('Comprimiendo documento... ⏳');
        this.tempKYCDoc = await this.compressImage(file, 1200, 0.75);
        
        const label = document.getElementById('kyc-doc-label');
        if (label) label.innerText = `✅ Documento listo (${file.name})`;
        this.showToast('Documento procesado 🪪');
    },

    async handleKYCSelfiePreview(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        this.showToast('Comprimiendo selfie... ⏳');
        this.tempKYCSelfie = await this.compressImage(file, 1024, 0.75);
        
        const label = document.getElementById('kyc-selfie-label');
        if (label) label.innerText = `✅ Selfie lista (${file.name})`;
        this.showToast('Selfie procesada 📸');
    },

    async submitKYC() {
        this.haptic('medium');
        const legalName = document.getElementById('kyc-legal-name')?.value.trim();

        if (!legalName) {
            this.showToast('⚠️ Ingresa tu nombre legal completo.');
            return;
        }
        if (!this.tempKYCDoc) {
            this.showToast('⚠️ Selecciona la foto de tu documento.');
            return;
        }
        if (!this.tempKYCSelfie) {
            this.showToast('⚠️ Sube tu selfie con la fecha de hoy.');
            return;
        }

        this.initUserId();
        this.showToast('Enviando solicitud al Búnker Admin... 🛡️');

        try {
            const res = await fetch(`${this.backendUrl}/kyc/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId || 0,
                    legal_name: legalName,
                    document_base64: this.tempKYCDoc,
                    selfie_base64: this.tempKYCSelfie
                })
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                localStorage.setItem('alpha_kyc_status', 'pending');
                localStorage.setItem('alpha_legal_name', legalName);
                this.showToast('¡Solicitud enviada al Canal Búnker! 🚀');
                this.closeModals();
                this.updateProfileUI();
            } else {
                throw new Error(data.detail || data.message || 'Error al procesar en el servidor');
            }
        } catch (err) {
            console.error('[KYC SUBMIT ERROR]:', err);
            this.showToast(`⚠️ Error: ${err.message || 'No se pudo contactar al backend'}`);
        }
    },

    // ==========================================
    // 5. BILLETERA Y TONCONNECT
    // ==========================================
    async initTonConnect() {
        if (!this.tonConnectUI && window.TON_CONNECT_UI) {
            try {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ 
                    manifestUrl: window.location.origin + '/tonconnect-manifest.json' 
                });

                this.tonConnectUI.onStatusChange(async (wallet) => {
                    const btnHdr = document.getElementById('btn-wallet-hdr');
                    if (wallet?.account) {
                        const shortAddress = wallet.account.address.slice(0, 4) + '...' + wallet.account.address.slice(-4);
                        if (btnHdr) btnHdr.innerText = shortAddress;
                        this.showToast('¡Billetera conectada! 💎');

                        try {
                            await fetch(`${this.backendUrl}/wallet/connect-ton`, {
                                method: "POST", 
                                headers: { "Content-Type": "application/json" }, 
                                body: JSON.stringify({ 
                                    user_id: this.userId || 0, 
                                    ton_address: wallet.account.address 
                                })
                            });
                        } catch (e) {}
                        await this.refreshUserData();
                    } else {
                        if (btnHdr) btnHdr.innerText = 'CONECTAR WALLET';
                    }
                });
            } catch (err) {
                console.warn('[TONCONNECT INIT ERROR]:', err);
            }
        }
    },

    async connectWallet() {
        try {
            this.haptic('medium');
            this.initUserId();
            await this.initTonConnect();

            if (!this.tonConnectUI) {
                this.showToast('⚠️ Módulo TON no disponible.');
                return;
            }

            if (this.tonConnectUI.connected) {
                const disconnect = confirm('Tu billetera ya está conectada. ¿Deseas desconectarla?');
                if (disconnect) {
                    await this.tonConnectUI.disconnect();
                    this.showToast('Billetera desconectada.');
                    const btnHdr = document.getElementById('btn-wallet-hdr');
                    if (btnHdr) btnHdr.innerText = 'CONECTAR WALLET';
                }
            } else {
                await this.tonConnectUI.openModal();
            }
        } catch (err) { 
            console.error('[WALLET CONNECT ERROR]:', err);
            this.showToast('⚠️ Error abriendo el selector de wallets.'); 
        }
    },

    async rechargeAlphaCoins(amountTon, alphaAmount) {
        try {
            this.haptic('heavy');
            await this.initTonConnect();

            if (!this.tonConnectUI || !this.tonConnectUI.connected || !this.tonConnectUI.account) { 
                this.showToast('⚠️ Primero conecta tu billetera TON desde el botón superior.');
                await this.connectWallet();
                return; 
            }

            this.showToast('Confirmando transacción en tu billetera... ⚡');
            const nanoTonAmount = Math.floor(amountTon * 1000000000).toString();
            const transaction = { 
                validUntil: Math.floor(Date.now() / 1000) + 360, 
                messages: [{ 
                    address: "UQDWI2auHgQ5a9KnWn9_by-RSswIaKfz38b_Yib_cIy-Jklp", 
                    amount: nanoTonAmount 
                }] 
            };

            const result = await this.tonConnectUI.sendTransaction(transaction);
            this.showToast('¡Pago procesado! Acreditando $ALPHA... 💎');

            const res = await fetch(`${this.backendUrl}/wallet/recharge`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ 
                    user_id: this.userId || 0, 
                    amount_ton: amountTon, 
                    alpha_added: alphaAmount, 
                    boc: result?.boc || "DIRECT_TX" 
                }) 
            });

            if (res.ok) {
                await this.refreshUserData();
                this.showToast(`¡Recarga exitosa! +${alphaAmount} $ALPHA 🚀`);
            } else {
                this.showToast('⚠️ Error al asentar saldo en backend.');
            }
        } catch (err) { 
            console.error('[RECHARGE ERROR]:', err);
            this.showToast('⚠️ Transacción cancelada o fallida.'); 
        }
    },

    // ==========================================
    // 6. REGISTRO, LOGIN Y SESIONES
    // ==========================================
    setRegisterRole(role) {
        this.haptic('light');
        this.registerRoleSelected = role;
        const btnFan = document.getElementById('reg-role-fan');
        const btnCreator = document.getElementById('reg-role-creator');

        if (role === 'fan') {
            btnFan?.classList.replace('border-neutral-700', 'border-[#ff00ff]');
            btnFan?.classList.replace('bg-black', 'bg-[#ff00ff]/20');
            btnFan?.classList.replace('text-neutral-400', 'text-white');

            btnCreator?.classList.replace('border-[#00f3ff]', 'border-neutral-700');
            btnCreator?.classList.replace('bg-[#00f3ff]/20', 'bg-black');
            btnCreator?.classList.replace('text-white', 'text-neutral-400');
        } else {
            btnCreator?.classList.replace('border-neutral-700', 'border-[#00f3ff]');
            btnCreator?.classList.replace('bg-black', 'bg-[#00f3ff]/20');
            btnCreator?.classList.replace('text-neutral-400', 'text-white');

            btnFan?.classList.replace('border-[#ff00ff]', 'border-neutral-700');
            btnFan?.classList.replace('bg-[#ff00ff]/20', 'bg-black');
            btnFan?.classList.replace('text-white', 'text-neutral-400');
        }
    },

    registerWithData() {
        this.haptic('medium');
        const email = document.getElementById('reg-email-input')?.value.trim();
        const phone = document.getElementById('reg-phone-input')?.value.trim();
        const pass = document.getElementById('reg-password-input')?.value.trim();
        const remember = document.getElementById('reg-remember')?.checked;

        if (!phone && !email) {
            this.showToast('⚠️ Ingresa al menos un número o correo.');
            return;
        }
        if (!pass || pass.length < 4) {
            this.showToast('⚠️ La contraseña debe tener al menos 4 caracteres.');
            return;
        }

        const isCreator = this.registerRoleSelected === 'creator';
        this.userData.role = this.registerRoleSelected;
        this.userData.name = phone || email.split('@')[0] || (isCreator ? "mastertom" : "VIP Fan");
        
        if (remember) {
            localStorage.setItem('alpha_remember_user', JSON.stringify({
                phone: phone,
                email: email,
                pass: pass,
                role: this.registerRoleSelected
            }));
        }

        localStorage.setItem('alpha_logged_in', 'true');
        localStorage.setItem('alpha_user_name', this.userData.name);
        localStorage.setItem('alpha_user_role', this.registerRoleSelected);

        this.showToast(`¡Cuenta creada como ${isCreator ? 'CREADOR 👑' : 'FAN 💎'}!`);
        this.switchView('feed');
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    loginWithPhone() {
        this.haptic('medium');
        const phone = document.getElementById('phone-input')?.value.trim();
        const pass = document.getElementById('login-password')?.value.trim();
        const remember = document.getElementById('login-remember')?.checked;

        if (!phone) {
            this.showToast('⚠️ Ingresa tu número de teléfono.');
            return;
        }

        if (remember) {
            localStorage.setItem('alpha_remember_user', JSON.stringify({ phone, pass }));
        }

        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true');
        this.switchView('feed');
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    loginWithTelegram() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        this.switchView('feed'); 
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    registerWithGoogle() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        this.switchView('feed'); 
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    async checkSession() {
        try {
            this.initUserId();
            this.initTonConnect();
            const savedLang = localStorage.getItem('alpha_lang') || 'es';
            this.currentLang = savedLang;
            const langText = document.getElementById('fab-lang-text');
            if (langText) langText.innerText = savedLang.toUpperCase();
            if (typeof window.applyTranslations === 'function') window.applyTranslations(savedLang);

            const savedCredentials = localStorage.getItem('alpha_remember_user');
            if (savedCredentials) {
                const creds = JSON.parse(savedCredentials);
                const phoneLogin = document.getElementById('phone-input');
                const passLogin = document.getElementById('login-password');
                const rememberLogin = document.getElementById('login-remember');

                if (phoneLogin && creds.phone) phoneLogin.value = creds.phone;
                if (passLogin && creds.pass) passLogin.value = creds.pass;
                if (rememberLogin) rememberLogin.checked = true;
            }

            const hasConsent = localStorage.getItem('alpha_consent');
            const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

            if (tgUser && tgUser.id) {
                localStorage.setItem('alpha_logged_in', 'true');
                localStorage.setItem('alpha_consent', 'true');
                if (!localStorage.getItem('alpha_user_name')) {
                    const tgName = tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : '');
                    localStorage.setItem('alpha_user_name', tgName || tgUser.username || 'VIP User');
                }
            }

            const activeLogin = localStorage.getItem('alpha_logged_in');

            if (activeLogin === 'true') { 
                this.switchView('feed'); 
                this.updateProfileUI();
                this.updateViewsCounter();
                await this.syncKYCStatus();
                await this.refreshUserData();
                this.renderFeed();
            } else if (hasConsent === 'true') { 
                this.switchView('login'); 
            } else { 
                this.switchView('consent'); 
            }
        } catch (e) {
            console.warn('[SESSION CHECK ERROR]:', e);
        }
    },

    exitApp() { if (window.Telegram?.WebApp) window.Telegram.WebApp.close(); },
    logout() { 
        this.haptic('medium'); 
        localStorage.removeItem('alpha_logged_in'); 
        this.switchView('consent'); 
    },

    // ==========================================
    // 7. VISTAS Y NAVEGACIÓN
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

    closeModals() {
        this.haptic('light');
        ['modal-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-banks', 'modal-chat', 'modal-kyc'].forEach(m => {
            const el = document.getElementById(m);
            if (el) el.classList.add('hidden');
        });
    },

    openProfile() { 
        this.closeModals(); 
        document.getElementById('modal-profile')?.classList.remove('hidden'); 
        this.syncKYCStatus();
        this.updateProfileUI();
        this.refreshUserData();
    },
    openMenuModal() { this.openCatalogPackages(); },
    openCommunitiesModal() { this.closeModals(); document.getElementById('modal-communities')?.classList.remove('hidden'); },
    openSupport() { this.closeModals(); document.getElementById('modal-chat')?.classList.remove('hidden'); },
    openManualBanks() { this.closeModals(); document.getElementById('modal-banks')?.classList.remove('hidden'); },
    openUploadPanel() {
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;

        if (userRole === 'creator' && kycStatus !== 'verified') {
            this.showToast('⚠️ Debes verificar tu cuenta (+18) para publicar.');
            this.openKYCModal();
            return;
        }

        this.closeModals(); 
        this.switchView('upload'); 
    },
    openRoleModal() { this.closeModals(); document.getElementById('modal-role')?.classList.remove('hidden'); },
    openPaymentFlow(plan, price, link, tier) { this.closeModals(); document.getElementById('modal-payment')?.classList.remove('hidden'); },
    closePaymentModal() { document.getElementById('modal-payment')?.classList.add('hidden'); },

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
    // 8. MURO, LIKES, PROPINAS Y BORRADO DE POSTS
    // ==========================================
    async previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        this.showToast('Comprimiendo imagen... ⏳');
        this.tempPostMedia = await this.compressImage(file, 1200, 0.75);
        
        const uploadTxt = document.getElementById('txt-upload');
        if (uploadTxt) uploadTxt.innerText = `¡Imagen cargada! 📸 (${file.name})`;
        this.showToast('Foto cargada correctamente 📸');
    },

    async publishPost() {
        this.haptic('medium');
        const descInput = document.getElementById('admin-text-es');
        const levelSelect = document.getElementById('admin-level');

        const content = descInput ? descInput.value.trim() : '';
        const tierRequired = levelSelect ? parseInt(levelSelect.value) : 0;

        if (!content && !this.tempPostMedia) {
            this.showToast('⚠️ Ingresa una descripción o selecciona una imagen.');
            return;
        }

        this.initUserId();
        this.showToast('Publicando en el Muro... 🚀');

        try {
            const res = await fetch(`${this.backendUrl}/posts/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId || 0,
                    author: this.userData?.name || "mastertom",
                    text_es: content,
                    image_url: this.tempPostMedia,
                    levelRequired: tierRequired,
                    is_ppv: false,
                    price_alpha: 0
                })
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                if (descInput) descInput.value = '';
                this.tempPostMedia = null;
                const uploadTxt = document.getElementById('txt-upload');
                if (uploadTxt) uploadTxt.innerText = 'Tocar para subir archivo';
                const fileInput = document.getElementById('admin-file');
                if (fileInput) fileInput.value = '';

                this.showToast('¡Publicación guardada en la base de datos! 🛡️');
                this.switchView('feed');
                await this.renderFeed();
            } else {
                throw new Error(data.detail || 'Error al publicar');
            }
        } catch (err) {
            console.error('[PUBLISH ERROR]:', err);
            this.showToast(`⚠️ ${err.message || 'Error de conexión'}`);
        }
    },

    async deletePost(postId, creatorId) {
        this.haptic('medium');
        this.initUserId();

        const confirmDelete = confirm('¿Estás seguro de que deseas eliminar esta publicación permanentemente?');
        if (!confirmDelete) return;

        this.showToast('Eliminando publicación... 🗑️');

        try {
            const res = await fetch(`${this.backendUrl}/posts/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.userId || 0,
                    post_id: postId
                })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                this.haptic('heavy');
                this.showToast('Publicación eliminada correctamente 🗑️');
                await this.renderFeed();
            } else {
                throw new Error(data.detail || 'No se pudo eliminar');
            }
        } catch (err) {
            console.error('[DELETE POST ERROR]:', err);
            this.showToast(`⚠️ ${err.message || 'Error al eliminar'}`);
        }
    },

    async unlockPostContent(postId, priceAlpha) {
        this.haptic('heavy');
        this.initUserId();
        
        const confirmBuy = confirm(`¿Desbloquear esta publicación por ${priceAlpha} $ALPHA?`);
        if (!confirmBuy) return;

        this.showToast('Desbloqueando contenido... ⚡');

        try {
            const res = await fetch(`${this.backendUrl}/posts/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId || 0,
                    post_id: postId
                })
            });

            const data = await res.json();

            if (res.ok && data.status === "success") {
                this.showToast('¡Contenido desbloqueado! 🔓');
                await this.refreshUserData();
                await this.renderFeed();
            } else {
                throw new Error(data.detail || 'Saldo insuficiente');
            }
        } catch (err) {
            this.showToast(`⚠️ ${err.message || 'Error al desbloquear'}`);
        }
    },

    toggleLike(postId) {
        this.haptic('light');
        let likedPosts = [];
        try {
            likedPosts = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
        } catch (e) {
            likedPosts = [];
        }

        const isLiked = likedPosts.includes(postId);
        if (isLiked) {
            likedPosts = likedPosts.filter(id => id !== postId);
        } else {
            likedPosts.push(postId);
        }
        localStorage.setItem('alpha_user_liked_posts', JSON.stringify(likedPosts));
        this.renderFeed();
    },

    async renderFeed() {
        const feedContainer = document.getElementById('feed-container') || document.querySelector('#view-feed .feed-posts');
        if (!feedContainer) return;

        this.initUserId();
        const ADMIN_ID = 8269470905;

        try {
            const res = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            let posts = [];

            if (res.ok) {
                const data = await res.json();
                posts = data.posts || [];
            }

            let likedPosts = [];
            try {
                likedPosts = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
            } catch (e) {
                likedPosts = [];
            }

            if (!posts || posts.length === 0) {
                feedContainer.innerHTML = `
                    <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-neutral-400">
                        <i class="fa-solid fa-layer-group text-3xl mb-2 text-amber-500"></i>
                        <p class="text-sm font-semibold">Aún no hay publicaciones en el Búnker.</p>
                        <p class="text-xs text-neutral-500 mt-1">Sé el primero en compartir contenido exclusivo.</p>
                    </div>
                `;
                return;
            }

            feedContainer.innerHTML = posts.map(post => {
                const isLiked = likedPosts.includes(post.id);
                const isOwnerOrAdmin = (this.userId == post.creator_id || this.userId == ADMIN_ID);

                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="font-bold text-amber-400">@${post.author || 'mastertom'}</div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-neutral-500">Tier: Niv.${post.levelRequired}</span>
                                ${isOwnerOrAdmin ? `
                                    <button onclick="app.deletePost(${post.id}, ${post.creator_id})" class="text-neutral-500 hover:text-red-400 p-1 transition" title="Eliminar publicación">
                                        <i class="fa-solid fa-trash-can text-sm"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${post.content}</p>` : ''}
                        
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3 backdrop-blur-md">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">CONTENIDO EXCLUSIVO BLOQUEADO</p>
                                <p class="text-xs text-neutral-400 mb-3">Requiere Rango Superior o Desbloqueo Directo</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-black py-2 px-4 rounded-xl text-xs shadow-lg transition active:scale-95">
                                    🔓 DESBLOQUEAR (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${post.media_url}" class="rounded-xl w-full max-h-80 object-cover mb-3 border border-neutral-800" alt="Media"/>` : '')}

                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg border transition ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400 hover:text-white'}">
                                <i class="fa-solid fa-heart ${isLiked ? 'text-red-500' : 'text-neutral-400'}"></i>
                                <span>Like</span>
                            </button>
                            <button onclick="app.sendTipFromPost(${post.creator_id || 99999}, 10, ${post.id})" class="bg-amber-500 hover:bg-amber-600 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 text-xs shadow-md transition active:scale-95">
                                🪙 Dar Propina
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.warn('[FEED RENDER ERROR]:', err);
        }
    },

    async sendTipFromPost(creatorId, defaultAmount = 10, postId = null) {
        try {
            this.haptic('medium');
            this.initUserId();

            if (!this.userId) {
                this.showToast('⚠️ Debes iniciar sesión para dar propinas.');
                return;
            }

            if (this.userId == creatorId) {
                this.showToast('⚠️ No puedes enviarte propinas a ti mismo.');
                return;
            }

            const inputAmount = prompt(
                '🪙 ¿Cuántos tokens $ALPHA deseas enviar como propina?\n\nSugerencias: 5, 10, 25, 50, 100\nO escribe tu monto personalizado:',
                defaultAmount.toString()
            );

            if (inputAmount === null) return;

            const amount = parseInt(inputAmount.trim());
            if (isNaN(amount) || amount <= 0) {
                this.showToast('⚠️ Ingresa un monto numérico válido mayor a 0.');
                return;
            }

            this.showToast(`Enviando propina de ${amount} $ALPHA... ⚡`);

            const res = await fetch(`${this.backendUrl}/wallet/send-tip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: this.userId,
                    receiver_id: creatorId,
                    amount: amount,
                    post_id: postId
                })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                this.haptic('heavy');
                this.showToast(`¡Propina de ${data.amount_sent || amount} $ALPHA enviada con éxito! 🚀`);
                await this.refreshUserData();
            } else {
                throw new Error(data.detail || 'Saldo insuficiente o error al procesar');
            }
        } catch (error) {
            console.error('[TIP ERROR]:', error);
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