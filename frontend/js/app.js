const app = {
    userId: null,
    tonConnectUI: null,
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    currentCaptcha: '',
    isAdmin: false,
    userAccessLevel: 0,
    userData: { name: 'USER', access_tier: 0, role: 'fan', warnings: 0, isOnline: true },
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
    currentCheckoutPackage: null,

    peerConnections: {},
    remoteStreams: {},
    rtcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    },

    isAdminUser() { return this.userData?.role === 'admin'; },

    sanitizeUrl(url) {
        if (!url) return '';
        const s = String(url).trim();
        if (s.startsWith('data:image/') || s.startsWith('data:video/') || s.startsWith('data:audio/')) return s;
        try { const u = new URL(s); if (u.protocol === 'https:') return s; } catch(e) {}
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

    haptic(style) { try { if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred(style); } catch (e) {} },

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

    toggleTheme() {
        this.haptic('light');
        const body = document.body;
        body.classList.toggle('light-theme');
        const isLight = body.classList.contains('light-theme');
        localStorage.setItem('alpha_theme', isLight ? 'light' : 'dark');
        const themeSwitch = document.getElementById('theme-switch');
        if(themeSwitch) themeSwitch.checked = isLight;
        this.showToast(isLight ? this.getTrans('toast_theme_light') : this.getTrans('toast_theme_dark'));
    },

    initTheme() {
        const savedTheme = localStorage.getItem('alpha_theme') || 'dark';
        const isLight = savedTheme === 'light';
        if (isLight) document.body.classList.add('light-theme');
        const themeSwitch = document.getElementById('theme-switch');
        if(themeSwitch) themeSwitch.checked = isLight;
    },

    toggleOnlineStatus() {
        this.haptic('medium');
        if (this.userData.access_tier === 0 && !this.isAdminUser()) {
            this.userData.isOnline = true;
            this.showToast(this.getTrans('toast_offline_tier_req'));
            this.updateOnlineStatusUI();
            return;
        }
        this.userData.isOnline = !this.userData.isOnline;
        localStorage.setItem('alpha_user_online', this.userData.isOnline);
        this.updateOnlineStatusUI();
        this.showToast(this.userData.isOnline ? this.getTrans('toast_status_online') : this.getTrans('toast_status_offline'));
    },

    updateOnlineStatusUI() {
        const badge = document.getElementById('user-status-badge');
        const toggleBtn = document.getElementById('profile-status-toggle');
        const settingsBtnText = document.getElementById('settings-status-text');
        const settingsIndicator = document.getElementById('settings-status-indicator');
        const settingsBtn = document.getElementById('settings-status-btn');
        const profileDot = document.getElementById('profile-neon-dot');
        const feedDot = document.getElementById('feed-neon-dot');
        const isOnline = this.userData.isOnline !== false;
        
        if(profileDot) profileDot.style.display = isOnline ? 'block' : 'none';
        if(feedDot) feedDot.style.display = isOnline ? 'block' : 'none';
        
        if (badge) {
            badge.innerText = isOnline ? '● ONLINE' : '○ OFFLINE';
            badge.className = isOnline ? 'text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30' : 'text-[9px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700';
        }
        if (toggleBtn) {
            toggleBtn.innerText = isOnline ? '● ONLINE' : '○ OFFLINE';
            toggleBtn.className = isOnline ? 'text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/50' : 'text-xs font-black text-neutral-400 bg-neutral-800 px-2.5 py-0.5 rounded-full border border-neutral-700';
        }
        if (settingsBtnText && settingsIndicator && settingsBtn) {
            settingsBtnText.innerText = isOnline ? 'ONLINE' : 'OFFLINE';
            settingsIndicator.className = isOnline ? 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse' : 'w-2.5 h-2.5 rounded-full bg-red-500';
            settingsBtn.className = isOnline ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5' : 'bg-red-600/20 border border-red-500 text-red-400 px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5';
        }
    },

    openSettingsModal() {
        this.haptic('light');
        const modal = document.getElementById('modal-settings');
        if (modal) {
            modal.classList.remove('hidden');
            const nameInput = document.getElementById('settings-username-input');
            const savedName = localStorage.getItem('alpha_user_name') || 'mastertom';
            if (nameInput) nameInput.value = savedName;
            this.updateOnlineStatusUI();
            const isLight = document.body.classList.contains('light-theme');
            const themeSwitch = document.getElementById('theme-switch');
            if(themeSwitch) themeSwitch.checked = isLight;
        }
    },

    closeSettingsModal() { 
        this.haptic('light'); 
        document.getElementById('modal-settings')?.classList.add('hidden'); 
    },

    async updateUsernameSettings() {
        this.haptic('medium');
        const input = document.getElementById('settings-username-input');
        const newName = input ? input.value.trim() : '';
        if (!newName) { this.showToast(this.getTrans('toast_invalid_alias')); return; }

        const lastChange = localStorage.getItem('alpha_last_name_change');
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        if (lastChange && !this.isAdminUser()) {
            if ((now - parseInt(lastChange)) < thirtyDaysMs) {
                const daysLeft = Math.ceil((thirtyDaysMs - (now - parseInt(lastChange))) / (1000 * 60 * 60 * 24));
                this.showToast(this.getTrans('toast_alias_wait').replace('{days}', daysLeft));
                return;
            }
        }

        localStorage.setItem('alpha_user_name', newName);
        localStorage.setItem('alpha_last_name_change', now.toString());
        this.userData.name = newName;
        
        try {
            const initData = window.Telegram?.WebApp?.initData || "";
            await fetch(`${this.backendUrl}/users/sync`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ user_id: this.userId || 0, name: newName, init_data: initData, is_telegram: !!initData }) 
            });
        } catch(e) {}

        this.updateProfileUI(); this.showToast(this.getTrans('toast_alias_updated')); this.closeSettingsModal();
    },

    updatePasswordSettings() {
        this.haptic('medium');
        const oldPassInput = document.getElementById('settings-old-pass');
        const newPassInput = document.getElementById('settings-new-pass');
        const confirmPassInput = document.getElementById('settings-confirm-pass');
        
        const oldPass = oldPassInput?.value.trim(); const newPass = newPassInput?.value.trim(); const confirmPass = confirmPassInput?.value.trim();
        const currentSavedPass = localStorage.getItem('alpha_user_pass') || '';

        if (!oldPass || !newPass || !confirmPass) { this.showToast(this.getTrans('toast_pwd_empty')); return; }
        if (currentSavedPass && oldPass !== currentSavedPass) { this.showToast(this.getTrans('toast_pwd_mismatch')); return; }
        if (newPass.length < 6) { this.showToast(this.getTrans('toast_pwd_short')); return; }
        if (newPass !== confirmPass) { this.showToast(this.getTrans('toast_pwd_not_match')); return; }

        localStorage.setItem('alpha_user_pass', newPass);
        this.showToast(`🔒 ${this.getTrans('pwd_changed_success')}`);
        oldPassInput.value = ''; newPassInput.value = ''; if (confirmPassInput) confirmPassInput.value = '';
        this.closeSettingsModal();
    },

    async checkSession() {
        try {
            this.initUserId(); 
            this.initTonConnect().catch(e => console.warn('[TON] Esperando interacción de wallet:', e));
            this.initTheme();
            
            const savedLang = localStorage.getItem('alpha_lang') || 'es'; 
            this.currentLang = savedLang;
            const langText = document.getElementById('fab-lang-text'); 
            if (langText) langText.innerText = savedLang.toUpperCase();
            if (typeof window.applyTranslations === 'function') window.applyTranslations(savedLang);

            const splash = document.getElementById('view-splash');
            if (splash) splash.classList.remove('hidden');

            document.querySelectorAll('[id^="view-"]').forEach(el => { 
                if(el.id !== 'view-splash') el.classList.add('hidden'); 
            });

            setTimeout(() => {
                if (splash) {
                    splash.classList.add('opacity-0');
                    setTimeout(() => splash.classList.add('hidden'), 500);
                }
                
                const activeLogin = localStorage.getItem('alpha_logged_in');
                const hasConsent = localStorage.getItem('alpha_consent'); 
                const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
                
                if (activeLogin === 'true' || (tgUser && tgUser.id)) {
                    this.switchView('feed');
                    this.executeAutoLogin();
                } else if (hasConsent !== 'true') { 
                    this.switchView('consent'); 
                } else { 
                    this.switchView('captcha'); 
                    this.generateCaptcha();
                }
            }, 2500);
            
        } catch (e) {
            console.error("[SESSION ERROR]:", e);
            this.switchView('consent');
        }
    },

    async executeAutoLogin() {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        try { 
            const initData = window.Telegram?.WebApp?.initData || "";
            const res = await fetch(`${this.backendUrl}/users/sync`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ user_id: this.userId, name: localStorage.getItem('alpha_user_name') || tgUser?.first_name || this.getTrans('default_agent'), bio: localStorage.getItem('alpha_user_bio') || this.getTrans('default_bio_sync'), avatar: localStorage.getItem('alpha_user_avatar'), init_data: initData, is_telegram: !!initData }) 
            }); 
            const data = await res.json();
            if(res.ok && data.user) {
                if(data.user.avatar_url) localStorage.setItem('alpha_user_avatar', data.user.avatar_url);
                if(data.user.bio) localStorage.setItem('alpha_user_bio', data.user.bio);
                if(data.user.name) localStorage.setItem('alpha_user_name', data.user.name);
            }
        } catch(e) {}
        this.updateProfileUI(); 
        this.updateViewsCounter(); 
        await this.syncKYCStatus(); 
        await this.refreshUserData(); 
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
        const now = Date.now();
        if (now < this._captchaBlockedUntil) {
            const secs = Math.ceil((this._captchaBlockedUntil - now) / 1000);
            this.showToast(this.getTrans('toast_captcha_wait').replace('{secs}', secs));
            return;
        }
        const input = document.getElementById('captcha-input');
        const userValue = input ? input.value.trim().toUpperCase() : '';
        if (userValue === this.currentCaptcha && userValue !== '') {
            this._captchaFailCount = 0;
            const activeLogin = localStorage.getItem('alpha_logged_in');
            const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
            
            if (activeLogin === 'true' || (tgUser && tgUser.id)) {
                this.switchView('feed');
                this.executeAutoLogin();
            } else {
                this.switchView('login');
            }
        } else {
            this._captchaFailCount++;
            if (this._captchaFailCount >= 5) {
                this._captchaBlockedUntil = now + 30000;
                this._captchaFailCount = 0;
                this.showToast(this.getTrans('toast_captcha_blocked'));
            } else {
                this.showToast(this.getTrans('toast_captcha_error').replace('{count}', this._captchaFailCount));
            }
            if (input) input.value = '';
            this.generateCaptcha();
        }
    },
    switchView(viewName) {
        ['consent', 'login', 'captcha', 'register', 'lang', 'feed', 'upload', 'splash'].forEach(v => { 
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

    showLevelUpAnimation(rankLevel) {
        this.haptic('heavy');
        this.triggerFireworks();
        const rankInfo = this.getRankBadge(rankLevel);
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500 opacity-0';
        overlay.innerHTML = `
            <div class="levitate flex flex-col items-center text-center">
                <h2 class="text-4xl font-black text-[#00f3ff] uppercase tracking-widest mb-8 drop-shadow-[0_0_15px_rgba(0,243,255,0.8)]">${this.getTrans('level_up_title')}</h2>
                <div class="relative inline-flex w-40 h-40 items-center justify-center mb-8">
                    <div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[25px] opacity-90 animate-pulse"></div>
                    <img src="${rankInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain drop-shadow-[0_0_10px_rgba(0,243,255,1)]" onerror="this.src='./assets/badge_0.png'"> 
                </div>
                <p class="text-3xl font-black text-[#ffb703] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,183,3,0.8)]">${rankInfo.name}</p>
                <p class="text-sm font-bold text-neutral-300 mt-4 uppercase tracking-widest">${this.getTrans('level_up_sub')}</p>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
        setTimeout(() => { overlay.classList.add('opacity-0'); setTimeout(() => overlay.remove(), 500); }, 4500);
    },

    copyText(text) { navigator.clipboard.writeText(text).then(() => this.showToast(this.getTrans('toast_copied'))); },
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
        const badges = { 0: './assets/badge_0.png', 1: './assets/badge_1.png', 2: './assets/badge_2.png', 3: './assets/badge_3.png', 4: './assets/badge_04.jpg' };
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
                    if (data.name && data.name !== 'USER' && !data.name.startsWith('Tel:')) { this.userData.name = data.name; localStorage.setItem('alpha_user_name', data.name); }
                    if (data.avatar_url) localStorage.setItem('alpha_user_avatar', data.avatar_url);
                    if (data.bio) localStorage.setItem('alpha_user_bio', data.bio);
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
        const bioInput = document.getElementById('prof-bio');
        const savedBio = localStorage.getItem('alpha_user_bio');
        
        if (aliasInput && savedName && !savedName.startsWith('Tel:')) { aliasInput.value = savedName; this.userData.name = savedName; }
        if (bioInput && savedBio) { bioInput.value = savedBio; }

        const nameFeed = document.getElementById('name-feed');
        if (nameFeed && savedName && !savedName.startsWith('Tel:')) nameFeed.innerText = savedName;

        const savedAvatar = localStorage.getItem('alpha_user_avatar');
        const avatarImg = document.getElementById('prof-avatar-img');
        const avatarFeed = document.getElementById('avatar-feed');
        if (savedAvatar) {
            if (avatarImg) { avatarImg.src = savedAvatar; avatarImg.classList.remove('hidden'); }
            if (avatarFeed) avatarFeed.src = savedAvatar;
        }

        const rankDisplay = document.getElementById('prof-rank'), rankFeed = document.getElementById('rank-feed');
        const rankInfo = this.getRankBadge(this.userData?.access_tier || 0);
        const rankHTML = `<div class="relative inline-block w-6 h-6 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[8px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle font-black">${rankInfo.name}</span>`;
        if (rankDisplay) rankDisplay.innerHTML = rankHTML;
        if (rankFeed) rankFeed.innerHTML = `<div class="relative inline-block w-4 h-4 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[6px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle text-xs font-black">${rankInfo.name}</span>`;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status'), kycDescEl = document.getElementById('prof-kyc-desc'), kycBtn = document.getElementById('btn-verify-kyc');
        const isAdminUser = this.isAdminUser();
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;
        const walletConnected = (this.tonConnectUI && this.tonConnectUI.connected) || localStorage.getItem('alpha_ton_connected') === 'true';

        let warningText = "";
        if(this.userData.warnings > 0) warningText = ` - ⚠️ ${this.getTrans('warnings_label')}: ${this.userData.warnings}/5`;

        if (kycStatusEl) {
            if (userRole === 'fan' && walletConnected) {
                kycStatusEl.innerHTML = `<img src="./assets/badge_verified.png" style="mix-blend-mode: screen; background-color: transparent;" class="w-4 h-4 inline-block align-middle mr-1" onerror="this.style.display='none'"> <span class="align-middle">${this.getTrans('status_wallet_linked')} ✅ ${warningText}</span>`; 
                kycStatusEl.className = `text-xs font-black uppercase text-green-400 flex items-center justify-center`;
                if (kycDescEl) kycDescEl.innerText = this.getTrans('status_kyc_fan_desc');
                if (kycBtn && localStorage.getItem('alpha_logged_in') === 'true' && this.userId) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerHTML = `<i class="fa-solid fa-money-check-dollar mr-1"></i> CAMBIAR MÉTODO DE PAGO`;
                    kycBtn.className = 'w-full bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition uppercase mt-3';
                    kycBtn.setAttribute('onclick', 'app.openPaymentMethods()');
                }
            } else if (kycStatus === 'verified' || isAdminUser) {
                kycStatusEl.innerHTML = `<img src="./assets/badge_verified.png" style="mix-blend-mode: screen; background-color: transparent;" class="w-4 h-4 inline-block align-middle mr-1" onerror="this.style.display='none'"> <span class="align-middle">${this.getTrans('prof_kyc_verified')} ${warningText}</span>`; 
                kycStatusEl.className = `text-xs font-black uppercase text-green-400 flex items-center justify-center`;
                if (kycDescEl) kycDescEl.innerText = this.getTrans('prof_kyc_verified_desc');
                if (kycBtn) kycBtn.classList.add('hidden');
            } else {
                if (userRole === 'fan') {
                    kycStatusEl.innerText = `${this.getTrans('status_unlinked')} ⚠️${warningText}`; 
                    kycStatusEl.className = `text-xs font-black uppercase text-neutral-400`;
                    if (kycDescEl) kycDescEl.innerText = this.getTrans('status_unlinked_desc');
                    if (kycBtn) {
                        kycBtn.classList.remove('hidden');
                        kycBtn.innerHTML = this.getTrans('btn_link_payment');
                        kycBtn.className = 'w-full bg-[#00f3ff] text-black hover:bg-[#00f3ff]/80 font-black py-3 px-4 rounded-xl text-xs shadow-[0_0_15px_rgba(0,243,255,0.4)] transition mt-2';
                        kycBtn.setAttribute('onclick', 'app.openPaymentMethods()');
                    }
                } else {
                    kycStatusEl.innerText = `NO VERIFICADO ⚠️${warningText}`; 
                    kycStatusEl.className = `text-xs font-black uppercase text-neutral-400`;
                    if (kycDescEl) kycDescEl.innerText = this.getTrans('prof_kyc_desc');
                    if (kycBtn) {
                        kycBtn.classList.remove('hidden');
                        kycBtn.innerText = this.getTrans('btn_verify_kyc');
                        kycBtn.className = 'w-full bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 font-black py-3 px-4 rounded-xl text-xs shadow-[0_0_15px_rgba(255,0,255,0.4)] transition uppercase mt-2';
                        kycBtn.setAttribute('onclick', 'app.openKYCModal()');
                    }
                }
            }
        }

        const creatorTools = document.getElementById('prof-creator-tools'), creatorSubBox = document.getElementById('prof-creator-subscription-box');
        if (creatorTools) {
            creatorTools.classList.remove('hidden'); 
            const dynamicButtons = document.querySelectorAll('button[onclick="app.openTipMenuManagementModal()"], button[onclick="app.openFavoritesModal()"]');
            if (userRole === 'creator' || isAdminUser) {
                if (creatorSubBox) creatorSubBox.classList.remove('hidden');
                dynamicButtons.forEach(btn => {
                    btn.innerHTML = `<i class="fa-solid fa-list-ul"></i> ${this.getTrans('b2b_edit_tips')}`;
                    btn.setAttribute('onclick', 'app.openTipMenuManagementModal()');
                    btn.classList.replace('bg-[#00f3ff]', 'bg-[#ff00ff]');
                    btn.classList.replace('text-[#00f3ff]', 'text-[#ff00ff]');
                });
            } else {
                if (creatorSubBox) creatorSubBox.classList.add('hidden'); 
                dynamicButtons.forEach(btn => {
                    btn.innerHTML = `<i class="fa-solid fa-star"></i> ${this.getTrans('btn_my_favorites')}`;
                    btn.setAttribute('onclick', 'app.openFavoritesModal()');
                    btn.classList.replace('bg-[#ff00ff]', 'bg-[#00f3ff]'); 
                    btn.classList.replace('text-[#ff00ff]', 'text-[#ff00ff]');
                });
            }
        }
        this.updateOnlineStatusUI();
    },

    updateViewsCounter() {
        let views = parseInt(localStorage.getItem('alpha_real_views') || '0') + 1;
        localStorage.setItem('alpha_real_views', views.toString());
        const viewsEl = document.getElementById('views-counter');
        if (viewsEl) viewsEl.innerText = views.toLocaleString();
    },

    initUserId() {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const currentSavedId = localStorage.getItem("alpha_user_id");
        let newId = currentSavedId;
        if (tgUser && tgUser.id) {
            newId = tgUser.id.toString();
            if (currentSavedId && currentSavedId !== newId) localStorage.clear(); 
        } else if (!newId) {
            newId = "99" + Math.floor(100000 + Math.random() * 900000);
        }
        this.userId = newId; 
        localStorage.setItem("alpha_user_id", this.userId);
        
        const myAdminTelegramID = "8269470905"; 
        const myAdminPhone = "+573150213065"; 
        const javiAdminID = "123456789"; 
        
        if (this.userId === myAdminTelegramID || this.userId === javiAdminID || localStorage.getItem('alpha_user_name') === `Tel: ${myAdminPhone}`) {
            this.userData.role = 'admin';
            this.userData.access_tier = 4;
            localStorage.setItem('alpha_user_role', 'admin');
        }
    },

    async initTonConnect() {
        const TonConnectClass = (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) ? window.TON_CONNECT_UI.TonConnectUI : window.TonConnectUI;
        if (!this.tonConnectUI && TonConnectClass) {
            try {
                this.tonConnectUI = new TonConnectClass({ 
                    manifestUrl: "https://alpha-bunker-backend-production.up.railway.app/tonconnect-manifest.json",
                    uiPreferences: { theme: 'DARK' }
                });
                if (typeof this.tonConnectUI.connectionRestored === 'object') await this.tonConnectUI.connectionRestored;
                this.tonConnectUI.onStatusChange(async (wallet) => {
                    const btnHdr = document.getElementById('btn-wallet-hdr');
                    if (wallet?.account) {
                        localStorage.setItem('alpha_ton_connected', 'true');
                        if (btnHdr) btnHdr.innerText = wallet.account.address.slice(0, 4) + '...' + wallet.account.address.slice(-4);
                        await fetch(`${this.backendUrl}/wallet/connect-ton`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, ton_address: wallet.account.address }) });
                        await this.refreshUserData();
                        this.updateProfileUI();
                    } else { 
                        localStorage.removeItem('alpha_ton_connected');
                        if (btnHdr) btnHdr.innerText = this.getTrans('btn_wallet'); 
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
            if (!this.tonConnectUI) await this.initTonConnect();
            if (!this.tonConnectUI) { this.showToast(this.getTrans('toast_ton_not_loaded')); return; }
            if (this.tonConnectUI.connected) {
                if (confirm(this.getTrans('confirm_disconnect_wallet'))) { 
                    await this.tonConnectUI.disconnect(); 
                    if (document.getElementById('btn-wallet-hdr')) document.getElementById('btn-wallet-hdr').innerText = this.getTrans('btn_wallet'); 
                    localStorage.removeItem('alpha_ton_connected');
                    this.updateProfileUI();
                }
            } else { await this.tonConnectUI.openModal(); }
        } catch (err) {}
    },

    closeModals() {
        this.haptic('light');
        if (this.chatSocket) { this.chatSocket.close(); this.chatSocket = null; }
        if (this.globalChatSocket) { this.globalChatSocket.close(); this.globalChatSocket = null; }
        ['modal-profile', 'modal-settings', 'modal-creator-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-payment-methods', 'modal-favorites-edit', 'modal-banks', 'modal-chat', 'modal-global-chat', 'modal-kyc', 'modal-tip-menu-edit', 'modal-fan-tip-menu', 'media-lightbox-modal', 'modal-external-checkout', 'modal-manual-payment', 'modal-payout-request', 'modal-av-settings', 'modal-communities-links'].forEach(m => {
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

    openMenuModal() { 
        this.openCatalogPackages(); 
    },

    async viewCreatorProfile(userId, userName) {
        this.closeModals();
        this.haptic('light');
        let modal = document.getElementById('modal-creator-profile');
        if (!modal) {
            const modalHTML = `
                <div id="modal-creator-profile" class="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-md h-[85vh] flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)] relative">
                        <button onclick="app.closeModals()" class="absolute top-4 right-4 text-neutral-400 hover:text-white font-bold p-1 z-10"><i class="fa-solid fa-times text-xl"></i></button>
                        
                        <div class="flex flex-col items-center text-center mb-3 shrink-0">
                            <div class="relative w-20 h-20 rounded-full border-2 border-[#00f3ff] overflow-hidden bg-black mb-2 flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.4)]">
                                <img id="creator-prof-avatar" src="" class="w-full h-full object-cover hidden" onerror="this.style.display='none'">
                                <i id="creator-prof-default-icon" class="fa-solid fa-user text-2xl text-[#00f3ff]"></i>
                                <div id="creator-prof-dot" class="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black hidden"></div>
                            </div>
                            <h3 id="creator-prof-name" class="text-xl font-black text-white uppercase tracking-wider truncate w-full px-4">@${userName}</h3>
                            <span id="creator-prof-status" class="text-[10px] font-bold mt-1 px-2.5 py-0.5 rounded-full border">OFFLINE</span>
                            <span class="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-widest">Operativo en el Ecosistema Alfa</span>
                        </div>
                        
                        <div id="creator-prof-bio" class="text-xs text-neutral-300 bg-black/50 border border-neutral-800 rounded-xl p-3 mb-3 text-center shrink-0">Cargando biografía...</div>
                        
                        <div class="flex gap-2 mb-3 shrink-0">
                            <button onclick="app.openFanTipMenu(${userId}, null, '${userName}')" class="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl text-xs uppercase shadow-md transition flex items-center justify-center gap-2">
                                <i class="fa-solid fa-coins"></i> Enviar Tip
                            </button>
                        </div>
                        
                        <h4 class="text-xs font-black text-[#00f3ff] uppercase tracking-widest mb-2 shrink-0">Publicaciones del Creador</h4>
                        <div id="creator-prof-posts" class="flex-1 overflow-y-auto space-y-3 pr-2 pb-6">
                            <div class="text-center text-neutral-500 text-xs py-4">Cargando publicaciones...</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-creator-profile');
        }
        modal.classList.remove('hidden');

        const avatarEl = document.getElementById('creator-prof-avatar');
        const defaultIconEl = document.getElementById('creator-prof-default-icon');
        const dotEl = document.getElementById('creator-prof-dot');
        const nameEl = document.getElementById('creator-prof-name');
        const statusEl = document.getElementById('creator-prof-status');
        const bioEl = document.getElementById('creator-prof-bio');
        const postsContainer = document.getElementById('creator-prof-posts');

        nameEl.innerText = `@${userName}`;
        avatarEl.classList.add('hidden');
        defaultIconEl.style.display = 'block';
        dotEl.classList.add('hidden');
        statusEl.innerText = 'OFFLINE';
        statusEl.className = 'text-[10px] font-bold mt-1 px-2.5 py-0.5 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800';
        bioEl.innerText = 'Operativo en el Ecosistema Alpha.';
        postsContainer.innerHTML = `<div class="text-center text-neutral-500 text-xs py-4">Cargando publicaciones...</div>`;

        try {
            const res = await fetch(`${this.backendUrl}/kyc/status/${userId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.avatar_url) {
                    avatarEl.src = this.sanitizeUrl(data.avatar_url);
                    avatarEl.classList.remove('hidden');
                    defaultIconEl.style.display = 'none';
                }
                if (data.bio) { bioEl.innerText = data.bio; } else { bioEl.innerText = 'Operativo en el Ecosistema Alpha.'; }
                if (data.is_online) {
                    dotEl.classList.remove('hidden');
                    statusEl.innerText = '● ONLINE';
                    statusEl.className = 'text-[10px] font-bold mt-1 px-2.5 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
                }
            }
        } catch(e) {}

        try {
            const feedRes = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            if (feedRes.ok) {
                const feedData = await feedRes.json();
                const creatorPosts = (feedData.posts || []).filter(p => p.creator_id == userId);
                if (creatorPosts.length === 0) {
                    postsContainer.innerHTML = `<div class="text-center text-neutral-500 text-xs py-4 bg-black/40 rounded-xl">No hay publicaciones de este usuario.</div>`;
                } else {
                    postsContainer.innerHTML = creatorPosts.map(p => `
                        <div class="bg-black border border-neutral-800 rounded-xl p-3 text-white text-xs space-y-2 relative group">
                            <p class="text-neutral-200">${this.escapeHtml(p.content || '')}</p>
                            ${p.media_url ? `<div class="relative w-full cursor-pointer" onclick="app.openLightbox('${this.sanitizeUrl(p.media_url)}', '${p.media_url.match(/\.(mp4|webm)/i) || p.media_url.startsWith('data:video') ? 'video' : 'image'}')"><img src="${this.sanitizeUrl(p.media_url)}" class="rounded-lg w-full max-h-48 object-cover" /><div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg pointer-events-none"><i class="fa-solid fa-expand text-white text-2xl drop-shadow-md"></i></div></div>` : ''}
                            <div class="flex justify-between items-center text-[10px] text-neutral-400 pt-1 border-t border-neutral-900">
                                <span>❤️ ${p.likes_count || 0} likes</span>
                                <span class="text-[#00f3ff]">${p.price_alpha ? p.price_alpha + ' $ALPHA' : 'Gratis'}</span>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch(e) {
            postsContainer.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Error al cargar publicaciones.</div>`;
        }
    },

    // 🛡️ RESTRICCIÓN DE TELÉFONO EN EL REGISTRO
    registerWithData() {
        this.haptic('medium');
        const email = document.getElementById('reg-email-input')?.value.trim(), phone = document.getElementById('reg-phone-input')?.value.trim();
        if (!phone && !email) { this.showToast('Ingresa teléfono o email'); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        const isCreator = this.registerRoleSelected === 'creator';
        this.userData.role = this.registerRoleSelected; 
        
        let finalName = existingName;
        if (!finalName || finalName === 'USER' || finalName.startsWith('Tel:') || finalName.startsWith('+')) {
            finalName = email ? email.split('@')[0] : (isCreator ? "mastertom" : "VIP Fan");
        }
        
        this.userData.name = finalName;
        localStorage.setItem('alpha_user_name', finalName); 
        localStorage.setItem('alpha_logged_in', 'true'); 
        localStorage.setItem('alpha_user_role', this.registerRoleSelected);
        
        this.switchView('feed'); 
        this.syncKYCStatus(); 
        this.updateProfileUI(); 
        this.updateViewsCounter(); 
        this.refreshUserData(); 
        this.renderFeed();
    },

    async loginWithPhone() {
        this.haptic('medium'); 
        const phone = document.getElementById('phone-input')?.value.trim();
        if (!phone) { this.showToast('Ingresa tu teléfono'); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        
        let finalName = existingName;
        if (!finalName || finalName === 'USER' || finalName.startsWith('Tel:') || finalName.startsWith('+')) {
            finalName = "VIP Fan";
        }
        this.userData.name = finalName;
        localStorage.setItem('alpha_user_name', finalName);
        
        this.switchView('feed'); 
        await this.syncKYCStatus(); 
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
            const initData = window.Telegram?.WebApp?.initData || "";
            const res = await fetch(`${this.backendUrl}/users/sync`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ user_id: this.userId, name: localStorage.getItem('alpha_user_name') || 'Agente Búnker', bio: 'Operativo', avatar: localStorage.getItem('alpha_user_avatar'), init_data: initData, is_telegram: !!initData }) 
            }); 
            const data = await res.json();
            if(res.ok && data.user) {
                if(data.user.avatar_url) localStorage.setItem('alpha_user_avatar', data.user.avatar_url);
                if(data.user.bio) localStorage.setItem('alpha_user_bio', data.user.bio);
                if(data.user.name) localStorage.setItem('alpha_user_name', data.user.name);
            }
        } catch (e) {}
        this.switchView('feed'); 
        this.updateProfileUI(); 
        this.updateViewsCounter(); 
        await this.syncKYCStatus(); 
        this.refreshUserData(); 
        this.renderFeed();
    },
    openPaymentMethods() {
        this.closeModals();
        let modal = document.getElementById('modal-payment-methods');
        if (!modal) {
            const modalHTML = `
                <div id="modal-payment-methods" class="fixed inset-0 z-[95] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-sm flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <h3 class="text-xl font-black text-[#00f3ff] mb-4 text-center tracking-widest uppercase">${this.getTrans('pay_methods_title')}</h3>
                        <p class="text-xs text-neutral-300 text-center mb-6">${this.getTrans('pay_methods_desc')}</p>
                        <button onclick="app.connectWallet()" class="bg-blue-600 text-white font-black py-4 rounded-xl mb-3 flex items-center justify-center gap-2 uppercase shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition"><i class="fa-solid fa-wallet text-xl"></i> ${this.getTrans('btn_connect_ton')}</button>
                        <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold mt-4 uppercase text-sm w-full text-center transition">${this.getTrans('btn_cancel')}</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-payment-methods');
        }
        modal.classList.remove('hidden');
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
                            <h3 class="text-xl font-black text-[#00f3ff] uppercase tracking-wider"><i class="fa-solid fa-star mr-2"></i> ${this.getTrans('favorites_title')}</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <div id="favorites-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        <div class="mt-4 pt-4 border-t border-[#00f3ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 border border-neutral-600 text-white px-5 py-3 rounded-xl text-sm font-black uppercase w-1/2">${this.getTrans('btn_back')}</button>
                            <button onclick="app.saveAllFavorites()" class="bg-[#00f3ff] text-black px-5 py-3 rounded-xl text-sm font-black uppercase w-1/2 shadow-[0_0_10px_rgba(0,243,255,0.5)]">${this.getTrans('btn_save_bio')}</button>
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
            htmlContent += `<div class="bg-black border border-[#00f3ff]/50 p-3.5 rounded-2xl flex flex-col gap-2 relative shadow-md"><div class="absolute -top-2.5 left-3 bg-[#00f3ff] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Fav #${i}</div><div class="flex items-center gap-2 mt-1"><span class="text-[#00f3ff] font-bold">@</span><input type="text" id="fav-username-${i}" value="${this.escapeHtml(favs[i-1] || '')}" placeholder="username" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white outline-none" /></div></div>`;
        }
        container.innerHTML = htmlContent;
    },

    saveAllFavorites() {
        this.haptic('heavy');
        let favs = [];
        for (let i = 1; i <= 10; i++) {
            const input = document.getElementById(`fav-username-${i}`);
            if (input && input.value.trim() !== '') favs.push(input.value.trim().replace('@', ''));
        }
        localStorage.setItem('alpha_user_favorites', JSON.stringify(favs));
        this.showToast(this.getTrans('toast_favs_saved'));
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
                            <h3 class="text-xl font-black text-[#ff00ff] uppercase tracking-wider"><i class="fa-solid fa-list-ul mr-2"></i> ${this.getTrans('b2b_edit_tips')}</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <div id="tip-menu-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        <div class="mt-4 pt-4 border-t border-[#ff00ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 text-white px-5 py-3 rounded-xl text-sm font-black uppercase w-1/2">${this.getTrans('btn_back')}</button>
                            <button onclick="app.saveAllTipSlots()" class="bg-[#ff00ff] text-black px-5 py-3 rounded-xl text-sm font-black uppercase w-1/2 shadow-[0_0_10px_rgba(255,0,255,0.5)]">${this.getTrans('btn_save_bio')}</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-tip-menu-edit');
        }
        modal.classList.remove('hidden');
        const container = document.getElementById('tip-menu-slots-form');
        container.innerHTML = `<div class="text-center text-neutral-400 mt-10 font-bold">${this.getTrans('msg_loading')}</div>`;
        const slots = await this.loadTipMenu(this.userId);
        let htmlContent = '';
        for (let i = 1; i <= 10; i++) {
            const existing = slots.find(s => s.slot_number === i) || { title: '', price_alpha: 10 };
            htmlContent += `<div class="bg-black border border-[#ff00ff]/50 p-3.5 rounded-2xl flex flex-col gap-2 relative shadow-md"><div class="absolute -top-2.5 left-3 bg-[#ff00ff] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Slot #${i}</div><div class="flex items-center gap-2 mt-1"><input type="text" id="tip-title-${i}" value="${this.escapeHtml(existing.title)}" placeholder="Ej: Video exclusivo 3min" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs flex-1 text-white outline-none" /><div class="relative w-24 shrink-0"><i class="fa-solid fa-coins absolute left-2.5 top-1/2 transform -translate-y-1/2 text-[#ffb703] text-xs"></i><input type="number" id="tip-price-${i}" value="${existing.price_alpha}" placeholder="Precio" class="bg-neutral-900 border border-neutral-700 rounded-xl pl-7 pr-2 py-2.5 text-xs w-full text-white text-center font-black" /></div></div></div>`;
        }
        container.innerHTML = htmlContent;
    },

    async saveAllTipSlots() {
        this.haptic('heavy'); 
        this.initUserId(); 
        this.showToast(this.getTrans('toast_tip_saving'));
        let successCount = 0;
        for (let i = 1; i <= 10; i++) {
            const title = document.getElementById(`tip-title-${i}`)?.value.trim() || '';
            const priceAlpha = parseInt(document.getElementById(`tip-price-${i}`)?.value || '0');
            if (title && !isNaN(priceAlpha) && priceAlpha > 0) {
                try {
                    await fetch(`${this.backendUrl}/creators/tip-menu/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: this.userId, slot_number: i, title: title, price_alpha: priceAlpha }) });
                    successCount++;
                } catch (err) {}
            }
        }
        this.showToast(this.getTrans('toast_tip_saved').replace('{count}', successCount));
        if(successCount > 0) this.closeModals();
    },

    async openPayoutModal() {
        this.closeModals(); 
        this.initUserId();
        let modal = document.getElementById('modal-payout-request');
        if (!modal) {
            const modalHTML = `
                <div id="modal-payout-request" class="fixed inset-0 z-[96] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-emerald-500 rounded-3xl p-6 w-11/12 max-w-md flex flex-col shadow-[0_0_20px_rgba(16,185,129,0.3)] relative">
                        <button onclick="app.closeModals()" class="absolute top-4 right-4 text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        <h3 class="text-xl font-black text-emerald-400 mb-2 uppercase tracking-wider text-center"><i class="fa-solid fa-money-bill-transfer mr-2"></i> RETIRO B2B</h3>
                        <p class="text-xs text-neutral-300 text-center mb-4">Ingresa los datos para solicitar la liquidación de tus ganancias netas.</p>
                        <div class="bg-black border border-neutral-700 rounded-xl p-4 mb-4 text-center">
                            <span class="text-xs text-neutral-500 uppercase font-bold">Saldo Disponible</span>
                            <div class="text-2xl font-black text-emerald-400 mt-1" id="payout-balance-display">0 $ALPHA</div>
                        </div>
                        <div class="space-y-3">
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Monto a retirar ($ALPHA)</label>
                                <input type="number" id="payout-amount-input" placeholder="Ej: 1000" class="bg-black border border-neutral-700 rounded-xl px-4 py-3 text-sm w-full text-white focus:border-emerald-500 outline-none font-bold" />
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Método de Pago</label>
                                <select id="payout-method-select" class="bg-black border border-neutral-700 rounded-xl px-4 py-3 text-sm w-full text-white focus:border-emerald-500 outline-none font-bold appearance-none">
                                    <option value="binance">Binance Pay (ID / Email)</option>
                                    <option value="ton">TON Wallet (Dirección)</option>
                                    <option value="nequi">Nequi (Solo Colombia)</option>
                                    <option value="global66">Global66 (Email)</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Detalles de la Cuenta / Wallet</label>
                                <input type="text" id="payout-account-details" placeholder="Ingresa tu dirección, email o número" class="bg-black border border-neutral-700 rounded-xl px-4 py-3 text-sm w-full text-white focus:border-emerald-500 outline-none font-bold" />
                            </div>
                        </div>
                        <div class="mt-5">
                            <button onclick="app.submitPayoutRequest()" class="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3.5 rounded-xl uppercase transition shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95">ENVIAR SOLICITUD</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-payout-request');
        }
        try {
            const res = await fetch(`${this.backendUrl}/wallet/balance/${this.userId}`);
            if (res.ok) {
                const data = await res.json();
                const balance = data.alpha_balance ?? 0;
                document.getElementById('payout-balance-display').innerText = `${balance} $ALPHA`;
                const amountInput = document.getElementById('payout-amount-input');
                amountInput.value = balance > 0 ? balance : '';
                amountInput.max = balance;
            }
        } catch (err) {}
        modal.classList.remove('hidden');
    },

    async submitPayoutRequest() {
        this.haptic('heavy'); 
        this.initUserId();
        const amountInput = document.getElementById('payout-amount-input');
        const methodSelect = document.getElementById('payout-method-select');
        const detailsInput = document.getElementById('payout-account-details');
        const amount = parseInt(amountInput.value || '0');
        const method = methodSelect.value;
        const details = detailsInput.value.trim();

        if (isNaN(amount) || amount <= 0) { this.showToast('⚠️ Ingresa un monto válido mayor a 0.'); return; }
        if (!details) { this.showToast('⚠️ Ingresa los detalles de tu cuenta de destino.'); return; }

        this.showToast('Procesando solicitud... ⏳');
        try {
            const res = await fetch(`${this.backendUrl}/wallet/request-payout`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId, amount_alpha: amount, payout_method: method, account_details: details })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                this.showToast('✅ Solicitud enviada (Sujeta a 90 días de retención).');
                this.closeModals(); 
                this.refreshUserData();
            } else { this.showToast(`⚠️ Error: ${data.detail || 'No se pudo procesar'}`); }
        } catch (err) { this.showToast('⚠️ Error de conexión con el servidor.'); }
    },

    // 🛡️ TRADUCCIÓN DINÁMICA DE TIP MENU (Apoya a...)
    async openFanTipMenu(creatorId, postId, creatorName) {
        this.closeModals(); 
        this.initUserId();
        
        const targetCreatorId = (creatorId && creatorId !== 'null' && creatorId !== 'undefined') ? creatorId : this.userId;
        const safeCreatorName = creatorName || 'VIP Creator';

        let modal = document.getElementById('modal-fan-tip-menu');
        if (!modal) {
            const modalHTML = `
                <div id="modal-fan-tip-menu" class="fixed inset-0 z-[96] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#ffb703] rounded-3xl p-6 w-11/12 max-w-lg max-h-[85vh] flex flex-col shadow-[0_0_20px_rgba(255,183,3,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#ffb703]/30">
                            <h3 class="text-xl font-black text-[#ffb703] uppercase tracking-wider"><i class="fa-solid fa-coins mr-2"></i> TIP MENU</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <p class="text-center font-bold text-white mb-4 uppercase tracking-widest text-sm"><span id="fan-tip-support-label">Apoya a</span> <span id="fan-tip-creator-name" class="text-[#00f3ff]"></span></p>
                        
                        <div id="fan-tip-slots-container" class="overflow-y-auto space-y-3 mb-4 max-h-40"></div>
                        
                        <!-- Caja de Propina Libre y Mensaje -->
                        <div class="bg-black/50 border border-[#ffb703]/40 rounded-2xl p-4 mb-2 shadow-inner">
                            <h4 class="text-[10px] text-[#ffb703] font-black uppercase mb-2" id="fan-tip-custom-title">PROPINA PERSONALIZADA</h4>
                            <textarea id="fan-tip-message" rows="2" class="w-full bg-black border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#ffb703] outline-none mb-3 resize-none" placeholder="Escribe un mensaje al creador..."></textarea>
                            <div class="flex gap-2">
                                <div class="relative flex-1">
                                    <i class="fa-solid fa-coins absolute left-3 top-1/2 transform -translate-y-1/2 text-[#ffb703]"></i>
                                    <input type="number" id="fan-tip-amount" placeholder="Cantidad $ALPHA" class="w-full bg-black border border-neutral-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-black text-white focus:border-[#ffb703] outline-none" min="1">
                                </div>
                                <button onclick="app.sendCustomTip(${targetCreatorId}, ${postId || null})" class="bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-black px-4 py-2.5 rounded-xl uppercase text-xs shadow-md active:scale-95 transition" id="btn-fan-tip-send">ENVIAR</button>
                            </div>
                        </div>

                        <div class="pt-3 border-t border-[#ffb703]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="w-full bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 py-3 rounded-xl text-sm font-black transition uppercase" id="btn-fan-tip-back">VOLVER</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-fan-tip-menu');
        }

        const supportLabelEl = document.getElementById('fan-tip-support-label');
        if (supportLabelEl) supportLabelEl.innerText = this.getTrans('txt_support_creator') || 'Apoya a';
        document.getElementById('fan-tip-custom-title').innerText = this.getTrans('tip_custom_title') || "PROPINA PERSONALIZADA";
        document.getElementById('fan-tip-message').placeholder = this.getTrans('tip_msg_placeholder') || "Escribe un mensaje...";
        document.getElementById('fan-tip-amount').placeholder = this.getTrans('tip_amount_placeholder') || "Cantidad $ALPHA";
        document.getElementById('btn-fan-tip-send').innerText = this.getTrans('btn_send_tip') || "ENVIAR";
        document.getElementById('btn-fan-tip-back').innerText = this.getTrans('btn_back') || "VOLVER";

        document.getElementById('fan-tip-creator-name').innerText = `@${safeCreatorName}`;
        
        modal.classList.remove('hidden');

        const container = document.getElementById('fan-tip-slots-container');
        container.innerHTML = `<div class="text-center text-neutral-400 mt-4 font-bold text-xs">${this.getTrans('msg_loading')}</div>`;
        
        const slots = await this.loadTipMenu(targetCreatorId);
        
        if (slots.length === 0) {
            container.innerHTML = ``; 
        } else {
            container.innerHTML = slots.map(s => `
                <button onclick="app.sendTipFromPost(${targetCreatorId}, ${s.price_alpha}, ${postId || null})" class="w-full bg-black border border-[#ffb703]/50 hover:bg-[#ffb703]/20 rounded-2xl p-3 flex justify-between items-center text-white transition active:scale-95 shadow-md">
                    <span class="font-bold text-xs text-left truncate pr-2">${this.escapeHtml(s.title)}</span>
                    <span class="bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-xs font-black px-2 py-1 rounded-lg shadow-md whitespace-nowrap">${s.price_alpha} $ALPHA</span>
                </button>
            `).join('');
        }
    },

    async sendCustomTip(creatorId, postId) {
        this.haptic('heavy');
        const amountInput = document.getElementById('fan-tip-amount');
        const messageInput = document.getElementById('fan-tip-message');
        const amount = parseInt(amountInput.value || '0');
        const message = messageInput.value.trim();

        if (isNaN(amount) || amount <= 0) {
            this.showToast('⚠️ Ingresa una cantidad válida de $ALPHA.');
            return;
        }

        this.showToast('Enviando propina... ⏳');
        try {
            const res = await fetch(`${this.backendUrl}/wallet/transfer`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: this.userId, receiver_id: creatorId, amount_alpha: amount, post_id: postId, message: message })
            });
            if (res.ok) {
                this.showToast(this.getTrans('toast_tip_sent') || '¡Propina enviada con éxito!');
                amountInput.value = '';
                messageInput.value = '';
                this.closeModals();
                this.refreshUserData();
            } else {
                const data = await res.json();
                this.showToast(`⚠️ Error: ${data.detail || 'Saldo insuficiente'}`);
            }
        } catch(e) {
            this.showToast('⚠️ Error de red al enviar la propina.');
        }
    },

    async buyPackageStars(packageSlug, targetLevel = null) {
        this.haptic('medium'); 
        this.initUserId();
        this.showToast(this.getTrans('toast_invoice_gen'));
        try {
            const res = await fetch(`${this.backendUrl}/payments/create-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: this.userId, package_slug: packageSlug }) });
            const data = await res.json();
            if (res.ok && data.status === 'success' && data.invoice_link) {
                if (window.Telegram?.WebApp?.openInvoice) {
                    window.Telegram.WebApp.openInvoice(data.invoice_link, async (status) => {
                        if (status === 'paid') { 
                            this.haptic('heavy'); 
                            this.showToast(this.getTrans('toast_stars_paid')); 
                            try {
                                await fetch(`${this.backendUrl}/payments/verify-stars`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ user_id: this.userId, package_slug: packageSlug })
                                });
                            } catch(e) {}
                            setTimeout(async () => {
                                await this.syncKYCStatus(); await this.refreshUserData();
                                let finalLevel = targetLevel !== null ? targetLevel : this.userData.access_tier;
                                this.showLevelUpAnimation(finalLevel);
                            }, 1500);
                        }
                    });
                } else { window.open(data.invoice_link, '_blank'); }
            } else { throw new Error(data.detail || 'Error al generar la factura'); }
        } catch (err) {}
    },
    async rechargeAlphaCoins(priceTon, alphaTotal, targetLevel = null) {
        this.haptic('medium'); 
        this.initUserId();
        if (!this.tonConnectUI || !this.tonConnectUI.connected) { this.showToast(this.getTrans('toast_connect_ton_req') || '⚠️ Conecta tu billetera TON primero.'); this.openPaymentMethods(); return; }
        const MASTER_TON_WALLET = "UQAAnX4bGBzI0ujk35-XChap_wZ7x67NeJ85C_M1YIvLbYUF"; 
        const nanoTonAmount = Math.round(priceTon * 1e9).toString();
        const transaction = { validUntil: Math.floor(Date.now() / 1000) + 360, messages: [{ address: MASTER_TON_WALLET, amount: nanoTonAmount }] };
        try {
            this.showToast('Abriendo pasarela TON... 💎');
            const result = await this.tonConnectUI.sendTransaction(transaction);
            if (result && result.boc) {
                this.showToast('Procesando recarga en el servidor... ⏳');
                const res = await fetch(`${this.backendUrl}/wallet/recharge`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: this.userId, amount_ton: priceTon, alpha_added: alphaTotal, boc: result.boc })
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    this.haptic('heavy'); 
                    this.showToast(`¡Recarga exitosa! +${alphaTotal} $ALPHA 💎`);
                    setTimeout(async () => {
                        await this.syncKYCStatus(); 
                        await this.refreshUserData();
                        let finalLevel = targetLevel !== null ? targetLevel : this.userData.access_tier;
                        if (finalLevel > this.userData.access_tier) this.showLevelUpAnimation(finalLevel);
                    }, 1500);
                    this.closeModals();
                } else { throw new Error(data.detail || 'Error validando la recarga en el servidor'); }
            }
        } catch (error) { this.showToast('⚠️ Transacción cancelada o fallida.'); }
    },

    async openCatalogPackages() {
        this.closeModals();
        const modal = document.getElementById('modal-catalog');
        if (!modal) return;
        modal.classList.remove('hidden');
        const container = document.getElementById('catalog-packages-list');
        if (!container) return;
        
        container.innerHTML = `<div class="text-center text-neutral-400 mt-10 font-bold">${this.getTrans('cat_loading') || 'Cargando catálogo... ⏳'}</div>`;
        try {
            const res = await fetch(`${this.backendUrl}/payments/packages`);
            if (res.ok) {
                const data = await res.json();
                let packages = data.packages || [];
                const order = ['spy', 'soldier', 'veteran', 'legend', 'icon-legend'];
                packages.forEach(p => p.slug = p.slug.replace('_', '-'));
                packages.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
                const rankMapping = { 'spy': 0, 'soldier': 1, 'veteran': 2, 'legend': 3, 'icon-legend': 4 };

                container.innerHTML = packages.map(pkg => {
                    const level = rankMapping[pkg.slug] !== undefined ? rankMapping[pkg.slug] : 0;
                    const badgeInfo = this.getRankBadge(level);
                    const tagLabel = this.getTrans('cat_official_rank') || 'RANGO OFICIAL';
                    const descLabel = this.getTrans(`pkg_${pkg.slug.replace('-', '_')}_desc`) || `Membresía oficial ${badgeInfo.name}. Acceso a beneficios tácticos en el Búnker.`;
                    
                    return `
                        <div class="bg-black border-2 ${level === 4 ? 'border-[#ffb703] shadow-[0_0_18px_rgba(255,183,3,0.3)]' : level === 3 ? 'border-[#ff00ff] shadow-[0_0_12px_rgba(255,0,255,0.2)]' : 'border-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.2)]'} rounded-2xl p-5 relative mt-4">
                            <div class="absolute -top-4 right-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-4 py-1 rounded-full text-xs font-black uppercase shadow-lg tracking-widest">${tagLabel}</div>
                            <div class="flex justify-between items-center mb-2 mt-2">
                                <h3 class="text-xl font-black text-white flex items-center gap-3">
                                    <div class="relative inline-flex w-10 h-10 items-center justify-center">
                                        <div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[10px] opacity-80"></div>
                                        <img src="${badgeInfo.img}" style="mix-blend-mode: screen; -webkit-mix-blend-mode: screen;" class="relative w-full h-full object-contain" onerror="this.src='./assets/badge_0.png'"> 
                                    </div>
                                    <span class="drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">${badgeInfo.name}</span>
                                </h3>
                                <span class="text-xl font-black text-[#ffb703]">${pkg.alpha_total} $ALPHA</span>
                            </div>
                            <p class="text-sm text-gray-300 mb-4 font-medium">${descLabel}</p>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="app.buyPackageStars('${pkg.slug}', ${level})" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">⭐ ${pkg.price_stars}</button>
                                <button onclick="app.rechargeAlphaCoins(${pkg.price_ton}, ${pkg.alpha_total}, ${level})" class="w-full bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-cyan-500/30 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md transition">💎 ${pkg.price_ton} TON</button>
                                <button onclick="app.openExternalCheckout('${pkg.slug}')" class="w-full col-span-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md transition mt-1">
                                    <i class="fa-solid fa-money-bill-transfer"></i> ${this.getTrans('btn_external_checkout') || 'FONDEO ACH / CRIPTO EXTERNO'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) { container.innerHTML = `<div class="text-center text-red-400 mt-10 font-bold">${this.getTrans('cat_error')}</div>`; }
    },

    openExternalCheckout(packageSlug) {
        this.closeModals();
        if (!packageSlug || typeof packageSlug !== 'string') return;
        const safeSlug = encodeURIComponent(packageSlug.replace(/[^a-zA-Z0-9_-]/g, ''));
        this.currentCheckoutPackage = safeSlug;
        
        let modal = document.getElementById('modal-external-checkout');
        if (!modal) {
            const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const tTitle   = esc(this.getTrans('tactical_recharge'));
            const lSkrill  = esc(this.getTrans('btn_pay_skrill'));
            const lBinance = esc(this.getTrans('btn_pay_binance'));
            const lPayoneer= esc(this.getTrans('btn_pay_payoneer'));
            const lManual  = esc(this.getTrans('btn_pay_manual'));

            const modalHTML = `
                <div id="modal-external-checkout" class="fixed inset-0 z-[200] bg-black bg-opacity-95 backdrop-blur-md flex justify-center items-center p-4 hidden">
                    <div class="glass-panel border-2 border-[#00f3ff] shadow-[0_0_25px_rgba(0,243,255,0.3)] rounded-3xl p-6 w-full max-w-md text-white relative max-h-[90vh] overflow-y-auto">
                        <button onclick="app.closeCheckout()" class="absolute top-4 right-4 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition shadow-[0_0_10px_red]"><i class="fa-solid fa-times"></i></button>
                        <h2 class="text-2xl font-black text-center mb-2 text-[#00f3ff] uppercase tracking-wider">${tTitle}</h2>
                        <div class="space-y-3 mt-4">
                            <button onclick="app.processOneClickPay('skrill')" class="w-full bg-black border-2 border-[#ff00ff] text-[#ff00ff] font-black py-3.5 rounded-xl uppercase flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(255,0,255,0.6)] transition hover:bg-[#ff00ff]/20 active:scale-95"><i class="fa-solid fa-wallet text-xl"></i> ${lSkrill}</button>
                            <button onclick="app.processOneClickPay('binance')" class="w-full bg-black border-2 border-[#f3ba2f] text-[#f3ba2f] font-black py-3.5 rounded-xl uppercase flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(243,186,47,0.6)] transition hover:bg-[#f3ba2f]/20 active:scale-95"><i class="fa-brands fa-bitcoin text-xl"></i> ${lBinance}</button>
                            <button onclick="app.processOneClickPay('payoneer')" class="w-full bg-black border-2 border-[#ff4800] text-[#ff4800] font-black py-3.5 rounded-xl uppercase flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(255,72,0,0.6)] transition hover:bg-[#ff4800]/20 active:scale-95"><i class="fa-brands fa-paypal text-xl"></i> ${lPayoneer}</button>
                            <div class="w-full mt-2 pt-2 border-t border-[#00f3ff]/30">
                                <button onclick="app.openManualPayment()" class="w-full bg-black border-2 border-[#00f3ff] text-[#00f3ff] font-black py-3.5 rounded-xl uppercase flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(0,243,255,0.6)] transition hover:bg-[#00f3ff]/20 active:scale-95"><i class="fa-solid fa-building-columns text-xl"></i> ${lManual}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-external-checkout');
        }
        modal.classList.remove('hidden');
    },

    processOneClickPay(gateway) {
        if (!this.currentCheckoutPackage) { this.showToast('⚠️ Selecciona un plan primero.'); return; }
        const paymentLinks = {
            skrill: { 'soldier': 'https://skrill.me/rq/Felipe%20Rafael/4.99/USD?key=7AR7OlqodIdbV_WU4hSXJ435Na1', 'veteran': 'https://skrill.me/rq/Felipe%20Rafael/10.99/USD?key=Z06Cz-iVWCYDSILhZWO6R_qkLk_', 'legend': 'https://skrill.me/rq/Felipe%20Rafael/25/USD?key=6bBEAZr3PQhwTGbf_jW6yhRLknf', 'icon-legend': 'https://skrill.me/rq/Felipe%20Rafael/53/USD?key=hzBmtkvlrYlvYcH3MTpcQXQ_HG-' },
            binance: { 'soldier': 'https://app.binance.com/uni-qr/request-to-pay?billOrderId=452405181270605824&billType=request_a_payment', 'veteran': 'https://app.binance.com/uni-qr/request-to-pay?billOrderId=452405438875680768&billType=request_a_payment', 'legend': 'https://app.binance.com/uni-qr/request-to-pay?billOrderId=452405771899920384&billType=request_a_payment', 'icon-legend': 'https://app.binance.com/uni-qr/request-to-pay?billOrderId=452406167061315584&billType=request_a_payment' },
            payoneer: { 'legend': 'https://link.payoneer.com/Token?t=569B904EC3D94618B6563B0574CF479F&src=mobile', 'icon-legend': 'https://link.payoneer.com/Token?t=FA9D867359624921B264A059D1ADA74F&src=mobile' }
        };
        const targetUrl = paymentLinks[gateway] ? paymentLinks[gateway][this.currentCheckoutPackage] : null;
        if (!targetUrl) { this.showToast(this.getTrans('toast_gateway_unsupported')); return; }
        this.haptic('heavy');
        this.showToast('Redirigiendo a pasarela...');
        setTimeout(() => { window.open(targetUrl, '_blank', 'noopener,noreferrer'); this.closeCheckout(); }, 1500);
    },

    openManualPayment() {
        this.closeModals();
        let modal = document.getElementById('modal-manual-payment');
        if (!modal) {
            const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const title   = esc(this.getTrans('manual_payment_title'));
            const desc    = esc(this.getTrans('manual_payment_desc'));
            const btnBack = esc(this.getTrans('btn_cancel'));
            
            const modalHTML = `
                <div id="modal-manual-payment" class="fixed inset-0 z-[200] bg-black bg-opacity-95 backdrop-blur-md flex justify-center items-center p-4 hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] shadow-[0_0_25px_rgba(0,243,255,0.3)] rounded-3xl p-6 w-full max-w-md text-white relative">
                        <button onclick="document.getElementById('modal-manual-payment').classList.add('hidden')" class="absolute top-4 right-4 text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        <h2 class="text-xl font-black text-[#00f3ff] mb-4 uppercase tracking-wider text-center">${title}</h2>
                        <p class="text-xs text-neutral-300 text-center mb-6">${desc}</p>
                        <div class="bg-black border border-neutral-700 rounded-xl p-4 space-y-3 text-xs font-mono">
                            <p class="flex justify-between border-b border-neutral-800 pb-2"><span class="text-neutral-500">Bank:</span><strong class="text-white">Lead Bank</strong></p>
                            <p class="flex justify-between border-b border-neutral-800 pb-2"><span class="text-neutral-500">Account Name:</span><strong class="text-white text-right max-w-[150px] truncate" title="FELIPE RAFAEL SANCHEZ PIÑEROS">FELIPE R. SANCHEZ P.</strong></p>
                            <div class="flex justify-between items-center border-b border-neutral-800 pb-2">
                                <span class="text-neutral-500">Account Number:</span>
                                <div class="flex items-center gap-3">
                                    <strong class="text-[#ffb703] text-sm tracking-widest">215069784455</strong>
                                    <button onclick="app.copyText('215069784455')" class="text-[#00f3ff] text-lg hover:scale-110 transition active:scale-95 p-1"><i class="fa-regular fa-copy"></i></button>
                                </div>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-neutral-500">Routing Number:</span>
                                <div class="flex items-center gap-3">
                                    <strong class="text-[#ffb703] text-sm tracking-widest">101019644</strong>
                                    <button onclick="app.copyText('101019644')" class="text-[#00f3ff] text-lg hover:scale-110 transition active:scale-95 p-1"><i class="fa-regular fa-copy"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="mt-6"><button onclick="document.getElementById('modal-manual-payment').classList.add('hidden')" class="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black py-3 rounded-xl uppercase transition">${btnBack}</button></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-manual-payment');
        }
        modal.classList.remove('hidden');
    },

    closeCheckout() {
        this.haptic('light');
        document.getElementById('modal-external-checkout')?.classList.add('hidden');
        document.getElementById('checkoutModal')?.classList.add('hidden');
    },

    triggerGlobalMediaUpload(acceptType) {
        document.getElementById('global-media-menu')?.classList.add('hidden');
        const fileInput = document.getElementById('global-media-upload');
        if (fileInput) { fileInput.accept = acceptType; fileInput.click(); }
    },

    async startGlobalSelfieCam() {
        document.getElementById('global-media-menu')?.classList.add('hidden');
        this.haptic('medium');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            let mediaRecorder; let chunks = [];
            try { mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' }); } catch (e) { mediaRecorder = new MediaRecorder(stream); }
            this.showToast('Grabando selfie...');
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.tempChatMediaData = e.target.result;
                    const previewContainer = document.getElementById('global-chat-preview-container');
                    if (previewContainer) previewContainer.classList.remove('hidden');
                    this.showToast('Selfie lista 📸');
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            setTimeout(() => { if (mediaRecorder.state === 'recording') { mediaRecorder.stop(); } }, 5000);
        } catch (err) { this.showToast('Error de cámara'); }
    },
    
    async startAudioRecorder(type) {
        if (type === 'global') { this.showToast('🚫 Notas de voz desactivadas en el Chat Global.'); return; }
        document.getElementById('global-media-menu')?.classList.add('hidden');
        this.haptic('medium');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mediaRecorder; let chunks = [];
            try { mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); } catch (e) { mediaRecorder = new MediaRecorder(stream); }
            this.showToast('🎙️ Grabando...');
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.tempChatMediaData = e.target.result;
                    const previewContainer = document.getElementById(`${type}-chat-preview-container`);
                    if (previewContainer) previewContainer.classList.remove('hidden');
                    this.showToast('Audio listo');
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            setTimeout(() => { if (mediaRecorder.state === 'recording') { mediaRecorder.stop(); } }, 15000); 
        } catch (err) { this.showToast('Error de micrófono'); }
    },

    triggerAvatarInput() { 
        this.haptic('light'); 
        document.getElementById('avatar-file-input')?.click(); 
    },
    
    async handleAvatarChange(event) {
        const file = event.target.files[0]; 
        if (!file) return;
        this.haptic('light'); 
        this.showToast('Optimizando foto...');
        const avatarUrl = await this.compressImage(file, 400, 0.8);
        localStorage.setItem('alpha_user_avatar', avatarUrl);
        const avatarImg = document.getElementById('prof-avatar-img'), avatarFeed = document.getElementById('avatar-feed');
        if (avatarImg) { avatarImg.src = avatarUrl; avatarImg.classList.remove('hidden'); }
        if (avatarFeed) avatarFeed.src = avatarUrl;
        try { await fetch(`${this.backendUrl}/users/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, name: this.userData.name, avatar: avatarUrl }) }); } catch(e) {}
        this.showToast('Avatar actualizado');
    },

    async saveProfile() {
        this.haptic('medium');
        const aliasInput = document.getElementById('prof-alias'), bioInput = document.getElementById('prof-bio');
        const newName = aliasInput ? aliasInput.value.trim() : '', newBio = bioInput ? bioInput.value.trim() : '';
        if (newName) { this.userData.name = newName; localStorage.setItem('alpha_user_name', newName); }
        if (newBio) { localStorage.setItem('alpha_user_bio', newBio); }
        try {
            await fetch(`${this.backendUrl}/users/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, name: newName, bio: newBio, avatar: localStorage.getItem('alpha_user_avatar') }) });
        } catch(e) {}
        this.showToast('Perfil guardado'); 
        this.updateProfileUI();
    },

    openKYCModal() { 
        this.closeModals(); 
        document.getElementById('modal-kyc')?.classList.remove('hidden'); 
    },

    async handleKYCDocPreview(event) {
        const file = event.target.files[0]; 
        if (!file) return;
        this.tempKYCDoc = await this.compressImage(file, 1200, 0.75);
    },

    async handleKYCSelfiePreview(event) {
        const file = event.target.files[0]; 
        if (!file) return;
        this.tempKYCSelfie = await this.compressImage(file, 1024, 0.75);
    },

    async submitKYC() {
        this.haptic('medium');
        const legalName = document.getElementById('kyc-legal-name')?.value.trim();
        if (!legalName || !this.tempKYCDoc || !this.tempKYCSelfie) { this.showToast('Completa los campos KYC'); return; }
        this.initUserId(); 
        this.showToast('Enviando KYC...');
        try {
            const res = await fetch(`${this.backendUrl}/kyc/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, legal_name: legalName, document_base64: this.tempKYCDoc, selfie_base64: this.tempKYCSelfie }) });
            if (res.ok) { localStorage.setItem('alpha_kyc_status', 'pending'); this.showToast('KYC enviado'); this.closeModals(); this.updateProfileUI(); }
        } catch (err) {}
    },

    setRegisterRole(role) {
        this.haptic('light'); 
        this.registerRoleSelected = role;
        const btnFan = document.getElementById('reg-role-fan'), btnCreator = document.getElementById('reg-role-creator');
        if (role === 'fan') {
            btnFan?.classList.replace('border-neutral-700', 'border-[#ff00ff]'); btnFan?.classList.replace('bg-black', 'bg-[#ff00ff]/20'); btnFan?.classList.replace('text-neutral-400', 'text-white');
            btnCreator?.classList.replace('border-[#00f3ff]', 'border-neutral-700'); btnCreator?.classList.replace('bg-[#00f3ff]/20', 'bg-black'); btnCreator?.classList.replace('text-white', 'text-neutral-400');
        } else {
            btnCreator?.classList.replace('border-neutral-700', 'border-[#00f3ff]'); btnCreator?.classList.replace('bg-black', 'bg-[#00f3ff]/20'); btnCreator?.classList.replace('text-white', 'text-neutral-400');
            btnFan?.classList.replace('border-[#ff00ff]', 'border-neutral-700'); btnFan?.classList.replace('bg-[#ff00ff]/20', 'bg-black'); btnFan?.classList.replace('text-white', 'text-neutral-400');
        }
    },

    // 🛡️ RESTRICCIÓN DE NÚMERO DE TELÉFONO EN EL REGISTRO
    registerWithData() {
        this.haptic('medium');
        const email = document.getElementById('reg-email-input')?.value.trim(), phone = document.getElementById('reg-phone-input')?.value.trim();
        if (!phone && !email) { this.showToast('Ingresa teléfono o email'); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        const isCreator = this.registerRoleSelected === 'creator';
        this.userData.role = this.registerRoleSelected; 
        
        // Bloquear uso de número de teléfono como Alias
        let finalName = existingName;
        if (!finalName || finalName === 'USER' || finalName.startsWith('Tel:') || finalName.startsWith('+')) {
            finalName = email ? email.split('@')[0] : (isCreator ? "mastertom" : "VIP Fan");
        }
        
        this.userData.name = finalName;
        localStorage.setItem('alpha_user_name', finalName); 
        localStorage.setItem('alpha_logged_in', 'true'); 
        localStorage.setItem('alpha_user_role', this.registerRoleSelected);
        
        this.switchView('feed'); 
        this.syncKYCStatus(); 
        this.updateProfileUI(); 
        this.updateViewsCounter(); 
        this.refreshUserData(); 
        this.renderFeed();
    },

    async loginWithPhone() {
        this.haptic('medium'); 
        const phone = document.getElementById('phone-input')?.value.trim();
        if (!phone) { this.showToast('Ingresa tu teléfono'); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        
        // Bloquear uso de número de teléfono
        let finalName = existingName;
        if (!finalName || finalName === 'USER' || finalName.startsWith('Tel:') || finalName.startsWith('+')) {
            finalName = "VIP Fan";
        }
        this.userData.name = finalName;
        localStorage.setItem('alpha_user_name', finalName);
        
        this.switchView('feed'); 
        await this.syncKYCStatus(); 
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
            const initData = window.Telegram?.WebApp?.initData || "";
            const res = await fetch(`${this.backendUrl}/users/sync`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ user_id: this.userId, name: localStorage.getItem('alpha_user_name') || 'Agente Búnker', bio: 'Operativo', avatar: localStorage.getItem('alpha_user_avatar'), init_data: initData, is_telegram: !!initData }) 
            }); 
            const data = await res.json();
            if(res.ok && data.user) {
                if(data.user.avatar_url) localStorage.setItem('alpha_user_avatar', data.user.avatar_url);
                if(data.user.bio) localStorage.setItem('alpha_user_bio', data.user.bio);
                if(data.user.name) localStorage.setItem('alpha_user_name', data.user.name);
            }
        } catch (e) {}
        this.switchView('feed'); 
        this.updateProfileUI(); 
        this.updateViewsCounter(); 
        await this.syncKYCStatus(); 
        this.refreshUserData(); 
        this.renderFeed();
    },

    exitApp() { if (window.Telegram?.WebApp) window.Telegram.WebApp.close(); },

    logout() { 
        this.haptic('medium'); 
        ['alpha_logged_in', 'alpha_user_name', 'alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        this.userData = { name: 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.userId = null; 
        this.switchView('consent'); 
    },

    setupSystemMessageObserver(containerId) {
        const container = document.getElementById(containerId);
        if (!container || container.dataset.observed === 'true') return;
        container.dataset.observed = 'true';
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (!node.innerHTML.includes('bg-[#00f3ff]/20') && !node.innerHTML.includes('bg-neutral-800')) {
                            setTimeout(() => { node.style.transition = 'all 0.4s ease'; node.style.opacity = '0'; node.style.height = '0px'; node.style.margin = '0px'; node.style.padding = '0px'; node.style.overflow = 'hidden'; setTimeout(() => node.remove(), 400); }, 1500); 
                        }
                    }
                });
            });
        });
        observer.observe(container, { childList: true });
    },
    
    async openSupport() { 
        this.closeModals(); 
        document.getElementById('modal-chat')?.classList.remove('hidden'); 
        this.setupSystemMessageObserver('chat-messages'); 
        await this.loadChatHistory(); 
        BunkerChat.initCRM(this.userId, this.backendUrl); 
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
                } 
            } 
        } catch (err) {} 
    },
    
    async openGlobalChat() { 
        this.closeModals(); 
        document.getElementById('modal-global-chat')?.classList.remove('hidden'); 
        this.updateOnlineUsersRadar();
        this.setupSystemMessageObserver('global-chat-messages'); 
        await this.loadGlobalChatHistory(); 
        BunkerChat.initGlobal(this.userId, this.backendUrl); 
    },

    handleRadarUpdate(data) {
        const chipsChat = document.getElementById('online-users-chips');
        const chipsVideo = document.getElementById('bunker-video-active-members');
        const counter = document.getElementById('views-counter');
        const safeName = this.escapeHtml(data.name);
        const chipIdChat = `radar-chat-${data.user_id}`;
        const chipIdVideo = `radar-video-${data.user_id}`;
        
        if (data.status === 'offline') {
            document.getElementById(chipIdChat)?.remove();
            document.getElementById(chipIdVideo)?.remove();
            this.closePeerConnection(data.user_id);
        } else {
            if (chipsChat && !document.getElementById(chipIdChat)) {
                chipsChat.insertAdjacentHTML('beforeend', `<div id="${chipIdChat}" onclick="app.viewCreatorProfile(${data.user_id}, '${safeName}')" class="flex items-center gap-1 bg-black px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 truncate cursor-pointer hover:bg-neutral-800 transition"><i class="fa-solid fa-circle text-[4px] neon-green-dot"></i> @${safeName}</div>`);
            }
            if (data.status === 'live' && chipsVideo && !document.getElementById(chipIdVideo)) {
                chipsVideo.insertAdjacentHTML('beforeend', `<div id="${chipIdVideo}" onclick="app.viewCreatorProfile(${data.user_id}, '${safeName}')" class="flex items-center gap-1 bg-neutral-900 px-1.5 py-1 rounded border border-neutral-700 truncate cursor-pointer hover:bg-neutral-800 transition"><i class="fa-solid fa-circle text-[4px] text-amber-500 animate-pulse"></i> @${safeName}</div>`);
            }
        }
        if (counter && chipsChat) {
            counter.innerText = Math.max(1, chipsChat.children.length).toString();
        }

        if (this.activeWebcamStream && data.status === 'live' && data.user_id != this.userId) {
            if (parseInt(this.userId) < parseInt(data.user_id)) {
                this.sendWebRTCOffer(data.user_id);
            }
        }
    },
    
    updateOnlineUsersRadar() {
        const userName = localStorage.getItem('alpha_user_name') || 'mastertom';
        this.handleRadarUpdate({ user_id: this.userId, name: userName, status: 'online' });
        if (typeof BunkerChat !== 'undefined' && BunkerChat.globalSocket && BunkerChat.globalSocket.readyState === 1) {
            BunkerChat.sendGlobal(JSON.stringify({ type: "radar_update", user_id: this.userId, name: userName, status: "online" }));
        }
    },

    async joinVideoBunker() {
        this.haptic('medium'); 
        this.initUserId();
        const isAdminUser = this.isAdminUser(), userTier = this.userData?.access_tier || 0;
        if (userTier < 4 && !isAdminUser) { this.showToast('Requiere Icon Legend'); this.openCatalogPackages(); return; }
        const bunker = document.getElementById('floating-video-bunker'), placeholder = document.getElementById('cam-loading-placeholder'), badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live');
        if(bunker) { 
            bunker.classList.remove('hidden'); 
            this.isVideoMinimized = false; 
            bunker.className = 'fixed inset-0 z-[200] bg-[#050505] flex flex-col h-screen w-screen overflow-hidden transition-all duration-300'; 
            document.getElementById('video-controls-bar')?.classList.remove('hidden'); 
            const iconMin = document.getElementById('icon-minimize');
            if(iconMin) iconMin.className = 'fa-solid fa-compress'; 
        }
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded shadow-md uppercase'; badge.innerText = 'PREVISUALIZACIÓN'; }
        if(btnGoLive) btnGoLive.classList.remove('hidden');
        if(placeholder) { placeholder.innerHTML = `<i class="fa-solid fa-lock-open text-4xl text-neutral-600 mb-2 animate-bounce"></i>`; placeholder.classList.remove('hidden'); }
        await this.requestAndLoadMedia();
        this.updateOnlineUsersRadar(); 
    },
    
    updateOnlineUsersRadar() {
        const userName = localStorage.getItem('alpha_user_name') || 'mastertom';
        this.handleRadarUpdate({ user_id: this.userId, name: userName, status: 'online' });
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
                } 
            } 
        } catch (e) {} 
    },

    async sendWebRTCOffer(targetId) {
        try {
            const pc = this.createPeerConnection(targetId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            BunkerChat.sendGlobal(JSON.stringify({ type: 'webrtc_offer', target_id: targetId, sdp: offer.sdp }));
        } catch(e) {}
    },

    async handleWebRTCMessage(data) {
        const { type, caller_id, sdp, candidate } = data;
        if (!this.activeWebcamStream) return; 
        try {
            if (type === 'webrtc_offer') {
                const pc = this.createPeerConnection(caller_id);
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                BunkerChat.sendGlobal(JSON.stringify({ type: 'webrtc_answer', target_id: caller_id, sdp: answer.sdp }));
            } else if (type === 'webrtc_answer') {
                const pc = this.peerConnections[caller_id];
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
            } else if (type === 'webrtc_ice') {
                const pc = this.peerConnections[caller_id];
                if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch(e) {}
    },

    createPeerConnection(targetId) {
        if (this.peerConnections[targetId]) return this.peerConnections[targetId];
        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections[targetId] = pc;
        if (this.activeWebcamStream) {
            this.activeWebcamStream.getTracks().forEach(track => pc.addTrack(track, this.activeWebcamStream));
        }
        pc.onicecandidate = (e) => {
            if (e.candidate) BunkerChat.sendGlobal(JSON.stringify({ type: 'webrtc_ice', target_id: targetId, candidate: e.candidate }));
        };
        pc.ontrack = (e) => {
            if (!this.remoteStreams[targetId]) {
                this.remoteStreams[targetId] = new MediaStream();
                const videoContainer = document.getElementById('bunker-video-grid') || this.createVideoGrid();
                const vidEl = document.createElement('video');
                vidEl.id = `remote-video-${targetId}`;
                vidEl.autoplay = true; 
                vidEl.playsInline = true;
                vidEl.className = 'w-full h-full object-cover border-2 border-[#ff00ff] rounded-xl shadow-lg';
                vidEl.srcObject = this.remoteStreams[targetId];
                const wrapper = document.createElement('div');
                wrapper.className = 'relative flex-1 min-w-[45%] max-w-[50%] max-h-full';
                wrapper.appendChild(vidEl);
                videoContainer.appendChild(wrapper);
            }
            this.remoteStreams[targetId].addTrack(e.track);
        };
        return pc;
    },

    createVideoGrid() {
        const feed = document.getElementById('bunker-webcam-feed');
        feed.className = 'w-full h-full object-cover border-2 border-[#00f3ff] rounded-xl shadow-lg';
        let grid = document.getElementById('bunker-video-grid');
        if (!grid) {
            const container = feed.parentElement;
            container.classList.remove('justify-center');
            container.classList.add('flex-wrap', 'gap-2', 'p-2', 'content-start', 'overflow-y-auto');
            grid = document.createElement('div');
            grid.id = 'bunker-video-grid';
            grid.className = 'flex flex-wrap w-full h-full gap-2 justify-center content-start';
            const wrapper = document.createElement('div');
            wrapper.className = 'relative flex-1 min-w-[45%] max-w-[50%] max-h-full';
            wrapper.appendChild(feed);
            container.appendChild(grid);
            grid.appendChild(wrapper); 
        }
        return grid;
    },

    closePeerConnection(targetId) {
        if (this.peerConnections[targetId]) { this.peerConnections[targetId].close(); delete this.peerConnections[targetId]; }
        if (this.remoteStreams[targetId]) delete this.remoteStreams[targetId];
        const vidEl = document.getElementById(`remote-video-${targetId}`);
        if (vidEl && vidEl.parentElement) vidEl.parentElement.remove();
    },

    async handleChatMediaPreview(event, type) {
        document.getElementById('global-media-menu')?.classList.add('hidden');
        const file = event.target.files[0]; 
        if (!file) return;
        this.initUserId();
        const isAdminUser = this.isAdminUser(), isCreator = this.userData?.role === 'creator', userTier = this.userData?.access_tier || 0;
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        
        if (type === 'global' && !isAdminUser && !isCreator) {
            if (userTier < 2) { this.showToast('Requiere Veteran'); return; }
            if (isVideo && userTier < 3) { this.showToast('Requiere Legend'); return; }
        }
        
        this.haptic('light'); 
        const inputEl = type === 'global' ? document.getElementById('global-chat-input') : document.getElementById('chat-input');
        const previewContainer = document.getElementById(`${type}-chat-preview-container`);
        const previewImg = document.getElementById(`${type}-chat-preview-img`);
        const previewVideo = document.getElementById(`${type}-chat-preview-video`);
        const previewName = document.getElementById(`${type}-chat-preview-name`);
        
        if (isVideo) {
            if (file.size > 5 * 1024 * 1024) { this.showToast('Video muy pesado'); this.clearChatMedia(type); return; }
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                this.tempChatMediaData = e.target.result; 
                if (previewContainer) { 
                    previewContainer.classList.remove('hidden'); 
                    if(previewImg) previewImg.classList.add('hidden'); 
                    if(previewVideo) { previewVideo.src = e.target.result; previewVideo.classList.remove('hidden'); }
                    if(previewName) previewName.innerText = `Video adjunto`; 
                } 
                if (inputEl) inputEl.focus(); 
                this.showToast('Video adjunto'); 
            }; 
            reader.readAsDataURL(file);
        } else if (isAudio) {
            if (file.size > 2 * 1024 * 1024) { this.showToast('Audio muy pesado'); this.clearChatMedia(type); return; }
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                this.tempChatMediaData = e.target.result; 
                if (previewContainer) { 
                    previewContainer.classList.remove('hidden'); 
                    if(previewImg) previewImg.classList.add('hidden'); 
                    if(previewVideo) { previewVideo.src = ""; previewVideo.classList.add('hidden'); }
                    if(previewName) previewName.innerHTML = `Audio adjunto`; 
                } 
                if (inputEl) inputEl.focus(); 
                this.showToast('Audio adjunto'); 
            }; 
            reader.readAsDataURL(file);
        } else {
            this.tempChatMediaData = await this.compressImage(file, 800, 0.7); 
            if (previewContainer) { 
                previewContainer.classList.remove('hidden'); 
                if(previewVideo) { previewVideo.classList.add('hidden'); previewVideo.src = ""; }
                if(previewImg) { previewImg.src = this.tempChatMediaData; previewImg.classList.remove('hidden'); }
                if(previewName) previewName.innerText = `Foto adjunta`; 
            } 
            if (inputEl) inputEl.focus(); 
            this.showToast('Foto adjunta');
        }
    },

    clearChatMedia(type) {
        this.haptic('light'); 
        this.tempChatMediaData = null;
        const uploadInput = document.getElementById(`${type}-media-upload`), previewContainer = document.getElementById(`${type}-chat-preview-container`), previewImg = document.getElementById(`${type}-chat-preview-img`), previewVideo = document.getElementById(`${type}-chat-preview-video`);
        if (uploadInput) uploadInput.value = ''; 
        if (previewContainer) previewContainer.classList.add('hidden'); 
        if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); } 
        if (previewVideo) { previewVideo.src = ''; previewVideo.classList.add('hidden'); }
    },

    async deleteChatMessage(msgId, btnElement, realMsgId) {
        this.haptic('medium');
        if(confirm('¿Eliminar mensaje?')) {
            try {
                if (realMsgId) {
                    await fetch(`${this.backendUrl}/chat/delete_message`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: this.userId, msg_id: realMsgId })
                    });
                }
                const bubble = btnElement.closest('.flex-col');
                if(bubble) {
                    bubble.style.transition = 'all 0.3s ease'; 
                    bubble.style.opacity = '0'; 
                    bubble.style.height = '0px';
                    setTimeout(() => bubble.remove(), 300);
                }
                this.showToast('Mensaje eliminado');
            } catch(e) {}
        }
    },

    reportChatMessage(msgId, btnElement) {
        this.haptic('light');
        document.getElementById(`media-menu-${msgId}`)?.classList.add('hidden');
        this.showToast('Reportado');
    },

    appendChatMessage(msg, containerId) {
        const container = document.getElementById(containerId); 
        if (!container) return;
        const isMe = msg.user_id == this.userId;
        const isAdminUser = this.isAdminUser();
        const rankInfo = this.getRankBadge(msg.access_level);
        let contentObj = { text: msg.content, media_url: null };
        try { const parsed = JSON.parse(msg.content); if(parsed.text !== undefined) contentObj = parsed; } catch(e) {}
        let safeText = this.escapeHtml(contentObj.text || ''), safeMedia = '';
        
        if (contentObj.media_url) {
            const encodedUrl = encodeURI(this.sanitizeUrl(contentObj.media_url));
            if (encodedUrl) {
                const uniqueId = msg.id || Math.random().toString(36).substr(2,9);
                const isOwner = msg.user_id == this.userId;
                let menuHtml = `<div class="absolute top-2 right-2 z-10" onclick="event.stopPropagation();"><button onclick="document.getElementById('media-menu-${uniqueId}').classList.toggle('hidden')" class="bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-ellipsis-vertical"></i></button><div id="media-menu-${uniqueId}" class="hidden absolute right-0 mt-2 w-36 bg-neutral-900 border border-neutral-700 rounded-xl shadow-lg overflow-hidden flex flex-col z-20">${(isOwner || isAdminUser) ? `<button onclick="app.deleteChatMessage('${uniqueId}', this, ${msg.id})" class="px-4 py-3 text-xs font-black text-red-400 hover:bg-neutral-800 text-left w-full border-b border-neutral-800">Eliminar</button>` : ''}</div></div>`;
                if (contentObj.media_url.startsWith('data:video') || contentObj.media_url.includes('.mp4')) { 
                    safeMedia = `<div class="relative mt-2 mb-1 cursor-pointer group" onclick="app.openLightbox('${encodedUrl}', 'video')"><video src="${encodedUrl}" class="rounded-xl w-full max-h-48 object-cover pointer-events-none" autoplay muted loop playsinline></video>${menuHtml}</div>`; 
                } else if (contentObj.media_url.startsWith('data:audio')) {
                    safeMedia = `<div class="relative mt-2 mb-1"><audio src="${encodedUrl}" controls class="w-full h-10 rounded-full" controlsList="nodownload"></audio>${menuHtml}</div>`; 
                } else { 
                    safeMedia = `<div class="relative mt-2 mb-1 cursor-pointer group" onclick="app.openLightbox('${encodedUrl}', 'image')"><img src="${encodedUrl}" class="rounded-xl w-full max-h-48 object-cover pointer-events-none" />${menuHtml}</div>`; 
                }
            }
        }

        const safeAuthorName = this.escapeHtml(msg.author_name);
        let html = '';
        if (msg.is_system) {
            const msgId = `sys-msg-${msg.id || Date.now()}`;
            html = `<div id="${msgId}" class="flex flex-col items-center my-2"><div class="bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] px-4 py-1.5 rounded-full font-black text-center"><i class="fa-solid fa-bolt mr-1"></i> ${safeText}</div></div>`;
            setTimeout(() => { const el = document.getElementById(msgId); if(el) el.remove(); }, 3000);
        } else if (isMe) {
            html = `<div class="flex flex-col items-end my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold mr-1">Tú • ${rankInfo.name}</span><div class="bg-[#00f3ff]/20 text-white text-sm p-3 rounded-2xl border border-[#00f3ff]/50 max-w-[85%]">${safeText}${safeMedia}</div></div>`;
        } else {
            html = `<div class="flex flex-col items-start my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold ml-1"><span class="text-[#00f3ff] font-black cursor-pointer hover:underline" onclick="app.viewCreatorProfile(${msg.user_id}, '${safeAuthorName}')">@${safeAuthorName}</span> • ${rankInfo.name}</span><div class="bg-neutral-800 text-white text-sm p-3 rounded-2xl border border-neutral-700 max-w-[85%]">${safeText}${safeMedia}</div></div>`;
        }
        container.insertAdjacentHTML('beforeend', html);
    },

    openLightbox(mediaUrl, type) {
        this.haptic('light'); 
        const modal = document.getElementById('media-lightbox-modal');
        const imgEl = document.getElementById('lightbox-img'); 
        const videoEl = document.getElementById('lightbox-video');
        if (!modal) return; 
        modal.classList.remove('hidden');
        if (type === 'image') { 
            if(videoEl) { videoEl.classList.add('hidden'); videoEl.pause(); }
            if(imgEl) { imgEl.src = mediaUrl; imgEl.classList.remove('hidden'); }
        } else { 
            if(imgEl) imgEl.classList.add('hidden'); 
            if(videoEl) { videoEl.src = mediaUrl; videoEl.classList.remove('hidden'); videoEl.play(); }
        }
    },

    closeLightbox() { 
        this.haptic('light'); 
        const modal = document.getElementById('media-lightbox-modal');
        const videoEl = document.getElementById('lightbox-video'); 
        if (videoEl) videoEl.pause(); 
        if (modal) modal.classList.add('hidden'); 
    },

    scrollToBottom(containerId) { 
        const container = document.getElementById(containerId); 
        if (container) container.scrollTop = container.scrollHeight; 
    },

    sendChatMessage() { 
        this.haptic('light'); 
        const input = document.getElementById('chat-input'); 
        const text = input ? input.value.trim() : '';
        if (!text && !this.tempChatMediaData) return;
        const payload = JSON.stringify({ text: text, media_url: this.tempChatMediaData });
        if (BunkerChat.sendCRM(payload)) { 
            if (input) { input.value = ''; } 
            this.clearChatMedia('crm'); 
        } else { 
            BunkerChat.initCRM(this.userId, this.backendUrl); 
            setTimeout(() => { 
                BunkerChat.sendCRM(payload); 
                if (input) { input.value = ''; } 
                this.clearChatMedia('crm'); 
            }, 500); 
        }
    },

    sendGlobalChatMessage() {
        this.haptic('light'); 
        this.initUserId();
        const userRole = this.userData?.role || 'fan', kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified', isAdminUser = this.isAdminUser();
        const input = document.getElementById('global-chat-input'); 
        const text = input ? input.value.trim() : '';
        if (!text && !this.tempChatMediaData) return;
        if (userRole === 'creator' && kycStatus !== 'verified' && !isAdminUser) { this.showToast('KYC requerido'); this.openKYCModal(); return; }
        const payload = JSON.stringify({ text: text, media_url: this.tempChatMediaData });
        if(!BunkerChat.globalSocket || BunkerChat.globalSocket.readyState !== 1) { 
            BunkerChat.initGlobal(this.userId, this.backendUrl); 
            setTimeout(() => { 
                if (BunkerChat.globalSocket && BunkerChat.globalSocket.readyState === 1) { 
                    BunkerChat.sendGlobal(payload); 
                    if (input) input.value = ''; 
                    this.clearChatMedia('global'); 
                } 
            }, 1500); 
            return; 
        }
        if (BunkerChat.sendGlobal(payload)) { 
            if (input) input.value = ''; 
            this.clearChatMedia('global'); 
        }
    },

    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },
    handleGlobalChatKeyPress(e) { if (e.key === 'Enter') this.sendGlobalChatMessage(); },

    async joinVideoBunker() {
        this.haptic('medium'); 
        this.initUserId();
        const isAdminUser = this.isAdminUser(), userTier = this.userData?.access_tier || 0;
        if (userTier < 4 && !isAdminUser) { this.showToast('Requiere Icon Legend'); this.openCatalogPackages(); return; }
        const bunker = document.getElementById('floating-video-bunker'), placeholder = document.getElementById('cam-loading-placeholder'), badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live');
        if(bunker) { bunker.classList.remove('hidden'); this.isVideoMinimized = false; bunker.className = 'fixed inset-0 z-[150] bg-[#050505] flex flex-col transition-all duration-300'; document.getElementById('video-controls-bar').classList.remove('hidden'); document.getElementById('icon-minimize').className = 'fa-solid fa-compress'; }
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded shadow-md uppercase'; badge.innerText = 'PREVISUALIZACIÓN'; }
        if(btnGoLive) btnGoLive.classList.remove('hidden');
        if(placeholder) { placeholder.innerHTML = `<i class="fa-solid fa-lock-open text-4xl text-neutral-600 mb-2 animate-bounce"></i>`; placeholder.classList.remove('hidden'); }
        await this.requestAndLoadMedia();
        this.updateOnlineUsersRadar(); 
    },

    async requestAndLoadMedia() {
        try {
            let stream; 
            try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e) { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
            this.activeWebcamStream = stream; 
            this.isMicMuted = false; 
            this.isCamOff = false; 
            this.updateMediaTogglesUI();
            const videoElem = document.getElementById('bunker-webcam-feed'), placeholder = document.getElementById('cam-loading-placeholder');
            if (videoElem) { videoElem.srcObject = this.activeWebcamStream; videoElem.play(); videoElem.classList.remove('hidden'); }
            if (placeholder) { placeholder.classList.add('hidden'); }
            await this.populateMediaDevices(stream);
            if (typeof BunkerChat !== 'undefined') BunkerChat.sendGlobal(JSON.stringify({ type: 'join_video' }));
        } catch (err) {}
    },

    async populateMediaDevices(currentStream) {
        if (!navigator.mediaDevices.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices(), videoDevices = devices.filter(d => d.kind === 'videoinput'), audioDevices = devices.filter(d => d.kind === 'audioinput');
        const selectCam = document.getElementById('setting-cam-source'), selectMic = document.getElementById('setting-mic-source');
        if (selectCam) {
            selectCam.innerHTML = ''; 
            let seen = new Set(), obsFound = false;
            videoDevices.forEach((device, index) => {
                let original = device.label.toLowerCase(), cleanLabel = `Cámara #${index + 1}`;
                if (original.includes('obs') || original.includes('virtual')) { cleanLabel = `🎥 OBS Virtual`; obsFound = true; } 
                else if (original.includes('front')) { cleanLabel = `📱 Frontal`; } 
                else if (original.includes('back')) { cleanLabel = `📱 Trasera`; } 
                else if (device.label) { cleanLabel = device.label; }
                if (!seen.has(cleanLabel)) { seen.add(cleanLabel); const opt = document.createElement('option'); opt.value = device.deviceId; opt.text = cleanLabel; selectCam.appendChild(opt); }
            });
            if(!obsFound) { const optObs = document.createElement('option'); optObs.value = "obs-fallback"; optObs.text = `🎥 Forzar OBS`; selectCam.appendChild(optObs); }
        }
        if (selectMic) {
            selectMic.innerHTML = `<option value="none">🔇 Silenciar</option>`;
            audioDevices.forEach((device, index) => { const opt = document.createElement('option'); opt.value = device.deviceId; opt.text = device.label || `Micrófono #${index + 1}`; selectMic.appendChild(opt); });
        }
    },

    toggleMic() { 
        this.haptic('light'); 
        if (this.activeWebcamStream && this.activeWebcamStream.getAudioTracks().length > 0) { 
            this.isMicMuted = !this.isMicMuted; 
            this.activeWebcamStream.getAudioTracks()[0].enabled = !this.isMicMuted; 
            this.updateMediaTogglesUI(); 
        } 
    },

    toggleCam() { 
        this.haptic('light'); 
        if (this.activeWebcamStream && this.activeWebcamStream.getVideoTracks().length > 0) { 
            this.isCamOff = !this.isCamOff; 
            this.activeWebcamStream.getVideoTracks()[0].enabled = !this.isCamOff; 
            this.updateMediaTogglesUI(); 
        } 
    },

    updateMediaTogglesUI() {
        const btnMic = document.getElementById('btn-toggle-mic'), btnCam = document.getElementById('btn-toggle-cam');
        if(btnMic) { btnMic.innerHTML = this.isMicMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>'; btnMic.className = this.isMicMuted ? 'w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center text-lg' : 'w-11 h-11 rounded-full bg-neutral-800 text-white flex items-center justify-center text-lg'; }
        if(btnCam) { btnCam.innerHTML = this.isCamOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>'; btnCam.className = this.isCamOff ? 'w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center text-lg' : 'w-11 h-11 rounded-full bg-neutral-800 text-white flex items-center justify-center text-lg'; }
    },

    openAVSettings() { 
        this.haptic('light'); 
        document.getElementById('modal-av-settings')?.classList.remove('hidden'); 
    },

    closeAVSettings() { 
        this.haptic('light'); 
        document.getElementById('modal-av-settings')?.classList.add('hidden'); 
    },

    async applyAVSettings() {
        this.haptic('heavy');
        const camId = document.getElementById('setting-cam-source')?.value, micId = document.getElementById('setting-mic-source')?.value;
        if (this.activeWebcamStream) { this.activeWebcamStream.getTracks().forEach(track => track.stop()); }
        let constraints = { video: true, audio: false };
        if (camId === 'obs-fallback') constraints.video = true; else if (camId) constraints.video = { deviceId: { exact: camId } };
        if (micId && micId !== 'none') constraints.audio = { deviceId: { exact: micId } }; else if (micId === 'none') constraints.audio = false;
        try { 
            this.activeWebcamStream = await navigator.mediaDevices.getUserMedia(constraints); 
            const videoElem = document.getElementById('bunker-webcam-feed'); 
            if (videoElem) { videoElem.srcObject = this.activeWebcamStream; videoElem.play(); } 
            this.isMicMuted = false; 
            this.isCamOff = false; 
            this.updateMediaTogglesUI(); 
            this.closeAVSettings(); 
        } catch(e) {}
    },

    toggleMinimizeVideo() {
        this.haptic('light');
        const bunker = document.getElementById('floating-video-bunker');
        this.isVideoMinimized = !this.isVideoMinimized;

        // Comprobar si ya existe la pestaña lateral
        let floatingTab = document.getElementById('floating-video-tab');

        if (this.isVideoMinimized) {
            // 1. Ocultar el videochat principal a la fuerza
            bunker.classList.add('video-hidden');
            
            // 2. Crear y mostrar la pestaña lateral si no existe
            if (!floatingTab) {
                floatingTab = document.createElement('div');
                floatingTab.id = 'floating-video-tab';
                floatingTab.className = 'video-floating-tab';
                floatingTab.innerHTML = `
                    <div class="pulse-dot"></div>
                    <i class="fa-solid fa-video"></i>
                `;
                // Al hacer clic en la pestaña, se vuelve a maximizar
                floatingTab.onclick = () => this.toggleMinimizeVideo();
                document.body.appendChild(floatingTab);
            } else {
                floatingTab.style.display = 'flex';
            }
            
        } else {
            // 1. Mostrar el videochat principal a pantalla completa
            bunker.classList.remove('video-hidden');
            
            // 2. Ocultar la pestaña lateral
            if (floatingTab) {
                floatingTab.style.display = 'none';
            }
        }
    },

    startLiveTransmission() {
        this.haptic('heavy');
        const badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live'), btnCancel = document.getElementById('btn-cancel-stream');
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded animate-pulse shadow-md uppercase'; badge.innerText = 'EN VIVO'; }
        if(btnGoLive) btnGoLive.classList.add('hidden'); 
        if(btnCancel) btnCancel.classList.remove('hidden');
        if (typeof BunkerChat !== 'undefined') { BunkerChat.sendGlobal(JSON.stringify({ text: '📡 ¡Transmisión en vivo iniciada en el Búnker!', media_url: null })); }
    },

    cancelLiveTransmission() {
        this.haptic('medium');
        const badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live'), btnCancel = document.getElementById('btn-cancel-stream');
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded shadow-md uppercase'; badge.innerText = 'PREVISUALIZACIÓN'; }
        if(btnCancel) btnCancel.classList.add('hidden'); 
        if(btnGoLive) btnGoLive.classList.remove('hidden');
    },

    leaveVideoBunker() {
        this.haptic('light');
        if (this.activeWebcamStream) { 
            this.activeWebcamStream.getTracks().forEach(track => track.stop()); 
            this.activeWebcamStream = null; 
        }
        Object.keys(this.peerConnections).forEach(id => this.closePeerConnection(id));
        const bunker = document.getElementById('floating-video-bunker'), videoElem = document.getElementById('bunker-webcam-feed'), placeholder = document.getElementById('cam-loading-placeholder');
        if (videoElem) { videoElem.srcObject = null; videoElem.classList.add('hidden'); }
        if (placeholder) placeholder.classList.remove('hidden'); 
        if (bunker) {
            bunker.classList.add('hidden');
            bunker.classList.remove('video-hidden'); // Limpiar la clase de ocultación por si acaso
        }
        this.isVideoMinimized = false;
        
        // Eliminar la pestaña flotante al salir por completo
        const floatingTab = document.getElementById('floating-video-tab');
        if (floatingTab) floatingTab.style.display = 'none';

        if (typeof BunkerChat !== 'undefined') BunkerChat.sendGlobal(JSON.stringify({ type: 'leave_video' }));
    },

    startVideoCall() { 
        this.haptic('light'); 
        this.openGlobalChat(); 
    },

    openUploadPanel() {
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const userRole = this.userData?.role || 'fan';
        const isAdminUser = this.isAdminUser();
        const walletConnected = this.tonConnectUI?.connected || localStorage.getItem('alpha_ton_connected') === 'true';

        if (userRole === 'creator' && kycStatus !== 'verified' && !isAdminUser) { this.openKYCModal(); return; }
        if (userRole === 'fan' && !walletConnected && !isAdminUser) { this.openPaymentMethods(); return; }
        this.closeModals(); 
        this.switchView('upload'); 
    },

    openRoleModal() { 
        this.closeModals(); 
        document.getElementById('modal-role')?.classList.remove('hidden'); 
    },
    
    toggleLanguage() { 
        this.haptic('medium');
        const languages = ['es', 'en', 'it', 'pt', 'de', 'fr'], currentLang = localStorage.getItem('alpha_lang') || 'es', nextLang = languages[(languages.indexOf(currentLang) + 1) % languages.length];
        this.setLanguage(nextLang);
    },

    setLanguage(lang) { 
        this.haptic('light'); 
        localStorage.setItem('alpha_lang', lang); 
        this.currentLang = lang;
        const langText = document.getElementById('fab-lang-text'); 
        if (langText) langText.innerText = lang.toUpperCase();
        if (typeof window.applyTranslations === 'function') window.applyTranslations(lang);
        this.updateProfileUI();
        if(!document.getElementById('modal-catalog')?.classList.contains('hidden')) this.openCatalogPackages();
    },

    toggleAdminSecret() { 
        this.haptic('light'); 
        this.initUserId(); 
        if (this.isAdminUser()) this.isAdmin = !this.isAdmin; 
    },
    
    async previewImage(event) { 
        const file = event.target.files[0]; 
        if (!file) return; 
        this.tempPostMedia = await this.compressImage(file, 1200, 0.75); 
        document.getElementById('txt-upload').innerText = `Imagen cargada: ${file.name}`; 
    },

    async publishPost() {
        this.haptic('medium');
        const content = document.getElementById('admin-text-es')?.value.trim() || '', tierRequired = parseInt(document.getElementById('admin-level')?.value || '0');
        if (!content && !this.tempPostMedia) return;
        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/posts/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, author: this.userData?.name || "mastertom", text_es: content, image_url: this.tempPostMedia, levelRequired: tierRequired, is_ppv: false, price_alpha: 0 }) });
            const data = await res.json(); 
            if (res.ok && data.status === "success") { this.switchView('feed'); await this.renderFeed(); }
        } catch (err) {}
    },

    async deletePost(postId) { 
        if (!confirm('¿Eliminar publicación?')) return; 
        try { 
            await fetch(`${this.backendUrl}/posts/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: this.userId || 0, post_id: postId }) }); 
            this.renderFeed(); 
        } catch (e) {} 
    },
    
    async unlockPostContent(postId, priceAlpha) { 
        try { 
            const res = await fetch(`${this.backendUrl}/posts/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, post_id: postId }) }); 
            if (res.ok) { await this.refreshUserData(); await this.renderFeed(); } 
        } catch (e) {} 
    },
    
    // 🛡️ LIKES CON BRILLO NEÓN CORREGIDO
    async toggleLike(postId) {
        this.haptic('light');
        let liked = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
        const isLiking = !liked.includes(postId);
        
        if (isLiking) {
            liked.push(postId);
        } else {
            liked = liked.filter(id => id !== postId);
        }
        
        localStorage.setItem('alpha_user_liked_posts', JSON.stringify(liked)); 
        
        const countEls = [document.getElementById(`like-count-${postId}`), document.getElementById(`like-count-prof-${postId}`)];
        countEls.forEach(el => {
            if(el) {
                let currentCount = parseInt(el.innerText) || 0;
                el.innerText = isLiking ? currentCount + 1 : Math.max(0, currentCount - 1);
                
                // Efecto Visual Neón
                const btn = el.closest('button');
                if (btn) {
                    if (isLiking) {
                        btn.className = "flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border transition-all bg-[#ff00ff]/20 border-[#ff00ff] text-[#ff00ff] shadow-[0_0_10px_#ff00ff]";
                    } else {
                        btn.className = "flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border transition-all border-neutral-700 text-neutral-400 hover:border-neutral-500";
                    }
                }
            }
        });
        
        try {
            await fetch(`${this.backendUrl}/posts/like`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId, post_id: postId, action: isLiking ? 'like' : 'unlike' })
            });
        } catch(e) {}
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
                feedContainer.innerHTML = `<div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-neutral-400 font-bold">No hay publicaciones disponibles</div>`; 
                return; 
            }
            feedContainer.innerHTML = posts.map(post => {
                const isLiked = likedPosts.includes(post.id);
                const isAdminUser = this.isAdminUser();
                const isOwnerOrAdmin = (this.userId == post.creator_id || isAdminUser);
                const safeAuthor = this.escapeHtml(post.author || 'mastertom');
                const safeAuthorAttr = this.escapeHtml(post.author || 'Creador').replace(/"/g, '&quot;');
                const rankInfo = this.getRankBadge(post.levelRequired);
                
                let avatarHtml = '';
                if (post.author_avatar) {
                    avatarHtml = `<img src="${this.sanitizeUrl(post.author_avatar)}" class="w-full h-full object-cover">`;
                } else {
                    avatarHtml = `<i class="fa-solid fa-user text-xs text-[#00f3ff]"></i>`;
                }

                let onlineDotHtml = post.is_online ? `<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black animate-pulse" title="Online"></div>` : '';

                let mediaHtml = '';
                if (post.media_url) {
                    const cleanUrl = this.sanitizeUrl(post.media_url);
                    const isVid = cleanUrl.match(/\.(mp4|webm)/i) || cleanUrl.startsWith('data:video');
                    if (isVid) {
                        mediaHtml = `<div class="relative cursor-pointer group mb-3" onclick="app.openLightbox('${cleanUrl}', 'video')"><video src="${cleanUrl}" class="rounded-xl w-full max-h-80 object-cover" autoplay muted loop playsinline></video><div class="absolute inset-0 bg-black/20 flex items-center justify-center rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-expand text-white text-3xl drop-shadow-[0_0_8px_black]"></i></div></div>`;
                    } else {
                        mediaHtml = `<div class="relative cursor-pointer group mb-3" onclick="app.openLightbox('${cleanUrl}', 'image')"><img src="${cleanUrl}" class="rounded-xl w-full max-h-80 object-cover" alt="Media"/><div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl pointer-events-none"><i class="fa-solid fa-magnifying-glass-plus text-white text-3xl drop-shadow-[0_0_8px_black]"></i></div></div>`;
                    }
                }

                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2.5 cursor-pointer" onclick="app.viewCreatorProfile(${post.creator_id || 99999}, '${safeAuthorAttr}')">
                                <div class="relative w-10 h-10 rounded-full border border-[#00f3ff] overflow-hidden bg-black flex items-center justify-center shadow-md">
                                    ${avatarHtml}
                                    ${onlineDotHtml}
                                </div>
                                <div class="flex flex-col">
                                    <span class="font-bold text-amber-400 text-sm hover:underline">@${safeAuthor}</span>
                                    <span class="text-[9px] ${post.is_online ? 'text-emerald-400 font-bold' : 'text-neutral-500'}">${post.is_online ? '● ONLINE' : '○ OFFLINE'}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 bg-black/50 px-2 py-1 rounded-lg">
                                <span class="text-[10px] text-neutral-400 uppercase font-black">${rankInfo.name}</span>
                                ${isOwnerOrAdmin ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1 ml-2"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${this.escapeHtml(post.content)}</p>` : ''}
                        
                        ${post.is_locked ? `<div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3"><i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i><button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">🔓 Desbloquear (${post.price_alpha || 20} $ALPHA)</button></div>` : mediaHtml}
                        
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" id="btn-like-main-${post.id}" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border transition-all ${isLiked ? 'bg-[#ff00ff]/20 border-[#ff00ff] text-[#ff00ff] shadow-[0_0_10px_#ff00ff]' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}">
                                <i class="fa-solid fa-heart"></i> <span id="like-count-${post.id}">${post.likes_count || 0}</span>
                            </button>
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${safeAuthorAttr}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">🪙 Tip</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {}
    },

    selectCreatorRole() { this.closeModals(); },
    selectFanRole() { this.closeModals(); }
};

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof app === 'undefined') return;
    app.checkSession(); 
    
    const isTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
    const applyPrivacyBlackout = () => { if (isTelegram) document.body.classList.add('privacy-blur'); };
    const removePrivacyBlackout = () => { document.body.classList.remove('privacy-blur'); };

    if (isTelegram) {
        document.addEventListener('visibilitychange', () => { if (document.hidden) applyPrivacyBlackout(); else removePrivacyBlackout(); });
        window.addEventListener('blur', applyPrivacyBlackout);
        window.addEventListener('focus', removePrivacyBlackout);
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'PrintScreen' || e.keyCode === 44) { navigator.clipboard.writeText('Contenido protegido'); app.showToast('Capturas bloqueadas'); }
            if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) e.preventDefault();
        });
    } else {
        removePrivacyBlackout();
    }
});