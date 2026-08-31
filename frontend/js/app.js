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

    // ⚡ WEBSOCKET PARA CHAT EN VIVO
    chatSocket: null,

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
            const res = await fetch(`${this.backendUrl}/wallet/balance/${this.userId}`);
            if (res.ok) {
                const data = await res.json();
                balance = data.balance_alfa_coins ?? data.alpha_balance ?? 0;
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
                    if (data.access_level !== undefined) {
                        this.userData.access_tier = data.access_level;
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

        if (this.userId == 8269470905) {
            this.userData.access_tier = 4;
            this.userData.role = 'creator';
            localStorage.setItem('alpha_user_role', 'creator');
        }

        const rankDisplay = document.getElementById('prof-rank');
        const rankFeed = document.getElementById('rank-feed');
        const ranks = ['ESPÍA 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICON LEGEND 💎'];
        const currentRank = ranks[this.userData?.access_tier || 0] || ranks[0];

        if (rankDisplay) rankDisplay.innerText = currentRank;
        if (rankFeed) rankFeed.innerText = currentRank;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status');
        const kycDescEl = document.getElementById('prof-kyc-desc');
        const kycBtn = document.getElementById('btn-verify-kyc');

        if (kycStatusEl) {
            if (kycStatus === 'verified' || this.userId == 8269470905) {
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

        const creatorTools = document.getElementById('prof-creator-tools');
        const creatorSubBox = document.getElementById('prof-creator-subscription-box');
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;
        if (creatorTools) {
            if (userRole === 'creator' || this.userId == 8269470905) {
                creatorTools.classList.remove('hidden');
                if (creatorSubBox) creatorSubBox.classList.remove('hidden');
            } else {
                creatorTools.classList.add('hidden');
                if (creatorSubBox) creatorSubBox.classList.add('hidden');
            }
        }
    },

    updateViewsCounter() {
        let views = parseInt(localStorage.getItem('alpha_real_views') || '0');
        views += 1;
        localStorage.setItem('alpha_real_views', views.toString());

        const viewsEl = document.getElementById('views-counter');
        if (viewsEl) viewsEl.innerText = views.toLocaleString();
    },

    initUserId() {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            this.userId = window.Telegram.WebApp.initDataUnsafe.user.id;
        } else {
            let localId = localStorage.getItem("alpha_user_id");
            if (!localId) {
                localId = "99" + Math.floor(100000 + Math.random() * 900000);
                localStorage.setItem("alpha_user_id", localId);
            }
            this.userId = parseInt(localId);
        }
    },

    async loadTipMenu(creatorId) {
        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/creators/${creatorId || this.userId}/tip-menu`);
            if (res.ok) {
                const data = await res.json();
                return data.slots || [];
            }
        } catch (err) {
            console.warn('[TIP MENU LOAD ERROR]:', err);
        }
        return [];
    },

    async openTipMenuManagementModal() {
        this.closeModals();
        this.initUserId();
        
        let modal = document.getElementById('modal-tip-menu-edit');
        if (!modal) {
            const modalHTML = `
                <div id="modal-tip-menu-edit" class="fixed inset-0 z-[95] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#ff00ff] rounded-3xl p-6 w-11/12 max-w-lg h-[80vh] flex flex-col shadow-[0_0_20px_rgba(255,0,255,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#ff00ff]/30">
                            <h3 class="text-xl font-black text-[#ff00ff] uppercase tracking-wider"><i class="fa-solid fa-list-ul mr-2"></i> EDITAR TIP MENU</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1">
                                <i class="fa-solid fa-times text-xl"></i>
                            </button>
                        </div>
                        <p class="text-xs text-neutral-300 mb-4 font-medium leading-relaxed">Configura tus 10 opciones de propina personalizadas para que tus fans las usen en tu perfil o videollamadas.</p>
                        <div id="tip-menu-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        <div class="mt-4 pt-4 border-t border-[#ff00ff]/30 flex justify-end gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-black border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff]/10 px-5 py-3 rounded-xl text-sm font-black transition uppercase">Volver</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-tip-menu-edit');
        }

        modal.classList.remove('hidden');
        const container = document.getElementById('tip-menu-slots-form');
        if (container) container.innerHTML = '';

        const slots = await this.loadTipMenu(this.userId);
        
        let htmlContent = '';
        for (let i = 1; i <= 10; i++) {
            const existing = slots.find(s => s.slot_number === i) || { title: '', price_alpha: 10 };
            htmlContent += `
                <div class="bg-black border border-[#ff00ff]/50 p-3.5 rounded-2xl flex flex-col gap-2 relative shadow-md">
                    <div class="absolute -top-2.5 left-3 bg-[#ff00ff] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Slot #${i}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <input type="text" id="tip-title-${i}" value="${existing.title}" placeholder="Ej: Video exclusivo 3min" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white focus:border-[#ff00ff] outline-none placeholder-gray-500 font-medium" />
                        <div class="relative w-24 shrink-0">
                            <i class="fa-solid fa-coins absolute left-2.5 top-1/2 transform -translate-y-1/2 text-[#ffb703] text-xs"></i>
                            <input type="number" id="tip-price-${i}" value="${existing.price_alpha}" placeholder="Precio" class="bg-neutral-900 border border-neutral-700 rounded-xl pl-7 pr-2 py-2.5 text-xs w-full text-white focus:border-[#ffb703] outline-none text-center font-black" />
                        </div>
                        <button onclick="app.saveSingleTipSlot(${i})" class="bg-[#00f3ff] hover:bg-cyan-400 text-black font-black px-3.5 h-10 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0 shadow-[0_0_10px_rgba(0,243,255,0.4)] uppercase">
                            <i class="fa-solid fa-floppy-disk"></i> Guardar
                        </button>
                    </div>
                </div>
            `;
        }
        if (container) container.innerHTML = htmlContent;
    },

    async saveSingleTipSlot(slotNumber) {
        this.haptic('medium');
        const titleInput = document.getElementById(`tip-title-${slotNumber}`);
        const priceInput = document.getElementById(`tip-price-${slotNumber}`);
        
        const title = titleInput ? titleInput.value.trim() : '';
        const priceAlpha = parseInt(priceInput ? priceInput.value : '0');

        if (!title || isNaN(priceAlpha) || priceAlpha <= 0) {
            this.showToast('⚠️ Ingresa un título válido y un precio en $ALPHA mayor a 0.');
            return;
        }

        this.initUserId();
        this.showToast(`Guardando slot #${slotNumber}... ⏳`);

        try {
            const res = await fetch(`${this.backendUrl}/creators/tip-menu/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.userId,
                    slot_number: slotNumber,
                    title: title,
                    price_alpha: priceAlpha
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'success') {
                this.haptic('heavy');
                this.showToast(`¡Slot #${slotNumber} guardado con éxito! 🛡️`);
            } else {
                throw new Error(data.detail || 'Error al guardar');
            }
        } catch (err) {
            console.error('[TIP SLOT SAVE ERROR]:', err);
            this.showToast(`⚠️ ${err.message || 'Error de conexión con el servidor'}`);
        }
    },

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

        container.innerHTML = `<div class="text-center text-neutral-400 mt-10 font-bold">Cargando 5 packs tácticos del Búnker... ⏳</div>`;

        try {
            const res = await fetch(`${this.backendUrl}/payments/packages`);
            if (res.ok) {
                const data = await res.json();
                const packages = data.packages || [];

                container.innerHTML = packages.map(pkg => `
                    <div class="bg-black border-2 ${pkg.slug === 'icon-legend' ? 'border-[#ffb703] shadow-[0_0_18px_rgba(255,183,3,0.3)]' : pkg.slug === 'legend' ? 'border-[#ff00ff] shadow-[0_0_12px_rgba(255,0,255,0.2)]' : 'border-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.2)]'} rounded-2xl p-5 relative">
                        <div class="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-3 py-0.5 rounded-full text-[10px] font-black uppercase shadow">
                            ${pkg.badge || 'TÁCTICO'} ${pkg.bonus_percentage > 0 ? `(+${pkg.bonus_percentage}% Bonus)` : ''}
                        </div>
                        <div class="flex justify-between items-center mb-2 mt-1">
                            <h3 class="text-lg font-black text-white"><i class="fa-solid fa-shield-halved text-[#00f3ff] mr-1.5"></i> ${pkg.name}</h3>
                            <span class="text-xl font-black text-[#ffb703]">${pkg.alpha_total} $ALPHA</span>
                        </div>
                        <p class="text-xs text-gray-300 mb-4 font-medium">${pkg.description || 'Recarga táctica con bonificación por volumen.'}</p>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="app.buyPackageStars('${pkg.slug}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">
                                ⭐ ${pkg.price_stars} Stars
                            </button>
                            <button onclick="app.rechargeAlphaCoins(${pkg.price_ton}, ${pkg.alpha_total})" class="w-full bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-cyan-500/30 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">
                                💎 ${pkg.price_ton} TON
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                throw new Error('Error al cargar paquetes tácticos');
            }
        } catch (err) {
            console.warn('[PACKAGES LOAD ERROR]:', err);
            container.innerHTML = `<div class="text-center text-red-400 mt-10 font-bold">⚠️ Error al conectar con el servidor de pagos.</div>`;
        }
    },

    async subscribeCreatorTier(tierSlug) {
        this.haptic('medium');
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';

        if (kycStatus !== 'verified' && this.userId != 8269470905) {
            this.showToast('⚠️ Debes verificar tu identidad (KYC +18) para activar tu suscripción de creador.');
            this.openKYCModal();
            return;
        }

        const planName = tierSlug === 'soldier_creator' ? 'Soldier Creator ($5/mes - 1º Mes Gratis)' : 'Icon Creator ($7.99/mes - 1º Mes Gratis)';
        const confirmSub = confirm(`¿Activar tu membresía B2B: ${planName}?\nDisfrutarás tu primer mes totalmente gratis.`);
        if (!confirmSub) return;

        this.showToast('Activando suscripción de creador... ⚡');
        try {
            const res = await fetch(`${this.backendUrl}/creators/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.userId,
                    tier: tierSlug
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                this.haptic('heavy');
                this.showToast('¡Membresía B2B activada con éxito! 1er mes gratis 🎁');
                this.updateProfileUI();
            } else {
                throw new Error(data.detail || 'No se pudo activar la suscripción');
            }
        } catch (err) {
            this.showToast(`⚠️ ${err.message || 'Error de conexión'}`);
        }
    },

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
        if (avatarFeed) avatarFeed.src = avatarUrl;
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

        this.showToast('¡Perfil guardado correctamente! 🛡️');
        this.updateProfileUI();
    },

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
    },

    async handleKYCSelfiePreview(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.haptic('light');
        this.showToast('Comprimiendo selfie... ⏳');
        this.tempKYCSelfie = await this.compressImage(file, 1024, 0.75);
        const label = document.getElementById('kyc-selfie-label');
        if (label) label.innerText = `✅ Selfie lista (${file.name})`;
    },

    async submitKYC() {
        this.haptic('medium');
        const legalName = document.getElementById('kyc-legal-name')?.value.trim();

        if (!legalName || !this.tempKYCDoc || !this.tempKYCSelfie) {
            this.showToast('⚠️ Completa tu nombre legal, documento y selfie con fecha.');
            return;
        }

        this.initUserId();
        this.showToast('Enviando solicitud de KYC al Búnker Admin... 🛡️');

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
                this.showToast('¡Solicitud enviada con éxito! 🚀');
                this.closeModals();
                this.updateProfileUI();
            } else {
                throw new Error(data.detail || 'Error al procesar KYC');
            }
        } catch (err) {
            this.showToast(`⚠️ Error: ${err.message || 'No se pudo conectar al backend'}`);
        }
    },

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
                        this.showToast('¡Billetera TON conectada! 💎');

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

            this.showToast('Confirmando transacción en tu billetera TON... ⚡');
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
            this.showToast('⚠️ Transacción cancelada o fallida.'); 
        }
    },

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
            btnCreator?.classList.replace('text-white', 'text-neutral-400');

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

        if (!phone && !email) {
            this.showToast('⚠️ Ingresa al menos un número o correo.');
            return;
        }

        const isCreator = this.registerRoleSelected === 'creator';
        this.userData.role = this.registerRoleSelected;
        this.userData.name = phone || email.split('@')[0] || (isCreator ? "mastertom" : "VIP Fan");
        
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

    async loginWithPhone() {
        this.haptic('medium');
        const phone = document.getElementById('phone-input')?.value.trim();
        if (!phone) {
            this.showToast('⚠️ Ingresa tu número de teléfono.');
            return;
        }

        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true');
        localStorage.setItem('alpha_user_name', `Tel: ${phone}`);
        
        this.showToast('¡Acceso concedido al Búnker! 🛡️');
        this.switchView('feed');
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    async loginWithTelegram() { 
        this.haptic('medium'); 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        
        try {
            await fetch(`${this.backendUrl}/users/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId,
                    name: localStorage.getItem('alpha_user_name') || "Agente Búnker",
                    bio: "Operativo autenticado vía Telegram WebApp"
                })
            });
        } catch (e) {}

        this.switchView('feed'); 
        this.updateProfileUI();
        this.updateViewsCounter();
        await this.syncKYCStatus();
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

            const activeLogin = localStorage.getItem('alpha_logged_in');
            const hasConsent = localStorage.getItem('alpha_consent');
            const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

            if (tgUser && tgUser.id) {
                localStorage.setItem('alpha_logged_in', 'true');
                localStorage.setItem('alpha_consent', 'true');
                if (!localStorage.getItem('alpha_user_name')) {
                    localStorage.setItem('alpha_user_name', tgUser.first_name || 'VIP User');
                }
            }

            if (activeLogin === 'true' || (tgUser && tgUser.id)) { 
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
        } catch (e) {}
    },

    exitApp() { if (window.Telegram?.WebApp) window.Telegram.WebApp.close(); },
    logout() { 
        this.haptic('medium'); 
        localStorage.removeItem('alpha_logged_in'); 
        this.switchView('consent'); 
    },

    switchView(viewName) {
        ['consent', 'login', 'captcha', 'register', 'lang', 'feed', 'upload'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            window.scrollTo(0, 0); 
            if (viewName !== 'lang') this.lastView = viewName; 
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
        localStorage.setItem('alpha_consent', 'true');
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
    },

    verifyCaptcha() {
        this.haptic('medium');
        const input = document.getElementById('captcha-input');
        const userValue = input ? input.value.trim().toUpperCase() : '';

        if (userValue === this.currentCaptcha && userValue !== '') {
            this.showToast('¡Verificación exitosa! 🛡️');
            this.switchView('login');
        } else {
            this.showToast('⚠️ Código incorrecto.');
            this.generateCaptcha();
        }
    },

    closeModals() {
        this.haptic('light');
        if (this.chatSocket) {
            this.chatSocket.close();
            this.chatSocket = null;
        }
        ['modal-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-banks', 'modal-chat', 'modal-kyc', 'modal-tip-menu-edit', 'modal-fan-tip-menu'].forEach(m => {
            document.getElementById(m)?.classList.add('hidden');
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
    openCommunitiesModal() { this.closeModals(); },
    
    async openSupport() { 
        this.closeModals(); 
        document.getElementById('modal-chat')?.classList.remove('hidden'); 
        await this.loadChatHistory();
        this.initChatWebSocket();
    },

    async loadChatHistory() {
        const container = document.getElementById('chat-messages');
        if (container) container.innerHTML = ''; 
        try {
            const res = await fetch(`${this.backendUrl}/chat/history?limit=50`);
            if (res.ok) {
                const data = await res.json();
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => this.appendChatMessage(msg));
                    this.scrollToChatBottom();
                } else {
                    container.innerHTML = '<div class="text-center text-neutral-500 mt-4 text-xs font-semibold">Búnker seguro iniciado. Escribe el primer mensaje. 🛡️</div>';
                }
            }
        } catch (err) {}
    },

    initChatWebSocket() {
        this.initUserId();
        if (!this.userId) return;

        if (this.chatSocket) {
            this.chatSocket.close();
            this.chatSocket = null;
        }

        const wsProtocol = this.backendUrl.startsWith('https') ? 'wss://' : 'ws://';
        const cleanBaseUrl = this.backendUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}${cleanBaseUrl}/chat/ws/${this.userId}`;

        this.chatSocket = new WebSocket(wsUrl);
        this.chatSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.appendChatMessage(msg);
                this.scrollToChatBottom();
            } catch (e) {}
        };
    },

    appendChatMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const isMe = msg.user_id == this.userId;
        const ranks = ['ESPÍA 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICON LEGEND 💎'];
        const rankName = ranks[msg.access_level] || ranks[0];

        let html = '';
        if (msg.is_system) {
            html = `<div class="flex flex-col items-center my-2"><div class="bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs px-4 py-2 rounded-full font-bold text-center"><i class="fa-solid fa-bolt mr-1"></i> ${msg.content}</div></div>`;
        } else if (isMe) {
            html = `<div class="flex flex-col items-end my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold mr-1">TÚ • ${rankName}</span><div class="bg-[#00f3ff]/20 text-white text-sm p-3 rounded-2xl border border-[#00f3ff]/50 max-w-[85%]">${msg.content}</div></div>`;
        } else {
            html = `<div class="flex flex-col items-start my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold ml-1"><span class="text-[#00f3ff] font-black">@${msg.author_name}</span> • ${rankName}</span><div class="bg-neutral-800 text-white text-sm p-3 rounded-2xl border border-neutral-700 max-w-[85%]">${msg.content}</div></div>`;
        }
        container.insertAdjacentHTML('beforeend', html);
    },

    scrollToChatBottom() {
        const container = document.getElementById('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    },

    sendChatMessage() { 
        this.haptic('light');
        const input = document.getElementById('chat-input'); 
        const text = input ? input.value.trim() : '';
        if (!text) return;

        if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
            this.chatSocket.send(text);
            if (input) input.value = ''; 
        }
    },

    openUploadPanel() {
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;

        if (this.userId != 8269470905 && userRole === 'creator' && kycStatus !== 'verified') {
            this.showToast('⚠️ Debes verificar tu cuenta (+18) para publicar.');
            this.openKYCModal();
            return;
        }
        this.closeModals(); 
        this.switchView('upload'); 
    },

    openRoleModal() { this.closeModals(); document.getElementById('modal-role')?.classList.remove('hidden'); },
    
    toggleLanguage() { 
        this.haptic('medium');
        const languages = ['es', 'en', 'it', 'pt', 'de', 'fr'];
        const currentLang = localStorage.getItem('alpha_lang') || 'es';
        const nextLang = languages[(languages.indexOf(currentLang) + 1) % languages.length];
        this.setLanguage(nextLang);
    },

    setLanguage(lang) { 
        this.haptic('light');
        localStorage.setItem('alpha_lang', lang);
        this.currentLang = lang;
        const langText = document.getElementById('fab-lang-text');
        if (langText) langText.innerText = lang.toUpperCase();
        if (typeof window.applyTranslations === 'function') window.applyTranslations(lang);
        this.showToast(`Idioma: ${lang.toUpperCase()}`);
    },

    toggleAdminSecret() { 
        this.haptic('light');
        this.initUserId();
        if (this.userId == 8269470905) {
            this.isAdmin = !this.isAdmin; 
            this.showToast(this.isAdmin ? 'Admin Mode ON 👑' : 'Admin Mode OFF');
        }
    },
    
    async previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.tempPostMedia = await this.compressImage(file, 1200, 0.75);
        document.getElementById('txt-upload').innerText = `¡Imagen cargada! 📸 (${file.name})`;
    },

    async publishPost() {
        this.haptic('medium');
        const content = document.getElementById('admin-text-es')?.value.trim() || '';
        const tierRequired = parseInt(document.getElementById('admin-level')?.value || '0');

        if (!content && !this.tempPostMedia) {
            this.showToast('⚠️ Ingresa una descripción o imagen.');
            return;
        }

        this.initUserId();
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
                this.showToast('¡Publicación guardada! 🛡️');
                this.switchView('feed');
                await this.renderFeed();
            }
        } catch (err) {
            this.showToast('⚠️ Error al publicar');
        }
    },

    async deletePost(postId) {
        if (!confirm('¿Eliminar publicación?')) return;
        try {
            await fetch(`${this.backendUrl}/posts/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId || 0, post_id: postId })
            });
            this.renderFeed();
        } catch (e) {}
    },

    async unlockPostContent(postId, priceAlpha) {
        try {
            const res = await fetch(`${this.backendUrl}/posts/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: this.userId || 0, post_id: postId })
            });
            if (res.ok) {
                this.showToast('¡Contenido desbloqueado! 🔓');
                await this.refreshUserData();
                await this.renderFeed();
            }
        } catch (e) {}
    },

    toggleLike(postId) {
        let liked = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
        if (liked.includes(postId)) liked = liked.filter(id => id !== postId);
        else liked.push(postId);
        localStorage.setItem('alpha_user_liked_posts', JSON.stringify(liked));
        this.renderFeed();
    },

    async renderFeed() {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;

        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            const data = res.ok ? await res.json() : {};
            const posts = data.posts || [];
            const likedPosts = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');

            if (posts.length === 0) {
                feedContainer.innerHTML = `<div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-neutral-400 font-bold">Aún no hay publicaciones en el Búnker.</div>`;
                return;
            }

            feedContainer.innerHTML = posts.map(post => {
                const isLiked = likedPosts.includes(post.id);
                const isOwner = (this.userId == post.creator_id || this.userId == 8269470905);

                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 cursor-pointer" onclick="app.openProfile()">
                                <div class="w-9 h-9 rounded-full border border-[#00f3ff] overflow-hidden bg-black flex items-center justify-center">
                                    <i class="fa-solid fa-user text-xs text-[#00f3ff]"></i>
                                </div>
                                <span class="font-bold text-amber-400 text-sm">@${post.author || 'mastertom'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-neutral-500">Tier: Niv.${post.levelRequired}</span>
                                ${isOwner ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${post.content}</p>` : ''}
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">CONTENIDO EXCLUSIVO BLOQUEADO</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">
                                    🔓 DESBLOQUEAR (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${post.media_url}" class="rounded-xl w-full max-h-80 object-cover mb-3" alt="Media"/>` : '')}
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'}">
                                <i class="fa-solid fa-heart"></i> Like
                            </button>
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${post.author || 'Creador'}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">
                                🪙 Dar Propina
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {}
    },

    async openFanTipMenu(creatorId, postId, creatorName) {
        this.closeModals();
        this.initUserId();
        const modal = document.getElementById('modal-fan-tip-menu');
        document.getElementById('fan-tip-creator-name').innerText = `@${creatorName}`;
        modal?.classList.remove('hidden');

        const container = document.getElementById('fan-tip-slots-container');
        const slots = await this.loadTipMenu(creatorId);
        container.innerHTML = slots.length === 0 ? '<div class="text-center text-neutral-500 mt-10 font-bold">Sin tip menu configurado.</div>' : slots.map(s => `
            <button onclick="app.sendTipFromPost(${creatorId}, ${s.price_alpha}, ${postId || null})" class="w-full bg-black border border-[#ffb703]/50 rounded-2xl p-4 flex justify-between items-center text-white">
                <span class="font-bold text-sm">${s.title}</span>
                <span class="bg-[#ffb703] text-black text-xs font-black px-3 py-1.5 rounded-xl">${s.price_alpha} $ALPHA</span>
            </button>
        `).join('');
    },

    async sendTipFromPost(creatorId, amount, postId) {
        try {
            await sendAlphaTip(this.userId, creatorId, amount, postId);
            this.showToast(`¡Propina de ${amount} $ALPHA enviada! 🚀`);
            this.closeModals();
            await this.refreshUserData();
        } catch (e) { this.showToast('⚠️ Saldo insuficiente'); }
    },

    startVideoCall() { 
        this.haptic('medium');
        this.showToast('Conectando Videollamada Segura Cam2Cam (Estilo Telegram)... 📹'); 
        this.openSupport();
    },
    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },
    selectCreatorRole() { this.showToast('Rol de Creador seleccionado'); this.closeModals(); },
    selectFanRole() { this.showToast('Rol de Fan seleccionado'); this.closeModals(); }
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => {
    app.checkSession(); 
    app.generateCaptcha();
});
```[cite: 4]

---

### 2. Archivo `index.html` Actualizado

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ALPHA TOM - Hybrid Ecosystem & Vault</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Press+Start+2P&family=Rajdhani:wght@500;700;900&display=swap" rel="stylesheet">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#050505">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="tron-grid"></div>
    <div class="grid-fade"></div>
    <div class="watermark-footer">
        RAFAEL SANCHEZ / "ARQUITECTO DE BOTS Y MINI APPS" * TELEGRAM: <a href="#" onclick="app.openLink('https://t.me/therealonetom'); return false;">@THEREALONETOM</a>
    </div>

    <!-- BOTÓN DE IDIOMA GLOBAL -->
    <button onclick="app.toggleLanguage()" class="fab-lang levitate z-[100]">
        <i class="fa-solid fa-language text-xl text-[#00f3ff] mb-0.5"></i>
        <span class="text-[11px] font-black text-[#00f3ff]" id="fab-lang-text">ES</span>
    </button>

    <!-- VIEW -1: AGE CONSENT -->
    <div id="view-consent" class="min-h-screen flex flex-col items-center justify-center p-6 relative z-10 transition-opacity duration-500">
        <i class="fa-solid fa-triangle-exclamation text-8xl text-[#ff3333] mb-6 drop-shadow-[0_0_20px_#ff3333] levitate"></i>
        <h1 id="txt-warn-title" class="text-3d-red text-4xl text-center mb-3 font-black">ADVERTENCIA</h1>
        <h2 id="txt-warn-sub" class="text-2xl text-[#ff00ff] font-extrabold tracking-[0.2em] mb-8 text-center" style="text-shadow: 0 0 10px #ff00ff;">+18 ADULT CONTENT</h2>
        <div class="glass-panel p-6 mb-8 max-w-sm text-center border-[#ff3333]">
            <p id="txt-warn-p1" class="text-base text-gray-200 mb-4 font-semibold">Este espacio contiene material explícito y sexual.</p>
            <p id="txt-warn-p2" class="text-base text-gray-300 font-medium">Al ingresar, confirmas bajo tu responsabilidad que eres mayor de edad (18+) y consientes visualizar este contenido (Safe Harbor Compliance).</p>
        </div>
        <div class="w-full max-w-sm space-y-4">
            <button onclick="app.acceptConsent()" class="w-full btn-neon-magenta py-4 rounded-xl text-2xl font-black uppercase tracking-wider levitate">
                <i class="fa-solid fa-check-circle mr-2"></i> <span id="btn-accept-text">ACEPTO / I ACCEPT</span>
            </button>
            <button onclick="app.exitApp()" class="w-full bg-transparent border-2 border-gray-600 text-gray-300 py-3.5 rounded-xl font-bold uppercase transition hover:text-white text-lg">
                <i class="fa-solid fa-times mr-2"></i> <span id="btn-exit-text">SALIR / EXIT</span>
            </button>
        </div>
    </div>

    <!-- VIEW -0.5: CAPTCHA -->
    <div id="view-captcha" class="hidden min-h-screen flex flex-col items-center justify-center p-6 relative z-10">
        <i class="fa-solid fa-shield-halved text-7xl text-[#00f3ff] mb-4 drop-shadow-[0_0_15px_#00f3ff] levitate"></i>
        <h1 id="txt-cap-title" class="text-3d-cyan text-3xl text-center mb-3 font-black">VERIFICACIÓN HUMANA</h1>
        <div class="glass-panel p-6 w-full max-w-sm text-center border-[#00f3ff]">
            <div id="captcha-display" class="bg-black border-2 border-dashed border-[#00f3ff] py-4 rounded-xl text-3xl font-black text-[#00f3ff] tracking-[0.4em] mb-4 select-none">A7X9K</div>
            <div class="mb-5">
                <input type="text" id="captcha-input" placeholder="Ingresa el código..." class="cyber-input text-center uppercase tracking-widest text-lg" maxlength="5">
            </div>
            <button onclick="app.verifyCaptcha()" class="w-full btn-neon-cyan py-4 rounded-xl font-black text-lg uppercase tracking-wider levitate">
                <i class="fa-solid fa-check mr-2"></i> <span id="btn-verify-text">VERIFICAR ACCESO</span>
            </button>
        </div>
    </div>

    <!-- VIEW 0: LOGIN -->
    <div id="view-login" class="hidden min-h-screen flex flex-col items-center justify-center p-6 relative z-10">
        <button onclick="app.switchView('consent')" class="absolute top-6 left-6 text-[#00f3ff] border border-[#00f3ff] rounded-full px-4 py-2 flex items-center text-sm font-bold z-50">
            <i class="fa-solid fa-arrow-left mr-2"></i> <span class="btn-back-text">VOLVER</span>
        </button>
        <i class="fa-brands fa-telegram text-7xl text-[#00f3ff] mb-4 drop-shadow-[0_0_15px_#00f3ff] levitate"></i>
        <h1 id="txt-login-title" class="text-3d-cyan text-4xl text-center mb-6 font-black">ACCESO AL VAULT</h1>
        <div class="glass-panel p-6 w-full max-w-sm">
            <div class="mb-4">
                <label id="lbl-phone" class="block text-xs text-[#00f3ff] mb-1 font-bold tracking-wider uppercase">NÚMERO DE TELÉFONO</label>
                <div class="relative">
                    <i class="fa-solid fa-phone absolute left-4 top-1/2 transform -translate-y-1/2 text-[#00f3ff]"></i>
                    <input type="tel" id="phone-input" placeholder="+1 234 567 8900" class="cyber-input pl-11 text-base">
                </div>
            </div>
            <button onclick="app.loginWithPhone()" id="btn-phone-text" class="w-full bg-transparent border-2 border-[#00f3ff] text-[#00f3ff] py-3.5 rounded-xl font-black text-base uppercase mb-3">ACCEDER AL VAULT</button>
            <button onclick="app.loginWithTelegram()" class="w-full flex items-center justify-center gap-3 bg-[#2481cc] text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(36,129,204,0.5)] levitate">
                <i class="fa-brands fa-telegram text-xl"></i> <span id="btn-tg-text">LOGIN CON TELEGRAM</span>
            </button>
            <div class="mt-5 text-center">
                <button onclick="app.switchView('register')" id="btn-create-acc" class="text-sm font-bold text-[#ff00ff] underline">CREAR CUENTA NUEVA</button>
            </div>
        </div>
    </div> 

    <!-- VIEW 0.5: REGISTRATION -->
    <div id="view-register" class="hidden min-h-screen flex flex-col items-center justify-center p-6 relative z-10">
        <button onclick="app.switchView('login')" class="absolute top-6 left-6 text-[#ff00ff] border border-[#ff00ff] rounded-full px-4 py-2 flex items-center text-sm font-bold z-50">
            <i class="fa-solid fa-arrow-left mr-2"></i> <span class="btn-back-text">VOLVER</span>
        </button>
        <h1 id="txt-reg-title" class="text-3d-magenta text-3xl text-center mb-4 font-black">NUEVA CUENTA</h1>
        <div class="glass-panel p-6 w-full max-w-sm">
            <label class="block text-xs text-[#ff00ff] mb-2 font-bold tracking-wider uppercase text-center">TIPO DE CUENTA</label>
            <div class="grid grid-cols-2 gap-2 mb-4">
                <button type="button" id="reg-role-fan" onclick="app.setRegisterRole('fan')" class="py-2.5 px-3 rounded-xl border-2 border-[#ff00ff] bg-[#ff00ff]/20 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-eye"></i> <span>SOY FAN</span>
                </button>
                <button type="button" id="reg-role-creator" onclick="app.setRegisterRole('creator')" class="py-2.5 px-3 rounded-xl border-2 border-neutral-700 bg-black text-neutral-400 font-bold text-xs uppercase flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> <span>SOY CREADOR</span>
                </button>
            </div>
            <div class="mb-3">
                <label class="block text-xs text-[#ff00ff] mb-1 font-bold tracking-wider uppercase">NÚMERO DE TELÉFONO</label>
                <input type="tel" id="reg-phone-input" placeholder="+1 234 567 8900" class="cyber-input border-[#ff00ff] pl-4 text-sm w-full">
            </div>
            <button onclick="app.registerWithData()" id="btn-reg-text" class="w-full bg-transparent border-2 border-[#ff00ff] text-[#ff00ff] py-3.5 rounded-xl font-black text-sm uppercase mb-3">REGISTRARSE</button>
        </div>
    </div>

    <!-- VIEW 2: FEED -->
    <div id="view-feed" class="hidden h-screen flex flex-col relative z-10">
        <header class="glass-panel mx-2 mt-2 p-3 flex items-center justify-between z-20">
            <div class="flex items-center gap-3 cursor-pointer" onclick="app.openProfile()">
                <div class="w-12 h-12 rounded-full border-2 border-[#00f3ff] overflow-hidden shadow-[0_0_10px_#00f3ff] flex items-center justify-center bg-black">
                    <img id="avatar-feed" src="assets/logo.png" onerror="this.src='https://i.postimg.cc/tYxFr9ZY/1000289059.jpg'" class="w-full h-full object-cover">
                </div>
                <div class="flex flex-col justify-center">
                    <h3 class="font-bold text-base text-white leading-tight" id="name-feed" onclick="app.toggleAdminSecret(); event.stopPropagation();">USER</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <p class="text-[10px] font-black text-[#ffb703] tracking-wider bg-[#ffb703]/20 px-2.5 py-0.5 rounded-full border border-[#ffb703]/50"><span id="rank-feed">ESPÍA 🕵️</span></p>
                        <p class="text-xs text-[#00f3ff] font-bold"><i class="fa-solid fa-eye animate-pulse mr-1"></i><span id="views-counter">0</span></p>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 items-center">
                <button onclick="app.connectWallet()" class="text-[#00f3ff] border border-[#00f3ff] bg-black/50 rounded-full px-3 py-1.5 flex items-center text-[10px] font-bold shadow-[0_0_8px_#00f3ff]">
                    <i class="fa-solid fa-wallet mr-1.5 text-xs"></i> <span id="btn-wallet-hdr">CONECTAR WALLET</span>
                </button>
                <button onclick="app.logout()" class="text-[#ff00ff] border border-[#ff00ff] bg-black/50 rounded-full px-3 py-1.5 flex items-center text-[10px] font-bold shadow-[0_0_8px_#ff00ff]">
                    <i class="fa-solid fa-right-from-bracket mr-1.5 text-xs"></i> <span id="btn-logout">CERRAR SESIÓN</span>
                </button>
            </div>
        </header>

        <!-- 🚀 GRAN BOTÓN / BANNER DEL MURO PARA CHAT GLOBAL Y VIDEOLLAMADA (ESTILO TELEGRAM) -->
        <div class="mx-2 mt-2 bg-gradient-to-r from-neutral-900 via-neutral-900 to-black border-2 border-[#00f3ff] rounded-2xl p-3.5 shadow-[0_0_15px_rgba(0,243,255,0.2)] flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-[#00f3ff]/20 border border-[#00f3ff] flex items-center justify-center text-[#00f3ff] text-xl animate-pulse shrink-0">
                    <i class="fa-solid fa-video"></i>
                </div>
                <div>
                    <h4 class="text-xs font-black text-white uppercase" id="wall-chat-title">CHAT GLOBAL & VIDEO BÚNKER</h4>
                    <p class="text-[10px] text-gray-300 font-medium" id="wall-chat-desc">Comunidad en directo (Estilo Telegram)</p>
                </div>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <button onclick="app.openSupport()" class="bg-[#00f3ff] hover:bg-cyan-400 text-black font-black px-3 py-2 rounded-xl text-[11px] uppercase shadow-[0_0_10px_rgba(0,243,255,0.4)] transition flex items-center gap-1">
                    <i class="fa-solid fa-comments"></i> <span id="btn-wall-chat">CHAT</span>
                </button>
                <button onclick="app.startVideoCall()" class="bg-[#ff00ff] hover:bg-fuchsia-500 text-white font-black px-3 py-2 rounded-xl text-[11px] uppercase shadow-[0_0_10px_rgba(255,0,255,0.4)] transition flex items-center gap-1">
                    <i class="fa-solid fa-video"></i> <span id="btn-wall-video">VIDEO</span>
                </button>
            </div>
        </div>

        <main class="flex-1 feed-container p-4 mt-2 snap-y snap-mandatory scroll-smooth overflow-y-auto" id="feed-container"></main>

        <div class="glass-panel mx-2 mb-2 p-2.5 flex justify-between items-end z-20 px-4">
            <button onclick="app.openMenuModal()" class="flex flex-col items-center text-[#ff00ff] w-14 pb-1">
                <i class="fa-solid fa-layer-group text-2xl mb-1"></i><span class="text-[9px] font-black" id="nav-catalog">CATÁLOGO</span>
            </button>
            <button onclick="app.goHome()" class="flex flex-col items-center text-[#00f3ff] relative -mt-7 w-16">
                <div class="bg-black border-2 border-[#00f3ff] p-3.5 rounded-full shadow-[0_0_20px_#00f3ff] animate-pulse mb-1">
                    <i class="fa-solid fa-house text-2xl"></i>
                </div>
                <span class="text-[10px] font-black text-[#00f3ff]" id="nav-home">HOME</span>
            </button>
            <button onclick="app.openProfile()" class="flex flex-col items-center text-[#ffb703] w-14 pb-1">
                <i class="fa-solid fa-user-astronaut text-2xl mb-1"></i><span class="text-[9px] font-black" id="nav-profile">MI PERFIL</span>
            </button>
            <button onclick="app.openSupport()" class="flex flex-col items-center text-[#ff00ff] w-14 pb-1">
                <i class="fa-solid fa-envelope text-2xl mb-1"></i><span class="text-[9px] font-black" id="nav-support">MENSAJES</span>
            </button>
        </div>
    </div>

    <!-- VIEW 3: UPLOAD PANEL -->
    <div id="view-upload" class="hidden min-h-screen flex flex-col relative z-10 bg-[var(--bg-deep)]">
        <header class="glass-panel mx-2 mt-2 p-3 flex items-center justify-between z-20">
            <h3 class="font-extrabold text-xl text-[#00f3ff]"><i class="fa-solid fa-wand-magic-sparkles mr-2"></i> SUBIR CONTENIDO</h3>
            <button onclick="app.switchView('feed')" class="bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
        </header>
        <main class="flex-1 p-5 overflow-y-auto pb-20">
            <div class="glass-panel p-6">
                <form onsubmit="event.preventDefault(); app.publishPost();">
                    <div class="mb-5">
                        <label class="block text-xs text-[#ffb703] mb-2 font-bold">NIVEL REQUERIDO 👀</label>
                        <select id="admin-level" class="cyber-input w-full bg-black border-[#ffb703] text-white text-base">
                            <option value="0">🆓 Público (Todos)</option>
                            <option value="1">🎖️ SOLDIER</option>
                            <option value="2">⚔️ VETERAN</option>
                            <option value="3">👑 LEGEND</option>
                            <option value="4">💎 ICON LEGEND</option>
                        </select>
                    </div>
                    <div class="mb-5">
                        <label class="block text-xs text-[#ff00ff] mb-2 font-bold">FOTO O VIDEO 📸</label>
                        <input type="file" accept="image/*" id="admin-file" class="hidden" onchange="app.previewImage(event)">
                        <label for="admin-file" class="w-full flex flex-col items-center justify-center border-2 border-dashed border-[#ff00ff] rounded-xl p-8 cursor-pointer">
                            <i class="fa-solid fa-cloud-arrow-up text-4xl text-[#ff00ff] mb-2"></i><span class="text-sm text-gray-200 font-bold" id="txt-upload">Tocar para subir archivo</span>
                        </label>
                    </div>
                    <div class="mb-5">
                        <label class="block text-xs text-gray-300 mb-2 font-bold uppercase">DESCRIPCIÓN</label>
                        <textarea id="admin-text-es" rows="4" class="cyber-input w-full text-base"></textarea>
                    </div>
                    <button type="submit" class="w-full btn-neon-cyan py-4 rounded-xl font-black text-lg">PUBLICAR AL MURO</button>
                </form>
            </div>
        </main>
    </div>

    <!-- MODAL: PERFIL DEL USUARIO -->
    <div id="modal-profile" class="hidden fixed inset-0 z-[65] flex items-end justify-center bg-black bg-opacity-90 backdrop-blur-sm">
        <div class="glass-panel w-full max-w-md h-[90vh] rounded-t-3xl p-6 flex flex-col relative overflow-y-auto">
            <input type="file" id="avatar-file-input" class="hidden" accept="image/*" onchange="app.handleAvatarChange(event)">
            <button onclick="app.closeModals()" class="absolute top-4 right-4 bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
            <h2 class="text-3d-cyan text-3xl text-center mb-6 font-black">MI PERFIL</h2>
            
            <div class="flex flex-col items-center mb-6">
                <div onclick="app.triggerAvatarInput()" class="relative w-28 h-28 rounded-full border-4 border-[#ff00ff] shadow-[0_0_20px_#ff00ff] overflow-hidden mb-3 cursor-pointer group flex items-center justify-center bg-black">
                    <img id="prof-avatar-img" src="" class="hidden w-full h-full object-cover" alt="User Avatar">
                    <div class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <i class="fa-solid fa-camera text-white text-xl mb-1"></i>
                        <span class="text-[10px] text-white font-bold">CAMBIAR</span>
                    </div>
                </div>
                <p class="text-sm font-black text-[#ffb703] mt-1 bg-[#ffb703]/20 px-4 py-1.5 rounded-full border border-[#ffb703]/50" id="prof-rank">ESPÍA 🕵️</p>
            </div>

            <!-- ESTADO KYC (+18) -->
            <div class="bg-neutral-900 border border-[#ff00ff] rounded-xl p-4 mb-5 shadow-md">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs font-bold text-[#ff00ff]"><i class="fa-solid fa-shield-halved mr-1.5"></i> ESTADO KYC (+18)</span>
                    <span id="prof-kyc-status" class="text-xs font-black uppercase text-amber-400">NO VERIFICADO</span>
                </div>
                <p class="text-xs text-gray-300 mb-3" id="prof-kyc-desc">Verifica tu documento oficial y selfie para publicar y monetizar.</p>
                <button onclick="app.openKYCModal()" id="btn-verify-kyc" class="w-full btn-neon-magenta py-2.5 rounded-xl font-bold text-xs uppercase">
                    VERIFICAR CUENTA AHORA 🪪
                </button>
            </div>

            <!-- SUSCRIPCIÓN DE CREADORES B2B -->
            <div id="prof-creator-subscription-box" class="hidden bg-neutral-900 border-2 border-[#ff00ff] rounded-xl p-4 mb-5 shadow-[0_0_15px_rgba(255,0,255,0.2)]">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-black text-[#ff00ff] uppercase"><i class="fa-solid fa-crown mr-1.5"></i> MEMBRESÍA CREADOR B2B</span>
                    <span class="text-[10px] font-black uppercase bg-[#ff00ff]/20 text-[#ff00ff] px-2 py-0.5 rounded-full border border-[#ff00ff]/40">1º MES GRATIS 🎁</span>
                </div>
                <p class="text-xs text-gray-300 mb-3 font-medium">Desbloquea la edición de tu Tip Menu y monetización activa.</p>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="app.subscribeCreatorTier('soldier_creator')" class="bg-black border border-[#00f3ff] hover:bg-[#00f3ff]/10 text-white p-3 rounded-xl text-left transition">
                        <div class="text-xs font-black text-[#00f3ff]">SOLDIER CREATOR</div>
                        <div class="text-[10px] text-gray-300 font-bold">$5.00 USD / mes</div>
                    </button>
                    <button onclick="app.subscribeCreatorTier('icon_creator')" class="bg-black border border-[#ffb703] hover:bg-[#ffb703]/10 text-white p-3 rounded-xl text-left transition">
                        <div class="text-xs font-black text-[#ffb703]">ICON CREATOR</div>
                        <div class="text-[10px] text-gray-300 font-bold">$7.99 USD / mes</div>
                    </button>
                </div>
            </div>

            <!-- Billetera $ALPHA con los 5 Packs Tácticos -->
            <div class="bg-black border-2 border-[#ffb703] rounded-xl p-5 mb-5 shadow-[0_0_15px_rgba(255,183,3,0.3)]">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-xs text-[#ffb703] font-bold uppercase"><i class="fa-solid fa-coins mr-1.5"></i> BILLETERA $ALPHA</span>
                    <span id="prof-alpha-balance" class="font-black text-[#ffb703] text-lg">0 $ALPHA</span>
                </div>
                <p class="text-xs text-gray-300 mb-4 font-medium">Recarga saldo con bonificación por volumen para dar propinas y desbloquear contenido.</p>
                <button onclick="app.openCatalogPackages()" class="w-full bg-[#ffb703] text-black font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_#ffb703]">
                    <i class="fa-solid fa-bolt text-base"></i> VER 5 PACKS TÁCTICOS ($ALPHA)
                </button>
            </div>

            <div id="prof-creator-tools" class="hidden mb-5">
                <button onclick="app.openTipMenuManagementModal()" class="w-full bg-black border-2 border-[#ff00ff] text-[#ff00ff] py-3 rounded-xl font-black text-sm uppercase">
                    EDITAR MIS 10 SLOTS (TIP MENU) 📋
                </button>
            </div>

            <div class="mb-4">
                <label class="block text-xs text-[#00f3ff] mb-2 font-bold uppercase">NOMBRE DE USUARIO / ALIAS</label>
                <input type="text" id="prof-alias" class="cyber-input text-base" placeholder="Tu alias VIP">
            </div>

            <div class="mb-5">
                <label class="block text-xs text-[#ff00ff] mb-2 font-bold uppercase">BIO / DESCRIPCIÓN VIP</label>
                <textarea id="prof-bio" rows="3" class="cyber-input w-full text-base" placeholder="Escribe tu biografía..."></textarea>
                <button onclick="app.saveProfile()" class="mt-3 w-full border-2 border-[#ff00ff] text-[#ff00ff] py-3 rounded-xl font-bold text-sm uppercase">GUARDAR PERFIL</button>
            </div>

            <div class="mb-6">
                <button onclick="app.openUploadPanel()" class="w-full btn-neon-cyan py-4 rounded-xl font-black text-base shadow-[0_0_15px_#00f3ff]">
                    PUBLICAR CONTENIDO 📸
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: VERIFICACIÓN KYC (+18) -->
    <div id="modal-kyc" class="hidden fixed inset-0 z-[85] flex items-end justify-center bg-black bg-opacity-95 backdrop-blur-md">
        <div class="glass-panel w-full max-w-md h-[90vh] rounded-t-3xl p-6 flex flex-col relative overflow-y-auto">
            <button onclick="app.closeModals()" class="absolute top-4 right-4 bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
            <h2 class="text-3d-cyan text-2xl text-center mb-2 font-black">VERIFICACIÓN (+18)</h2>
            <form onsubmit="event.preventDefault(); app.submitKYC();" class="space-y-4">
                <div>
                    <label class="block text-xs text-[#00f3ff] mb-1 font-bold uppercase">Nombre Legal Completo</label>
                    <input type="text" id="kyc-legal-name" required class="cyber-input w-full text-sm">
                </div>
                <div>
                    <label class="block text-xs text-[#ff00ff] mb-1 font-bold uppercase">Documento de Identidad (Frente) 🪪</label>
                    <input type="file" id="kyc-doc-file" accept="image/*" class="hidden" onchange="app.handleKYCDocPreview(event)">
                    <label for="kyc-doc-file" class="w-full flex items-center justify-between border border-dashed border-[#ff00ff] rounded-xl p-3 cursor-pointer">
                        <span class="text-xs text-neutral-300" id="kyc-doc-label">Seleccionar foto del documento</span>
                    </label>
                </div>
                <div>
                    <label class="block text-xs text-[#ffb703] mb-1 font-bold uppercase">Selfie con papel y fecha 📸</label>
                    <input type="file" id="kyc-selfie-file" accept="image/*" class="hidden" onchange="app.handleKYCSelfiePreview(event)">
                    <label for="kyc-selfie-file" class="w-full flex items-center justify-between border border-dashed border-[#ffb703] rounded-xl p-3 cursor-pointer">
                        <span class="text-xs text-neutral-300" id="kyc-selfie-label">Tomar / Seleccionar selfie</span>
                    </label>
                </div>
                <button type="submit" class="w-full btn-neon-cyan py-3.5 rounded-xl font-black text-sm uppercase">ENVIAR AL BÚNKER ADMIN</button>
            </form>
        </div>
    </div>

    <!-- MODAL: CATÁLOGO DINÁMICO DE LOS 5 PACKS TÁCTICOS -->
    <div id="modal-catalog" class="hidden fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-80 backdrop-blur-sm">
        <div class="glass-panel w-full max-w-md h-[85vh] rounded-t-3xl p-6 flex flex-col relative border-b-0">
            <button onclick="app.closeModals()" class="absolute top-4 right-4 bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
            <h2 class="text-3d-cyan text-2xl text-center mb-6 font-black">5 PACKS TÁCTICOS $ALPHA</h2>
            <div class="overflow-y-auto pb-10 space-y-4 pr-2" id="catalog-packages-list">
                <div class="text-center text-neutral-400 mt-10 font-bold">Cargando paquetes... ⏳</div>
            </div>
        </div>
    </div>

    <!-- MODAL: IN-APP CHAT (CRM & VIDEO CALL) -->
    <div id="modal-chat" class="hidden fixed inset-0 z-[80] flex items-end justify-center bg-black bg-opacity-80 backdrop-blur-sm">
        <div class="glass-panel w-full max-w-md h-[85vh] rounded-t-3xl flex flex-col relative overflow-hidden">
            <div class="bg-black p-4 flex items-center justify-between border-b border-[#00f3ff]">
                <div>
                    <h3 class="font-bold text-white text-base">CHAT GLOBAL & VIDEO BÚNKER</h3>
                    <p class="text-xs text-[#00ff00] font-extrabold"><i class="fa-solid fa-circle text-[6px] animate-pulse"></i> Conectado en directo</p>
                </div>
                <button onclick="app.closeModals()" class="bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
            </div>
            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50"></div>
            <div class="p-4 bg-black border-t border-gray-800 flex items-center gap-3 pb-6">
                <input type="text" id="chat-input" class="flex-1 cyber-input rounded-full text-base py-3 px-6 border-[#ff00ff]" placeholder="Escribe tu mensaje..." onkeypress="app.handleChatKeyPress(event)">
                <button onclick="app.sendChatMessage()" class="w-14 h-14 shrink-0 rounded-full bg-gradient-to-tr from-[#00f3ff] to-[#ff00ff] text-white flex items-center justify-center text-xl">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: MENÚ DE PROPINAS DEL FAN -->
    <div id="modal-fan-tip-menu" class="hidden fixed inset-0 z-[95] flex items-end justify-center bg-black bg-opacity-90">
        <div class="bg-neutral-900 border-t-2 border-[#ffb703] w-full max-w-md h-[75vh] rounded-t-3xl p-6 flex flex-col relative">
            <button onclick="app.closeModals()" class="absolute top-4 right-4 bg-red-600 rounded-full px-4 py-2 text-white font-bold text-sm">VOLVER</button>
            <h2 class="text-xl font-black text-[#ffb703] uppercase mb-1">🪙 ENVIAR PROPINA A</h2>
            <p id="fan-tip-creator-name" class="text-3xl font-black text-white mb-6">@Creador</p>
            <div id="fan-tip-slots-container" class="flex-1 overflow-y-auto space-y-3 pb-6 pr-2"></div>
        </div>
    </div>

    <div id="toast" class="toast">¡Copiado! 📋</div>
    
    <script src="js/security.js?v=4"></script>
    <script src="js/translations.js?v=4"></script>
    <script src="js/api.js?v=4"></script>
    <script src="js/app.js?v=4" defer></script>
</body>
</html>
```[cite: 5]

---

¿Todo listo para hacer el `git push` y verificar esta maravilla operando en Railway y Netlify, Master Tom?