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
    
    tempKYCDoc: null,
    tempKYCSelfie: null,

    chatSocket: null,
    globalChatSocket: null,

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    getTrans(key) {
        const lang = this.currentLang || localStorage.getItem('alpha_lang') || 'es';
        if (window.t && window.t[lang] && window.t[lang][key]) {
            return window.t[lang][key];
        }
        return key;
    },

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
            toast.onclick = () => toast.classList.remove('show');
            clearTimeout(this.toastTimer);
            // 🕒 Reducido a 1 segundo exacto (1000ms) para que no estorbe
            this.toastTimer = setTimeout(() => toast.classList.remove('show'), 1000); 
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

    triggerFireworks() {
        const canvas = document.getElementById('fireworks-canvas');
        if (!canvas) return;
        canvas.classList.remove('hidden');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let particles = [];
        const colors = ['#00f3ff', '#ff00ff', '#ffffff', '#ffb703'];

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                alpha: 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 4 + 2
            });
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, index) => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(p.alpha, 0);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                if (p.alpha <= 0) particles.splice(index, 1);
            });

            if (particles.length > 0) {
                requestAnimationFrame(animate);
            } else {
                canvas.classList.add('hidden');
            }
        }
        animate();
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
        this.initUserId();
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
        const ranks = ['SPY 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICON LEGEND 💎'];
        const currentRank = ranks[this.userData?.access_tier || 0] || ranks[0];

        if (rankDisplay) rankDisplay.innerText = currentRank;
        if (rankFeed) rankFeed.innerText = currentRank;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status');
        const kycDescEl = document.getElementById('prof-kyc-desc');
        const kycBtn = document.getElementById('btn-verify-kyc');

        const isAdminUser = (String(this.userId) === '8269470905' || this.userData?.role === 'admin' || localStorage.getItem('alpha_user_role') === 'admin');

        if (kycStatusEl) {
            if (kycStatus === 'verified' || isAdminUser) {
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
            if (userRole === 'creator' || isAdminUser) {
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
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
            const savedId = localStorage.getItem("alpha_user_id");
            if (savedId && savedId != tgUser.id) {
                ['alpha_user_name', 'alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role'].forEach(k => localStorage.removeItem(k));
            }
            this.userId = tgUser.id;
            localStorage.setItem("alpha_user_id", this.userId);
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
                        <input type="text" id="tip-title-${i}" value="${this.escapeHtml(existing.title)}" placeholder="Ej: Video exclusivo 3min" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white focus:border-[#ff00ff] outline-none placeholder-gray-500 font-medium" />
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
                            this.triggerFireworks(); 
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

        container.innerHTML = `<div class="text-center text-neutral-400 mt-10 font-bold">${this.getTrans('cat_loading')}</div>`;

        try {
            const res = await fetch(`${this.backendUrl}/payments/packages`);
            if (res.ok) {
                const data = await res.json();
                let packages = data.packages || [];

                const order = ['spy', 'soldier', 'veteran', 'legend', 'icon-legend'];
                packages.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));

                container.innerHTML = packages.map(pkg => {
                    const translatedName = this.getTrans(`pkg_${pkg.slug}_name`) || pkg.name;
                    const translatedDesc = this.getTrans(`pkg_${pkg.slug}_desc`) || pkg.description;

                    return `
                        <div class="bg-black border-2 ${pkg.slug === 'icon-legend' ? 'border-[#ffb703] shadow-[0_0_18px_rgba(255,183,3,0.3)]' : pkg.slug === 'legend' ? 'border-[#ff00ff] shadow-[0_0_12px_rgba(255,0,255,0.2)]' : 'border-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.2)]'} rounded-2xl p-5 relative">
                            <div class="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-3 py-0.5 rounded-full text-[10px] font-black uppercase shadow">
                                ${this.escapeHtml(pkg.badge || 'TÁCTICO')} ${pkg.bonus_percentage > 0 ? `(+${pkg.bonus_percentage}% Bonus)` : ''}
                            </div>
                            <div class="flex justify-between items-center mb-2 mt-1">
                                <h3 class="text-lg font-black text-white"><i class="fa-solid fa-shield-halved text-[#00f3ff] mr-1.5"></i> ${this.escapeHtml(translatedName)}</h3>
                                <span class="text-xl font-black text-[#ffb703]">${pkg.alpha_total} $ALPHA</span>
                            </div>
                            <p class="text-xs text-gray-300 mb-4 font-medium">${this.escapeHtml(translatedDesc)}</p>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="app.buyPackageStars('${pkg.slug}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">
                                    ⭐ ${pkg.price_stars} Stars
                                </button>
                                <button onclick="app.rechargeAlphaCoins(${pkg.price_ton}, ${pkg.alpha_total})" class="w-full bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-cyan-500/30 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">
                                    💎 ${pkg.price_ton} TON
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                throw new Error('Error al cargar paquetes tácticos');
            }
        } catch (err) {
            console.warn('[PACKAGES LOAD ERROR]:', err);
            container.innerHTML = `<div class="text-center text-red-400 mt-10 font-bold">${this.getTrans('cat_error')}</div>`;
        }
    },

    async subscribeCreatorTier(tierSlug) {
        this.haptic('medium');
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const isAdminUser = (String(this.userId) === '8269470905' || this.userData?.role === 'admin' || localStorage.getItem('alpha_user_role') === 'admin');

        if (kycStatus !== 'verified' && !isAdminUser) {
            this.showToast('⚠️ Debes verificar tu identidad (KYC +18) para activar tu suscripción de creador.');
            this.openKYCModal();
            return;
        }

        const planName = tierSlug === 'soldier_creator' ? 'Soldier Creator ($4.99/mes)' : 'Icon Creator ($7.99/mes)';
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
                this.triggerFireworks();
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
            this.triggerFireworks(); 

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
        if (this.globalChatSocket) {
            this.globalChatSocket.close();
            this.globalChatSocket = null;
        }
        ['modal-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-banks', 'modal-chat', 'modal-global-chat', 'modal-kyc', 'modal-tip-menu-edit', 'modal-fan-tip-menu'].forEach(m => {
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
    
    // 💬 MODAL 1: SOPORTE BÚNKER (CRM PRIVADO CON ADMIN)
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
                    data.messages.forEach(msg => this.appendChatMessage(msg, 'chat-messages'));
                    this.scrollToBottom('chat-messages');
                } else {
                    container.innerHTML = '<div class="text-center text-neutral-500 mt-4 text-xs font-semibold">Soporte Búnker CRM iniciado. 🛡️</div>';
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

        const statusEl = document.getElementById('chat-routed');
        if (statusEl) statusEl.innerText = this.getTrans('chat_connecting');

        this.chatSocket = new WebSocket(wsUrl);
        
        this.chatSocket.onopen = () => {
            if (statusEl) statusEl.innerText = this.getTrans('chat_connected');
        };

        this.chatSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.appendChatMessage(msg, 'chat-messages');
                this.scrollToBottom('chat-messages');
            } catch (e) {}
        };

        this.chatSocket.onclose = () => {
            if (statusEl) statusEl.innerText = this.getTrans('chat_error');
        };
    },

    // 💬 MODAL 2: CHAT GLOBAL & VIDEO BÚNKER (COMUNIDAD INDEPENDIENTE)
    async openGlobalChat() {
        this.closeModals();
        document.getElementById('modal-global-chat')?.classList.remove('hidden');
        await this.loadGlobalChatHistory();
        this.initGlobalChatWebSocket();
    },

    async loadGlobalChatHistory() {
        const container = document.getElementById('global-chat-messages');
        if (container) container.innerHTML = '';
        try {
            const res = await fetch(`${this.backendUrl}/chat/global/history?limit=50`);
            if (res.ok) {
                const data = await res.json();
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => this.appendChatMessage(msg, 'global-chat-messages'));
                    this.scrollToBottom('global-chat-messages');
                } else {
                    container.innerHTML = '<div class="text-center text-neutral-500 mt-4 text-xs font-semibold">Chat Global Búnker activo. 🌐</div>';
                }
            }
        } catch (e) {}
    },

    initGlobalChatWebSocket() {
        this.initUserId();
        if (!this.userId) return;

        if (this.globalChatSocket) {
            this.globalChatSocket.close();
            this.globalChatSocket = null;
        }

        const wsProtocol = this.backendUrl.startsWith('https') ? 'wss://' : 'ws://';
        const cleanBaseUrl = this.backendUrl.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}${cleanBaseUrl}/chat/global/ws/${this.userId}`;

        this.globalChatSocket = new WebSocket(wsUrl);
        this.globalChatSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.appendChatMessage(msg, 'global-chat-messages');
                this.scrollToBottom('global-chat-messages');
            } catch (e) {}
        };
    },

    appendChatMessage(msg, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const isMe = msg.user_id == this.userId;
        const ranks = ['SPY 🕵️', 'SOLDIER 🎖️', 'VETERAN ⚔️', 'LEGEND 👑', 'ICON LEGEND 💎'];
        const rankName = ranks[msg.access_level] || ranks[0];

        const safeContent = this.escapeHtml(msg.content);
        const safeAuthorName = this.escapeHtml(msg.author_name);

        let html = '';
        if (msg.is_system) {
            html = `<div class="flex flex-col items-center my-2"><div class="bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs px-4 py-2 rounded-full font-bold text-center"><i class="fa-solid fa-bolt mr-1"></i> ${safeContent}</div></div>`;
        } else if (isMe) {
            html = `<div class="flex flex-col items-end my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold mr-1">TÚ • ${rankName}</span><div class="bg-[#00f3ff]/20 text-white text-sm p-3 rounded-2xl border border-[#00f3ff]/50 max-w-[85%]">${safeContent}</div></div>`;
        } else {
            html = `<div class="flex flex-col items-start my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold ml-1"><span class="text-[#00f3ff] font-black">@${safeAuthorName}</span> • ${rankName}</span><div class="bg-neutral-800 text-white text-sm p-3 rounded-2xl border border-neutral-700 max-w-[85%]">${safeContent}</div></div>`;
        }
        container.insertAdjacentHTML('beforeend', html);
    },

    scrollToBottom(containerId) {
        const container = document.getElementById(containerId);
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
        } else {
            this.showToast(this.getTrans('toast_reconnecting'));
            this.initChatWebSocket();
            setTimeout(() => {
                if (this.chatSocket && this.chatSocket.readyState === WebSocket.OPEN) {
                    this.chatSocket.send(text);
                    if (input) input.value = ''; 
                }
            }, 1000);
        }
    },

    sendGlobalChatMessage() {
        this.haptic('light');
        const input = document.getElementById('global-chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        if (this.globalChatSocket && this.globalChatSocket.readyState === WebSocket.OPEN) {
            this.globalChatSocket.send(text);
            if (input) input.value = '';
        } else {
            this.showToast(this.getTrans('toast_reconnecting'));
            this.initGlobalChatWebSocket();
            setTimeout(() => {
                if (this.globalChatSocket && this.globalChatSocket.readyState === WebSocket.OPEN) {
                    this.globalChatSocket.send(text);
                    if (input) input.value = '';
                }
            }, 1000);
        }
    },

    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },
    handleGlobalChatKeyPress(e) { if (e.key === 'Enter') this.sendGlobalChatMessage(); },

    openUploadPanel() {
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;
        const isAdminUser = (String(this.userId) === '8269470905' || userRole === 'admin' || this.userData?.role === 'admin');

        // Los fans ahora pueden publicar, solo se pide KYC a los Creadores.
        if (userRole === 'creator' && kycStatus !== 'verified' && !isAdminUser) {
            this.showToast('⚠️ Debes verificar tu cuenta (+18) para publicar como creador.');
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
        
        const isAdminUser = (String(this.userId) === '8269470905' || this.userData?.role === 'admin');
        if (isAdminUser) {
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
                this.showToast('¡Publicación guardada en el Búnker! 🛡️');
                this.switchView('feed');
                await this.renderFeed();
            } else {
                throw new Error(data.detail || 'Error al guardar publicación');
            }
        } catch (err) {
            this.showToast('⚠️ Error al publicar contenido');
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
                const isAdminUser = (String(this.userId) === '8269470905' || this.userData?.role === 'admin');
                const isOwnerOrAdmin = (this.userId == post.creator_id || isAdminUser);

                const safeAuthor = this.escapeHtml(post.author || 'mastertom');
                const safeContent = this.escapeHtml(post.content);
                const safeAuthorAttr = this.escapeHtml(post.author || 'Creador').replace(/"/g, '&quot;');

                // 🛡️ REGLA: Si el autor es 'fan', se oculta el botón de propinas. Solo Creadores y Admins reciben propinas.
                const showTipBtn = (post.author_role === 'creator' || post.author_role === 'admin');

                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 cursor-pointer" onclick="app.openProfile()">
                                <div class="w-9 h-9 rounded-full border border-[#00f3ff] overflow-hidden bg-black flex items-center justify-center">
                                    <i class="fa-solid fa-user text-xs text-[#00f3ff]"></i>
                                </div>
                                <span class="font-bold text-amber-400 text-sm">@${safeAuthor}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-neutral-500">Tier: Niv.${post.levelRequired}</span>
                                ${isOwnerOrAdmin ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${safeContent}</p>` : ''}
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">CONTENIDO EXCLUSIVO BLOQUEADO</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">
                                    🔓 DESBLOQUEAR (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${this.escapeHtml(post.media_url)}" class="rounded-xl w-full max-h-80 object-cover mb-3" alt="Media"/>` : '')}
                        
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'}">
                                <i class="fa-solid fa-heart"></i> Like
                            </button>
                            
                            ${showTipBtn ? `
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${safeAuthorAttr}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">
                                🪙 Dar Propina
                            </button>
                            ` : ''}
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
                <span class="font-bold text-sm">${this.escapeHtml(s.title)}</span>
                <span class="bg-[#ffb703] text-black text-xs font-black px-3 py-1.5 rounded-xl">${s.price_alpha} $ALPHA</span>
            </button>
        `).join('');
    },

    async sendTipFromPost(creatorId, amount, postId) {
        try {
            await sendAlphaTip(this.userId, creatorId, amount, postId);
            this.showToast(`¡Propina de ${amount} $ALPHA enviada! 🚀`);
            this.triggerFireworks(); 
            this.closeModals();
            await this.refreshUserData();
        } catch (e) { this.showToast('⚠️ Saldo insuficiente'); }
    },

    startVideoCall() { 
        this.haptic('medium');
        this.initUserId();
        
        const isAdminUser = (String(this.userId) === '8269470905' || this.userData?.role === 'admin');
        const userTier = this.userData?.access_tier || 0; 

        if (userTier < 3 && !isAdminUser) {
            this.showToast('⚠️ Acceso restringido. Requiere rango Legend o Icon Legend.');
            this.openCatalogPackages();
            return;
        }

        this.showToast(this.getTrans('toast_video')); 
        this.openGlobalChat();
    },

    selectCreatorRole() { this.showToast('Rol de Creador seleccionado'); this.closeModals(); },
    selectFanRole() { this.showToast('Rol de Fan seleccionado'); this.closeModals(); }
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => {
    if (typeof app === 'undefined') {
        console.error("Error crítico: el objeto app no se inicializó.");
        return;
    }
    app.checkSession(); 
    app.generateCaptcha();
});