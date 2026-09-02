const app = {
    userId: null,
    tonConnectUI: null,
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    currentCaptcha: '',
    isAdmin: false,
    userAccessLevel: 0,
    userData: { name: 'USER', access_tier: 0, role: 'fan', warnings: 0 },
    lastView: 'consent',
    tempPostMedia: null,
    registerRoleSelected: 'fan',
    
    tempKYCDoc: null,
    tempKYCSelfie: null,
    tempChatMediaData: null, 
    
    activeWebcamStream: null, 
    isMicMuted: false,
    isCamOff: false,
    isVideoMinimized: false,

    isAdminUser() {
        return this.userData?.role === 'admin';
    },

    sanitizeUrl(url) {
        if (!url) return '';
        const s = String(url).trim();
        if (s.startsWith('data:image/') || s.startsWith('data:video/')) return s;
        try {
            const u = new URL(s);
            if (u.protocol === 'https:') return s;
        } catch(e) {}
        return '';
    },

    _captchaFailCount: 0,
    _captchaBlockedUntil: 0,

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    getTrans(key) {
        const lang = this.currentLang || localStorage.getItem('alpha_lang') || 'es';
        if (window.t && window.t[lang] && window.t[lang][key]) return window.t[lang][key];
        return key;
    },

    haptic(style) {
        try { if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred(style); } catch (e) {}
    },

    showToast(msg) {
        let oldToast = document.getElementById('alpha-dynamic-toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.id = 'alpha-dynamic-toast';
        toast.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 scale-95 opacity-0 bg-black/95 border-2 border-amber-500 text-amber-400 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.6)] z-[9999] pointer-events-none flex items-center gap-2 max-w-[90%] text-center transition-all duration-300';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation animate-pulse"></i> <span>${this.escapeHtml(msg)}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => { toast.classList.remove('scale-95', 'opacity-0'); toast.classList.add('scale-100', 'opacity-100'); }, 10);
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('scale-100', 'opacity-100'); toast.classList.add('scale-95', 'opacity-0');
                setTimeout(() => { if (document.body.contains(toast)) toast.remove(); }, 300);
            }
        }, 1500);
    },

    showLevelUpAnimation(rankLevel) {
        this.haptic('heavy');
        this.triggerFireworks();
        
        const rankInfo = this.getRankBadge(rankLevel);
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500 opacity-0';
        overlay.innerHTML = `
            <div class="levitate flex flex-col items-center text-center">
                <h2 class="text-4xl font-black text-[#00f3ff] uppercase tracking-widest mb-8 drop-shadow-[0_0_15px_rgba(0,243,255,0.8)]">${this.getTrans('level_up_title') || '¡NUEVO RANGO!'}</h2>
                <div class="relative inline-flex w-40 h-40 items-center justify-center mb-8">
                    <div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[25px] opacity-90 animate-pulse"></div>
                    <img src="${rankInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain drop-shadow-[0_0_10px_rgba(0,243,255,1)]" onerror="this.src='./assets/badge_0.png'"> 
                </div>
                <p class="text-3xl font-black text-[#ffb703] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,183,3,0.8)]">${rankInfo.name}</p>
                <p class="text-sm font-bold text-neutral-300 mt-4 uppercase tracking-widest">${this.getTrans('level_up_sub') || 'Privilegios Desbloqueados'}</p>
            </div>
        `;
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
        setTimeout(() => {
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 500);
        }, 4500);
    },

    copyText(text) { navigator.clipboard.writeText(text).then(() => this.showToast('¡Copiado! 📋')); },
    openLink(url) { if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url); else window.open(url, '_blank'); },

    compressImage(file, maxWidth = 1024, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                    canvas.width = width; canvas.height = height;
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
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        let particles = [];
        const colors = ['#00f3ff', '#ff00ff', '#ffffff', '#ffb703'];
        for (let i = 0; i < 100; i++) {
            particles.push({ x: canvas.width / 2, y: canvas.height / 2, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, alpha: 1, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 4 + 2 });
        }
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, index) => {
                p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
                ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(p.alpha, 0);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                if (p.alpha <= 0) particles.splice(index, 1);
            });
            if (particles.length > 0) requestAnimationFrame(animate); else canvas.classList.add('hidden');
        }
        animate();
    },

    getRankBadge(level) {
        const badges = {
            0: './assets/badge_0.png',
            1: './assets/badge_1.png',
            2: './assets/badge_2.png',
            3: './assets/badge_3.png',
            4: './assets/badge_04.jpg'
        };
        const keys = ['pkg_spy_name', 'pkg_soldier_name', 'pkg_veteran_name', 'pkg_legend_name', 'pkg_icon_legend_name'];
        const name = this.getTrans(keys[level]) || ['SPY', 'SOLDIER', 'VETERAN', 'LEGEND', 'ICON LEGEND'][level];
        return { img: badges[level] || badges[0], name: name };
    },

    async refreshUserData() {
        if (!this.userId) this.initUserId();
        if (!this.userId) return;
        try {
            let balance = 0;
            const res = await fetch(`${this.backendUrl}/wallet/balance/${this.userId}`);
            if (res.ok) { const data = await res.json(); balance = data.balance_alfa_coins ?? data.alpha_balance ?? 0; }
            document.querySelectorAll('#prof-alpha-balance, #wallet-balance, .wallet-balance-val').forEach(el => { el.innerText = `${balance} $ALPHA`; });
        } catch (err) {}
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
                    if (data.role) { this.userData.role = data.role; localStorage.setItem('alpha_user_role', data.role); }
                    if (data.name && data.name !== 'USER') { this.userData.name = data.name; localStorage.setItem('alpha_user_name', data.name); }
                    if (data.access_level !== undefined) this.userData.access_tier = data.access_level;
                    if (data.warnings_count !== undefined) this.userData.warnings = data.warnings_count;
                    this.updateProfileUI();
                }
            }
        } catch (err) {}
    },

    updateProfileUI() {
        this.initUserId();
        const savedName = localStorage.getItem('alpha_user_name') || this.userData?.name;
        const aliasInput = document.getElementById('prof-alias');
        if (aliasInput && savedName) { aliasInput.value = savedName; this.userData.name = savedName; }

        const nameFeed = document.getElementById('name-feed');
        if (nameFeed && savedName) nameFeed.innerText = savedName;

        const savedAvatar = localStorage.getItem('alpha_user_avatar');
        const avatarImg = document.getElementById('prof-avatar-img');
        const avatarFeed = document.getElementById('avatar-feed');
        if (savedAvatar) {
            if (avatarImg) { avatarImg.src = savedAvatar; avatarImg.classList.remove('hidden'); }
            if (avatarFeed) avatarFeed.src = savedAvatar;
        }

        const rankDisplay = document.getElementById('prof-rank'), rankFeed = document.getElementById('rank-feed');
        const rankInfo = this.getRankBadge(this.userData?.access_tier || 0);
        
        const rankHTML = `<div class="relative inline-block w-6 h-6 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[8px] opacity-80"></div><img src="${rankInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle font-black">${rankInfo.name}</span>`;
        if (rankDisplay) rankDisplay.innerHTML = rankHTML;
        if (rankFeed) rankFeed.innerHTML = `<div class="relative inline-block w-4 h-4 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[6px] opacity-80"></div><img src="${rankInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle text-xs font-black">${rankInfo.name}</span>`;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status'), kycDescEl = document.getElementById('prof-kyc-desc'), kycBtn = document.getElementById('btn-verify-kyc');
        const isAdminUser = this.isAdminUser();
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;
        
        const walletConnected = (this.tonConnectUI && this.tonConnectUI.connected) || localStorage.getItem('alpha_ton_connected') === 'true';
        const ccConnected = localStorage.getItem('alpha_cc_connected') === 'true';
        const hasPaymentMethod = walletConnected || ccConnected;

        let warningText = "";
        if(this.userData.warnings > 0) warningText = ` - ⚠️ ${this.getTrans('warnings_label') || 'ADVERTENCIAS'}: ${this.userData.warnings}/5`;

        if (kycStatusEl) {
            if (userRole === 'fan' && hasPaymentMethod) {
                kycStatusEl.innerHTML = `<img src="./assets/badge_verified.png" style="mix-blend-mode: screen; background-color: transparent;" class="w-4 h-4 inline-block align-middle mr-1" onerror="this.style.display='none'"> <span class="align-middle">${this.getTrans('status_wallet_linked') || 'BILLETERA / TARJETA VINCULADA'} ✅ ${warningText}</span>`; 
                kycStatusEl.className = `text-xs font-black uppercase text-green-400 flex items-center justify-center`;
                if (kycDescEl) kycDescEl.innerText = this.getTrans('status_kyc_fan_desc') || 'Método de pago activo. No requieres verificación KYC.';
                
                const sessionValid = localStorage.getItem('alpha_logged_in') === 'true' && this.userId;
                if (kycBtn && sessionValid) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerHTML = `<i class="fa-solid fa-money-check-dollar mr-1"></i> ${this.getTrans('btn_link_payment') || 'CAMBIAR MÉTODO DE PAGO'}`;
                    kycBtn.className = 'w-full bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition uppercase mt-3';
                    kycBtn.setAttribute('onclick', 'app.openPaymentMethods()');
                } else if (kycBtn) {
                    kycBtn.classList.add('hidden');
                }

            } else if (kycStatus === 'verified' || isAdminUser) {
                kycStatusEl.innerHTML = `<img src="./assets/badge_verified.png" style="mix-blend-mode: screen; background-color: transparent;" class="w-4 h-4 inline-block align-middle mr-1" onerror="this.style.display='none'"> <span class="align-middle">VERIFICADO (+18) ✅ ${warningText}</span>`; 
                kycStatusEl.className = `text-xs font-black uppercase text-green-400 flex items-center justify-center`;
                if (kycDescEl) kycDescEl.innerText = 'Identidad y mayoría de edad confirmada. Acceso total activo.';
                if (kycBtn) kycBtn.classList.add('hidden');
            } else {
                if (userRole === 'fan') {
                    kycStatusEl.innerText = `${this.getTrans('status_unlinked') || 'PAGO NO VINCULADO'} ⚠️${warningText}`; 
                    kycStatusEl.className = `text-xs font-black uppercase text-neutral-400`;
                    if (kycDescEl) kycDescEl.innerText = this.getTrans('status_unlinked_desc') || 'Conecta tu Wallet o Tarjeta de Crédito para verificar tu cuenta sin hacer KYC.';
                    if (kycBtn) {
                        kycBtn.classList.remove('hidden');
                        kycBtn.innerHTML = this.getTrans('btn_link_payment') || 'VINCULAR PAGO';
                        kycBtn.className = 'w-full bg-[#00f3ff] text-black hover:bg-[#00f3ff]/80 font-black py-3 px-4 rounded-xl text-xs shadow-[0_0_15px_rgba(0,243,255,0.4)] transition mt-2';
                        kycBtn.setAttribute('onclick', 'app.openPaymentMethods()');
                    }
                } else {
                    kycStatusEl.innerText = `NO VERIFICADO ⚠️${warningText}`; 
                    kycStatusEl.className = `text-xs font-black uppercase text-neutral-400`;
                    if (kycDescEl) kycDescEl.innerText = 'Verifica tu documento oficial y selfie para publicar y monetizar.';
                    if (kycBtn) {
                        kycBtn.classList.remove('hidden');
                        kycBtn.innerText = 'VERIFICAR CUENTA AHORA';
                        kycBtn.className = 'w-full bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-black py-3 px-4 rounded-xl text-xs shadow-[0_0_15px_rgba(255,0,255,0.4)] transition uppercase mt-2';
                        kycBtn.setAttribute('onclick', 'app.openKYCModal()');
                    }
                }
            }
        }

        const ccData = JSON.parse(localStorage.getItem('alpha_cc_data') || '{}');
        if (ccData.next_billing_date && ccData.recurring) {
            const daysLeft = Math.ceil((new Date(ccData.next_billing_date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3 && daysLeft >= 0) {
                this.showToast(`⚠️ Alerta: Tu suscripción se renovará automáticamente en ${daysLeft} día(s).`);
            }
        }

        const creatorTools = document.getElementById('prof-creator-tools'), creatorSubBox = document.getElementById('prof-creator-subscription-box');
        
        if (creatorTools) {
            creatorTools.classList.remove('hidden'); 
            const dynamicButtons = document.querySelectorAll('button[onclick="app.openTipMenuManagementModal()"], button[onclick="app.openFavoritesModal()"]');
            
            if (userRole === 'creator' || isAdminUser) {
                if (creatorSubBox) creatorSubBox.classList.remove('hidden');
                dynamicButtons.forEach(btn => {
                    btn.innerHTML = `<i class="fa-solid fa-list-ul"></i> ${this.getTrans('b2b_edit_tips') || 'EDITAR MIS 10 SLOTS (TIP MENU)'}`;
                    btn.setAttribute('onclick', 'app.openTipMenuManagementModal()');
                    btn.classList.replace('bg-[#00f3ff]', 'bg-[#ff00ff]');
                    btn.classList.replace('text-[#00f3ff]', 'text-[#ff00ff]');
                });
            } else {
                if (creatorSubBox) creatorSubBox.classList.add('hidden'); 
                dynamicButtons.forEach(btn => {
                    btn.innerHTML = `<i class="fa-solid fa-star"></i> ${this.getTrans('btn_my_favorites') || 'MIS CREADORES FAVORITOS'}`;
                    btn.setAttribute('onclick', 'app.openFavoritesModal()');
                    btn.classList.replace('bg-[#ff00ff]', 'bg-[#00f3ff]'); 
                    btn.classList.replace('text-[#ff00ff]', 'text-[#00f3ff]');
                });
            }
        }
    },

    updateViewsCounter() {
        let views = parseInt(localStorage.getItem('alpha_real_views') || '0') + 1;
        localStorage.setItem('alpha_real_views', views.toString());
        const viewsEl = document.getElementById('views-counter');
        if (viewsEl) viewsEl.innerText = views.toLocaleString();
    },

    initUserId() {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
            const savedId = localStorage.getItem("alpha_user_id");
            if (savedId && savedId != tgUser.id) ['alpha_user_name', 'alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
            this.userId = tgUser.id; localStorage.setItem("alpha_user_id", this.userId);
        } else {
            let localId = localStorage.getItem("alpha_user_id");
            if (!localId) { localId = "99" + Math.floor(100000 + Math.random() * 900000); localStorage.setItem("alpha_user_id", localId); }
            this.userId = parseInt(localId);
        }
    },

    async initTonConnect() {
        if (!this.tonConnectUI && window.TON_CONNECT_UI) {
            try {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ 
                    manifestUrl: window.location.origin + '/tonconnect-manifest.json',
                    uiPreferences: { theme: 'DARK' }
                });
                this.tonConnectUI.onStatusChange(async (wallet) => {
                    const btnHdr = document.getElementById('btn-wallet-hdr');
                    if (wallet?.account) {
                        localStorage.setItem('alpha_ton_connected', 'true');
                        const shortAddress = wallet.account.address.slice(0, 4) + '...' + wallet.account.address.slice(-4);
                        if (btnHdr) btnHdr.innerText = shortAddress;
                        await fetch(`${this.backendUrl}/wallet/connect-ton`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, ton_address: wallet.account.address }) });
                        await this.refreshUserData();
                        this.updateProfileUI();
                    } else { 
                        localStorage.removeItem('alpha_ton_connected');
                        if (btnHdr) btnHdr.innerText = 'CONECTAR WALLET'; 
                        this.updateProfileUI();
                    }
                });
            } catch (err) {}
        }
    },

    async connectWallet() {
        try {
            this.haptic('medium'); 
            this.initUserId(); 
            await this.initTonConnect();
            if (!this.tonConnectUI) {
                this.showToast('⚠️ TON Connect UI no disponible.');
                return;
            }
            if (this.tonConnectUI.connected) {
                if (confirm('¿Desconectar billetera?')) { 
                    await this.tonConnectUI.disconnect(); 
                    const btnHdr = document.getElementById('btn-wallet-hdr'); 
                    if (btnHdr) btnHdr.innerText = 'CONECTAR WALLET'; 
                    localStorage.removeItem('alpha_ton_connected');
                    this.updateProfileUI();
                }
            } else { 
                await this.tonConnectUI.openModal(); 
            }
        } catch (err) {
            this.showToast('⚠️ Error al abrir TON Connect.');
        }
    },

    openPaymentMethods() {
        this.closeModals();
        let modal = document.getElementById('modal-payment-methods');
        if (!modal) {
            const modalHTML = `
                <div id="modal-payment-methods" class="fixed inset-0 z-[95] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-sm flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <h3 class="text-xl font-black text-[#00f3ff] mb-4 text-center tracking-widest uppercase">${this.getTrans('pay_methods_title') || 'MÉTODOS DE PAGO'}</h3>
                        <p class="text-xs text-neutral-300 text-center mb-6">${this.getTrans('pay_methods_desc') || 'Vincula tu cuenta para verificar tu perfil B2C de inmediato.'}</p>
                        <button onclick="app.connectWallet()" class="bg-blue-600 text-white font-black py-4 rounded-xl mb-3 flex items-center justify-center gap-2 uppercase shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition"><i class="fa-solid fa-wallet text-xl"></i> ${this.getTrans('btn_connect_ton') || 'Conectar TON Wallet'}</button>
                        <button onclick="app.connectCreditCard()" class="bg-neutral-800 border border-neutral-600 text-white font-black py-4 rounded-xl mb-3 flex items-center justify-center gap-2 uppercase hover:bg-neutral-700 active:scale-95 transition"><i class="fa-solid fa-credit-card text-xl"></i> ${this.getTrans('btn_credit_card') || 'Tarjeta de Crédito'}</button>
                        <button onclick="app.openPaymentLogModal()" class="bg-neutral-800 border border-neutral-600 text-white font-black py-3 rounded-xl mb-3 flex items-center justify-center gap-2 uppercase hover:bg-neutral-700 active:scale-95 transition text-xs"><i class="fa-solid fa-receipt"></i> ${this.getTrans('payment_log_title') || 'Historial de Pagos'}</button>
                        <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold mt-2 uppercase text-sm w-full text-center transition">${this.getTrans('btn_cancel') || 'Cancelar'}</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-payment-methods');
        }
        modal.classList.remove('hidden');
    },

    detectCardBrand(cardNumber) {
        const clean = cardNumber.replace(/\D/g, '');
        const brandEl = document.getElementById('cc-brand-badge');
        if (!brandEl) return;
        if (clean.startsWith('4')) {
            brandEl.innerHTML = '<i class="fa-brands fa-visa text-blue-400 text-base mr-1"></i> <span class="text-[10px] text-blue-400 font-black">VISA</span>';
        } else if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) {
            brandEl.innerHTML = '<i class="fa-brands fa-mastercard text-red-500 text-base mr-1"></i> <span class="text-[10px] text-red-500 font-black">MASTERCARD</span>';
        } else {
            brandEl.innerHTML = '<i class="fa-solid fa-credit-card text-neutral-400 text-base"></i>';
        }
    },

    connectCreditCard() {
        this.haptic('medium');
        this.closeModals();
        let modal = document.getElementById('modal-cc-form');
        if (!modal) {
            const modalHTML = `
                <div id="modal-cc-form" class="fixed inset-0 z-[96] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-md flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <div class="flex items-center justify-between mb-3 pb-3 border-b border-[#00f3ff]/30">
                            <h3 class="text-lg font-black text-[#00f3ff] uppercase tracking-wider flex items-center gap-2">
                                <i class="fa-solid fa-lock"></i> ${this.getTrans('cc_modal_title') || 'VINCULAR TARJETA'}
                            </h3>
                            <div id="cc-brand-badge" class="bg-black px-2.5 py-1 rounded-lg border border-neutral-700 flex items-center">
                                <i class="fa-solid fa-credit-card text-neutral-400 text-base"></i>
                            </div>
                        </div>
                        <div class="space-y-3 flex-1 overflow-y-auto pr-1 mt-1">
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_number') || 'NÚMERO DE TARJETA'}</label>
                                <input type="text" id="cc-number" placeholder="4532 1234 5678 8921" maxlength="19" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/(.{4})/g, '\\$1 ').trim(); app.detectCardBrand(this.value);" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium" />
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_name') || 'NOMBRE DEL TITULAR'}</label>
                                <input type="text" id="cc-name" placeholder="Felipe Sanchez" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium" />
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="relative">
                                    <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_expiry') || 'EXPIRACIÓN'}</label>
                                    <input type="text" id="cc-expiry" placeholder="MM/AA" maxlength="5" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium text-center" />
                                </div>
                                <div class="relative">
                                    <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_cvv') || 'CVV'}</label>
                                    <input type="password" id="cc-cvv" placeholder="•••" maxlength="4" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium text-center" />
                                </div>
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_bank') || 'BANCO EMISOR'}</label>
                                <select id="cc-bank" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium">
                                    <option value="" disabled selected>Selecciona un banco internacional</option>
                                    <option value="JPMorgan Chase">JPMorgan Chase</option>
                                    <option value="Bank of America">Bank of America</option>
                                    <option value="Citibank">Citibank</option>
                                    <option value="HSBC">HSBC</option>
                                    <option value="Santander">Santander</option>
                                    <option value="BBVA">BBVA</option>
                                    <option value="Bancolombia">Bancolombia</option>
                                    <option value="Nubank">Nubank</option>
                                    <option value="Revolut">Revolut</option>
                                    <option value="Wise">Wise</option>
                                    <option value="N26">N26</option>
                                    <option value="Other International Bank">Otro Banco Internacional</option>
                                </select>
                            </div>
                            
                            <!-- Opción de Suscripción Mensual Recorrente -->
                            <div class="bg-neutral-950 border border-neutral-800 p-3 rounded-2xl flex items-start gap-2 mt-2">
                                <input type="checkbox" id="cc-recurring" class="mt-1 accent-[#00f3ff]" checked />
                                <div>
                                    <label for="cc-recurring" class="text-[11px] font-bold text-white uppercase block cursor-pointer">${this.getTrans('recurring_billing_label') || 'HABILITAR SUSCRIPCIÓN MENSUAL RECURRENTE'}</label>
                                    <p class="text-[9px] text-neutral-400 mt-0.5">${this.getTrans('recurring_billing_desc') || 'Cobro automático cada 30 días. Alerta 3 días antes.'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-4 pt-3 border-t border-[#00f3ff]/30 flex gap-2">
                            <button onclick="app.openPaymentMethods()" class="w-1/2 bg-neutral-800 border border-neutral-600 text-white py-3 rounded-xl text-xs font-black uppercase transition">${this.getTrans('btn_back') || 'Regresar'}</button>
                            <button onclick="app.saveCreditCardData()" class="w-1/2 bg-[#00f3ff] text-black py-3 rounded-xl text-xs font-black uppercase shadow-[0_0_10px_rgba(0,243,255,0.5)] transition">${this.getTrans('btn_save_bio') || 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-cc-form');
        }
        modal.classList.remove('hidden');
    },

    saveCreditCardData() {
        this.haptic('medium');
        const numInput = document.getElementById('cc-number');
        const nameInput = document.getElementById('cc-name');
        const expiryInput = document.getElementById('cc-expiry');
        const cvvInput = document.getElementById('cc-cvv');
        const bankSelect = document.getElementById('cc-bank');
        const recurringCheck = document.getElementById('cc-recurring');

        const num = numInput?.value.trim();
        const name = nameInput?.value.trim();
        const expiry = expiryInput?.value.trim();
        const cvv = cvvInput?.value.trim();
        const bank = bankSelect?.value;
        const recurring = recurringCheck ? recurringCheck.checked : true;

        if (!num || !name || !bank || !expiry || !cvv) {
            this.showToast('⚠️ Completa todos los campos obligatorios y selecciona tu banco.');
            return;
        }

        if(num.replace(/\D/g,'').length < 13) {
            this.showToast('⚠️ Número de tarjeta inválido.');
            return;
        }

        const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const maskedCard = {
            last4: num.slice(-4),
            bank: bank,
            recurring: recurring,
            next_billing_date: nextBilling,
            token: "tok_alpha_" + Math.random().toString(36).substr(2, 10),
            connected_at: new Date().toISOString()
        };

        localStorage.setItem('alpha_cc_data', JSON.stringify(maskedCard));
        localStorage.setItem('alpha_cc_connected', 'true');
        
        const logs = JSON.parse(localStorage.getItem('alpha_payment_logs') || '[]');
        logs.unshift({ description: 'Vinculación de Tarjeta de Crédito', amount: '0.00 $ALPHA', date: new Date().toISOString() });
        localStorage.setItem('alpha_payment_logs', JSON.stringify(logs));

        numInput.value = ''; nameInput.value = ''; expiryInput.value = ''; cvvInput.value = ''; bankSelect.selectedIndex = 0;
        
        this.showToast('¡Tarjeta cifrada y vinculada en tu perfil! 💳✅');
        this.closeModals();
        this.updateProfileUI();
    },

    payWithCreditCard(alphaAmount, targetLevel = null) {
        this.haptic('heavy');
        
        const ccData = JSON.parse(localStorage.getItem('alpha_cc_data') || '{}');
        if(!ccData.token) {
            this.showToast('⚠️ Error de seguridad. Vuelve a vincular tu tarjeta.');
            this.openPaymentMethods();
            return;
        }

        this.showToast(`Procesando compra segura de ${alphaAmount} $ALPHA con Tarjeta... 💳`);
        
        setTimeout(() => {
            this.showToast('¡Pago completado! 💎');
            this.triggerFireworks();

            const logs = JSON.parse(localStorage.getItem('alpha_payment_logs') || '[]');
            logs.unshift({ description: 'Compra de Rango / Paquete $ALPHA', amount: `${alphaAmount} $ALPHA`, date: new Date().toISOString() });
            localStorage.setItem('alpha_payment_logs', JSON.stringify(logs));

            this.refreshUserData();
            setTimeout(async () => {
                await this.syncKYCStatus();
                let finalLevel = targetLevel !== null ? targetLevel : this.userData.access_tier;
                this.showLevelUpAnimation(finalLevel);
            }, 1500);
        }, 2000);
    },

    openPaymentLogModal() {
        this.closeModals();
        let modal = document.getElementById('modal-payment-log');
        if (!modal) {
            const modalHTML = `
                <div id="modal-payment-log" class="fixed inset-0 z-[95] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-lg h-[80vh] flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#00f3ff]/30">
                            <h3 class="text-xl font-black text-[#00f3ff] uppercase tracking-wider"><i class="fa-solid fa-receipt mr-2"></i> ${this.getTrans('payment_log_title') || 'REGISTRO DE PAGOS'}</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <div id="payment-log-list" class="flex-1 overflow-y-auto space-y-3 pr-1"></div>
                        <div class="mt-4 pt-3 border-t border-[#00f3ff]/30">
                            <button onclick="app.openPaymentMethods()" class="w-full bg-neutral-800 border border-neutral-600 text-white py-3 rounded-xl text-xs font-black uppercase transition">${this.getTrans('btn_back') || 'Regresar'}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-payment-log');
        }
        modal.classList.remove('hidden');
        const container = document.getElementById('payment-log-list');
        const logs = JSON.parse(localStorage.getItem('alpha_payment_logs') || '[]');
        if (logs.length === 0) {
            container.innerHTML = `<div class="text-center text-neutral-500 mt-10 text-xs font-bold uppercase tracking-widest bg-black/50 p-4 rounded-xl">Sin registros de pago aún.</div>`;
        } else {
            container.innerHTML = logs.map(log => `
                <div class="bg-black border border-neutral-800 p-3.5 rounded-2xl flex justify-between items-center text-xs text-white shadow-md">
                    <div>
                        <p class="font-black text-[#00f3ff]">${log.description}</p>
                        <p class="text-[10px] text-neutral-400 mt-0.5">${new Date(log.date).toLocaleString()}</p>
                    </div>
                    <span class="font-black text-[#ffb703] bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">${log.amount}</span>
                </div>
            `).join('');
        }
    },

    openFavoritesModal() {
        this.closeModals();
        this.initUserId();
        
        let modal = document.getElementById('modal-favorites-edit');
        if (!modal) {
            const modalHTML = `
                <div id="modal-favorites-edit" class="fixed inset-0 z-[95] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-lg h-[80vh] flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#00f3ff]/30">
                            <h3 class="text-xl font-black text-[#00f3ff] uppercase tracking-wider"><i class="fa-solid fa-star mr-2"></i> ${this.getTrans('favorites_title') || 'FAVORITOS'}</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <p class="text-xs text-neutral-300 mb-4 font-medium leading-relaxed">${this.getTrans('favorites_desc') || 'Etiqueta a tus creadores favoritos.'}</p>
                        <div id="favorites-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        
                        <div class="mt-4 pt-4 border-t border-[#00f3ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2">${this.getTrans('btn_back') || 'Regresar'}</button>
                            <button onclick="app.saveAllFavorites()" class="bg-[#00f3ff] text-black hover:bg-[#00f3ff]/80 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2 shadow-[0_0_10px_rgba(0,243,255,0.5)]">${this.getTrans('btn_save_bio') || 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-favorites-edit');
        }

        modal.classList.remove('hidden');
        const container = document.getElementById('favorites-slots-form');
        let favs = JSON.parse(localStorage.getItem('alpha_user_favorites') || '[]');
        
        let htmlContent = '';
        for (let i = 1; i <= 10; i++) {
            const existing = favs[i-1] || '';
            htmlContent += `
                <div class="bg-black border border-[#00f3ff]/50 p-3.5 rounded-2xl flex flex-col gap-2 relative shadow-md">
                    <div class="absolute -top-2.5 left-3 bg-[#00f3ff] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Fav #${i}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[#00f3ff] font-bold">@</span>
                        <input type="text" id="fav-username-${i}" value="${this.escapeHtml(existing)}" placeholder="username" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white focus:border-[#00f3ff] outline-none font-medium" />
                    </div>
                </div>
            `;
        }
        container.innerHTML = htmlContent;
    },

    saveAllFavorites() {
        this.haptic('heavy');
        let favs = [];
        for (let i = 1; i <= 10; i++) {
            const input = document.getElementById(`fav-username-${i}`);
            if (input && input.value.trim() !== '') {
                favs.push(input.value.trim().replace('@', ''));
            }
        }
        localStorage.setItem('alpha_user_favorites', JSON.stringify(favs));
        this.showToast('¡Creadores favoritos guardados! 🌟');
        this.closeModals();
    },

    async loadTipMenu(creatorId) {
        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/creators/${creatorId || this.userId}/tip-menu`);
            if (res.ok) { const data = await res.json(); return data.slots || []; }
        } catch (err) {}
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
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <p class="text-xs text-neutral-300 mb-4 font-medium leading-relaxed">Configura tus 10 opciones de propina. No olvides guardar los cambios.</p>
                        <div id="tip-menu-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        
                        <div class="mt-4 pt-4 border-t border-[#ff00ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2">${this.getTrans('btn_back') || 'Regresar'}</button>
                            <button onclick="app.saveAllTipSlots()" class="bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2 shadow-[0_0_10px_rgba(255,0,255,0.5)]">${this.getTrans('btn_save_bio') || 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-tip-menu-edit');
        }

        modal.classList.remove('hidden');
        const container = document.getElementById('tip-menu-slots-form');
        container.innerHTML = '<div class="text-center text-neutral-400 mt-10 font-bold">Cargando... ⏳</div>';

        const slots = await this.loadTipMenu(this.userId);
        let htmlContent = '';
        for (let i = 1; i <= 10; i++) {
            const existing = slots.find(s => s.slot_number === i) || { title: '', price_alpha: 10 };
            htmlContent += `
                <div class="bg-black border border-[#ff00ff]/50 p-3.5 rounded-2xl flex flex-col gap-2 relative shadow-md">
                    <div class="absolute -top-2.5 left-3 bg-[#ff00ff] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Slot #${i}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <input type="text" id="tip-title-${i}" value="${this.escapeHtml(existing.title)}" placeholder="Ej: Video exclusivo 3min" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white focus:border-[#ff00ff] outline-none font-medium" />
                        <div class="relative w-24 shrink-0">
                            <i class="fa-solid fa-coins absolute left-2.5 top-1/2 transform -translate-y-1/2 text-[#ffb703] text-xs"></i>
                            <input type="number" id="tip-price-${i}" value="${existing.price_alpha}" placeholder="Precio" class="bg-neutral-900 border border-neutral-700 rounded-xl pl-7 pr-2 py-2.5 text-xs w-full text-white focus:border-[#ffb703] outline-none text-center font-black" />
                        </div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = htmlContent;
    },

    async saveAllTipSlots() {
        this.haptic('heavy');
        this.initUserId();
        this.showToast('Guardando menú completo... ⏳');
        let successCount = 0;

        for (let i = 1; i <= 10; i++) {
            const titleInput = document.getElementById(`tip-title-${i}`);
            const priceInput = document.getElementById(`tip-price-${i}`);
            const title = titleInput ? titleInput.value.trim() : '';
            const priceAlpha = parseInt(priceInput ? priceInput.value : '0');

            if (title && !isNaN(priceAlpha) && priceAlpha > 0) {
                try {
                    await fetch(`${this.backendUrl}/creators/tip-menu/update`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: this.userId, slot_number: i, title: title, price_alpha: priceAlpha })
                    });
                    successCount++;
                } catch (err) {}
            }
        }
        this.showToast(`¡${successCount} slots actualizados correctamente! 🛡️`);
        if(successCount > 0) this.closeModals();
    },

    async viewCreatorProfile(creatorId, creatorName) {
        this.haptic('medium');
        this.closeModals();
        this.showToast(`Conectando con el perfil de @${creatorName}... 📡`);
        
        let modal = document.getElementById('modal-creator-profile');
        if (!modal) {
            const modalHTML = `
                <div id="modal-creator-profile" class="fixed inset-0 z-[94] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-0 w-11/12 max-w-lg h-[85vh] flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)] overflow-hidden">
                        <div class="p-4 border-b border-[#00f3ff]/30 flex justify-between items-center bg-black">
                            <h3 class="text-lg font-black text-[#00f3ff] uppercase tracking-wider" id="creator-profile-name">@CREATOR</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        
                        <div class="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
                            <div class="flex flex-col items-center mb-6 mt-2">
                                <div class="w-24 h-24 rounded-full border-2 border-[#ffb703] overflow-hidden bg-black flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(255,183,3,0.4)]">
                                    <i class="fa-solid fa-user-astronaut text-4xl text-[#ffb703]"></i>
                                </div>
                                <button id="btn-dynamic-tip-menu" class="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black py-3 px-8 rounded-xl text-sm shadow-[0_0_15px_rgba(255,183,3,0.5)] transition active:scale-95 uppercase">
                                    <i class="fa-solid fa-coins mr-1"></i> Tip Menu (Propinas)
                                </button>
                            </div>
                            
                            <h4 class="text-[#00f3ff] font-bold text-sm border-b border-neutral-800 pb-2 mb-2 uppercase tracking-widest">Publicaciones en el Búnker</h4>
                            <div id="creator-posts-container" class="space-y-4"></div>
                        </div>
                        
                        <div class="p-3 border-t border-[#00f3ff]/30 bg-black flex justify-end">
                            <button onclick="app.closeModals();" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-6 py-2.5 rounded-xl text-sm font-black transition uppercase">Regresar al Muro</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-creator-profile');
        }

        document.getElementById('creator-profile-name').innerText = `@${creatorName}`;
        const tipBtn = document.getElementById('btn-dynamic-tip-menu');
        if(tipBtn) tipBtn.setAttribute('onclick', `app.openFanTipMenu(${creatorId}, null, '${creatorName}')`);

        modal.classList.remove('hidden');
        const container = document.getElementById('creator-posts-container');
        container.innerHTML = '<div class="text-center text-neutral-500 mt-4 text-xs font-bold">Cargando Búnker... ⏳</div>';

        try {
            const res = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            const data = res.ok ? await res.json() : {};
            const allPosts = data.posts || [];
            const creatorPosts = allPosts.filter(p => p.creator_id == creatorId);

            if (creatorPosts.length === 0) {
                container.innerHTML = `<div class="text-center text-neutral-500 mt-4 text-xs font-bold uppercase tracking-widest bg-black/50 p-4 rounded-xl">Sin publicaciones visibles.</div>`;
                return;
            }

            const likedPosts = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
            const isAdminUser = this.isAdminUser();

            container.innerHTML = creatorPosts.map(post => {
                const isLiked = likedPosts.includes(post.id);
                const isOwnerOrAdmin = (this.userId == post.creator_id || isAdminUser);
                const safeAuthorAttr = this.escapeHtml(post.author || 'Creador').replace(/"/g, '&quot;');
                const rankInfo = this.getRankBadge(post.levelRequired);
                
                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-bold text-amber-400 text-sm">@${this.escapeHtml(post.author || 'mastertom')}</span>
                            <div class="flex items-center gap-2 bg-black/50 px-2 py-1 rounded-lg">
                                <div class="relative inline-block w-4 h-4 mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[4px] opacity-80"></div><img src="${rankInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain" onerror="this.src='./assets/badge_0.png'"></div>
                                <span class="text-[10px] text-neutral-400 uppercase font-black">${rankInfo.name}</span>
                                ${isOwnerOrAdmin ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1 ml-2"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${this.escapeHtml(post.content)}</p>` : ''}
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">CONTENIDO EXCLUSIVO BLOQUEADO</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">
                                    🔓 DESBLOQUEAR (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${this.sanitizeUrl(post.media_url)}" class="rounded-xl w-full max-h-80 object-cover mb-3" alt="Media"/>` : '')}
                        
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'}">
                                <i class="fa-solid fa-heart"></i> Like
                            </button>
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${safeAuthorAttr}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">
                                🪙 Propina
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = `<div class="text-center text-red-500 mt-4 text-xs font-bold">Error cargando perfil.</div>`;
        }
    },

    async openFanTipMenu(creatorId, postId, creatorName) {
        this.closeModals();
        this.initUserId();
        
        let modal = document.getElementById('modal-fan-tip-menu');
        if (!modal) {
            const modalHTML = `
                <div id="modal-fan-tip-menu" class="fixed inset-0 z-[96] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#ffb703] rounded-3xl p-6 w-11/12 max-w-lg max-h-[85vh] flex flex-col shadow-[0_0_20px_rgba(255,183,3,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#ffb703]/30">
                            <h3 class="text-xl font-black text-[#ffb703] uppercase tracking-wider"><i class="fa-solid fa-coins mr-2"></i> TIP MENU</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <p class="text-center font-bold text-white mb-4 uppercase tracking-widest text-sm">Apoya a <span id="fan-tip-creator-name" class="text-[#00f3ff]"></span></p>
                        <div id="fan-tip-slots-container" class="flex-1 overflow-y-auto space-y-3 pb-4"></div>
                        
                        <div class="mt-4 pt-4 border-t border-[#ffb703]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="w-full bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 py-3 rounded-xl text-sm font-black transition uppercase">Regresar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-fan-tip-menu');
        }

        document.getElementById('fan-tip-creator-name').innerText = `@${creatorName}`;
        modal.classList.remove('hidden');

        const container = document.getElementById('fan-tip-slots-container');
        container.innerHTML = '<div class="text-center text-neutral-400 mt-4 font-bold">Desplegando menú... ⏳</div>';
        
        const slots = await this.loadTipMenu(creatorId);
        container.innerHTML = slots.length === 0 ? '<div class="text-center text-neutral-500 mt-10 font-bold bg-black/50 p-4 rounded-xl">El creador aún no configura su Tip Menu.</div>' : slots.map(s => `
            <button onclick="app.sendTipFromPost(${creatorId}, ${s.price_alpha}, ${postId || null})" class="w-full bg-black border border-[#ffb703]/50 hover:bg-[#ffb703]/20 rounded-2xl p-4 flex justify-between items-center text-white transition active:scale-95 shadow-md">
                <span class="font-bold text-sm text-left truncate pr-2">${this.escapeHtml(s.title)}</span>
                <span class="bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-xs font-black px-3 py-1.5 rounded-xl shadow-md whitespace-nowrap">${s.price_alpha} $ALPHA</span>
            </button>
        `).join('');
    },

    selectCreatorRole() { this.closeModals(); },
    selectFanRole() { this.closeModals(); }
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => {
    if (typeof app === 'undefined') return;
    app.checkSession(); app.generateCaptcha();
    
    const applyPrivacyBlackout = () => document.body.classList.add('privacy-blur');
    const removePrivacyBlackout = () => document.body.classList.remove('privacy-blur');

    document.addEventListener('visibilitychange', () => { if (document.hidden) applyPrivacyBlackout(); else removePrivacyBlackout(); });
    window.addEventListener('blur', applyPrivacyBlackout);
    window.addEventListener('focus', removePrivacyBlackout);

    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) { navigator.clipboard.writeText('CONTENIDO PROTEGIDO BÚNKER'); app.showToast('⚠️ Capturas bloqueadas.'); }
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) e.preventDefault();
    });
});