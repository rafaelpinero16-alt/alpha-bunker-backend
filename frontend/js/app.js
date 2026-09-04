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

    isAdminUser() {
        return this.userData?.role === 'admin';
    },

    sanitizeUrl(url) {
        if (!url) return '';
        const s = String(url).trim();
        if (s.startsWith('data:image/') || s.startsWith('data:video/') || s.startsWith('data:audio/')) return s;
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

    toggleTheme() {
        this.haptic('light');
        const body = document.body;
        body.classList.toggle('light-theme');
        const isLight = body.classList.contains('light-theme');
        localStorage.setItem('alpha_theme', isLight ? 'light' : 'dark');
        
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        
        const themeSwitch = document.getElementById('theme-switch');
        if(themeSwitch) themeSwitch.checked = isLight;
        
        this.showToast(isLight ? this.getTrans('toast_theme_light') : this.getTrans('toast_theme_dark'));
    },

    initTheme() {
        const savedTheme = localStorage.getItem('alpha_theme') || 'dark';
        const isLight = savedTheme === 'light';
        if (isLight) {
            document.body.classList.add('light-theme');
            const icon = document.getElementById('theme-icon');
            if (icon) icon.className = 'fa-solid fa-sun';
        }
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
            badge.className = isOnline 
                ? 'text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30' 
                : 'text-[9px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700';
        }
        if (toggleBtn) {
            toggleBtn.innerText = isOnline ? '● ONLINE' : '○ OFFLINE';
            toggleBtn.className = isOnline 
                ? 'text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/50' 
                : 'text-xs font-black text-neutral-400 bg-neutral-800 px-2.5 py-0.5 rounded-full border border-neutral-700';
        }
        if (settingsBtnText && settingsIndicator && settingsBtn) {
            settingsBtnText.innerText = isOnline ? 'ONLINE' : 'OFFLINE';
            settingsIndicator.className = isOnline 
                ? 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse' 
                : 'w-2.5 h-2.5 rounded-full bg-red-500';
            settingsBtn.className = isOnline 
                ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5' 
                : 'bg-red-600/20 border border-red-500 text-red-400 px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5';
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
        if (!newName) {
            this.showToast(this.getTrans('toast_invalid_alias'));
            return;
        }

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

        this.updateProfileUI();
        this.showToast(this.getTrans('toast_alias_updated'));
        this.closeSettingsModal();
    },

    updatePasswordSettings() {
        this.haptic('medium');
        const oldPassInput = document.getElementById('settings-old-pass');
        const newPassInput = document.getElementById('settings-new-pass');
        const confirmPassInput = document.getElementById('settings-confirm-pass');
        
        const oldPass = oldPassInput?.value.trim();
        const newPass = newPassInput?.value.trim();
        const confirmPass = confirmPassInput?.value.trim();
        
        const currentSavedPass = localStorage.getItem('alpha_user_pass') || '';

        if (!oldPass || !newPass || !confirmPass) {
            this.showToast(this.getTrans('toast_pwd_empty'));
            return;
        }
        
        if (currentSavedPass && oldPass !== currentSavedPass) {
            this.showToast(this.getTrans('toast_pwd_mismatch'));
            return;
        }
        
        if (newPass.length < 6) {
            this.showToast(this.getTrans('toast_pwd_short'));
            return;
        }

        if (newPass !== confirmPass) {
            this.showToast(this.getTrans('toast_pwd_not_match'));
            return;
        }

        localStorage.setItem('alpha_user_pass', newPass);
        
        this.showToast(`🔒 ${this.getTrans('pwd_changed_success')}`);
        
        oldPassInput.value = '';
        newPassInput.value = '';
        if (confirmPassInput) confirmPassInput.value = '';
        this.closeSettingsModal();
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
        setTimeout(() => {
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.remove(), 500);
        }, 4500);
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
                    
                    const localName = localStorage.getItem('alpha_user_name');
                    if (data.name && data.name !== 'USER' && !data.name.startsWith('Tel:')) { 
                        this.userData.name = data.name; 
                        localStorage.setItem('alpha_user_name', data.name); 
                    } else if (localName) {
                        this.userData.name = localName;
                    }

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
        
        const rankHTML = `<div class="relative inline-block w-6 h-6 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[8px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle font-black">${rankInfo.name}</span>`;
        if (rankDisplay) rankDisplay.innerHTML = rankHTML;
        if (rankFeed) rankFeed.innerHTML = `<div class="relative inline-block w-4 h-4 align-middle mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[6px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> <span class="align-middle text-xs font-black">${rankInfo.name}</span>`;

        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const kycStatusEl = document.getElementById('prof-kyc-status'), kycDescEl = document.getElementById('prof-kyc-desc'), kycBtn = document.getElementById('btn-verify-kyc');
        const isAdminUser = this.isAdminUser();
        const userRole = localStorage.getItem('alpha_user_role') || this.userData?.role;
        
        const walletConnected = (this.tonConnectUI && this.tonConnectUI.connected) || localStorage.getItem('alpha_ton_connected') === 'true';
        const ccConnected = localStorage.getItem('alpha_cc_connected') === 'true';
        const hasPaymentMethod = walletConnected || ccConnected;

        let warningText = "";
        if(this.userData.warnings > 0) warningText = ` - ⚠️ ${this.getTrans('warnings_label')}: ${this.userData.warnings}/5`;

        if (kycStatusEl) {
            if (userRole === 'fan' && hasPaymentMethod) {
                kycStatusEl.innerHTML = `<img src="./assets/badge_verified.png" style="mix-blend-mode: screen; background-color: transparent;" class="w-4 h-4 inline-block align-middle mr-1" onerror="this.style.display='none'"> <span class="align-middle">${this.getTrans('status_wallet_linked')} ✅ ${warningText}</span>`; 
                kycStatusEl.className = `text-xs font-black uppercase text-green-400 flex items-center justify-center`;
                if (kycDescEl) kycDescEl.innerText = this.getTrans('status_kyc_fan_desc');
                
                const sessionValid = localStorage.getItem('alpha_logged_in') === 'true' && this.userId;
                if (kycBtn && sessionValid) {
                    kycBtn.classList.remove('hidden');
                    kycBtn.innerHTML = `<i class="fa-solid fa-money-check-dollar mr-1"></i> CAMBIAR MÉTODO DE PAGO`;
                    kycBtn.className = 'w-full bg-neutral-800 border border-neutral-600 hover:bg-neutral-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition uppercase mt-3';
                    kycBtn.setAttribute('onclick', 'app.openPaymentMethods()');
                } else if (kycBtn) {
                    kycBtn.classList.add('hidden');
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
            if (currentSavedId && currentSavedId !== newId) {
                localStorage.clear(); 
            }
        } else {
            if (!newId) {
                newId = "99" + Math.floor(100000 + Math.random() * 900000);
            }
        }

        this.userId = newId; 
        localStorage.setItem("alpha_user_id", this.userId);
        
        const myAdminTelegramID = "8269470905"; 
        const myAdminPhone = "+573150213065"; 
        
        const isTelegramAdmin = (this.userId === myAdminTelegramID);
        const isPhoneAdmin = (localStorage.getItem('alpha_user_name') === `Tel: ${myAdminPhone}`);

        if (isTelegramAdmin || isPhoneAdmin) {
            this.userData.role = 'admin';
            this.userData.access_tier = 4;
            localStorage.setItem('alpha_user_role', 'admin');
        }

        const savedOnline = localStorage.getItem('alpha_user_online');
        if (savedOnline !== null) this.userData.isOnline = savedOnline === 'true';
    },

    async initTonConnect() {
        const TonConnectClass = (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) 
            ? window.TON_CONNECT_UI.TonConnectUI 
            : window.TonConnectUI;
            
        if (!this.tonConnectUI && TonConnectClass) {
            try {
                const safeOrigin = "https://alpha-bunker-backend-production.up.railway.app";
                
                this.tonConnectUI = new TonConnectClass({ 
                    manifestUrl: safeOrigin + '/tonconnect-manifest.json',
                    uiPreferences: { theme: 'DARK' }
                });
                
                if (typeof this.tonConnectUI.connectionRestored === 'object') {
                    await this.tonConnectUI.connectionRestored;
                }
                
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
                        if (btnHdr) btnHdr.innerText = this.getTrans('btn_wallet'); 
                        this.updateProfileUI();
                    }
                });
            } catch (err) {
                console.error("TonConnect init error:", err);
            }
        }
    },

    async connectWallet() {
        try {
            this.haptic('medium'); 
            this.initUserId(); 
            
            if (!this.tonConnectUI) {
                await this.initTonConnect();
            }

            if (!this.tonConnectUI) {
                this.showToast(this.getTrans('toast_ton_not_loaded'));
                return;
            }

            if (this.tonConnectUI.connected) {
                if (confirm(this.getTrans('confirm_disconnect_wallet'))) { 
                    await this.tonConnectUI.disconnect(); 
                    const btnHdr = document.getElementById('btn-wallet-hdr'); 
                    if (btnHdr) btnHdr.innerText = this.getTrans('btn_wallet'); 
                    localStorage.removeItem('alpha_ton_connected');
                    this.updateProfileUI();
                }
            } else { 
                await this.tonConnectUI.openModal(); 
            }
        } catch (err) {
            console.error("TonConnect openModal error:", err);
            this.showToast(this.getTrans('toast_ton_error'));
        }
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
                        <button onclick="app.connectCreditCard()" class="bg-neutral-800 border border-neutral-600 text-white font-black py-4 rounded-xl mb-3 flex items-center justify-center gap-2 uppercase hover:bg-neutral-700 active:scale-95 transition"><i class="fa-solid fa-credit-card text-xl"></i> ${this.getTrans('btn_credit_card')}</button>
                        <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold mt-4 uppercase text-sm w-full text-center transition">${this.getTrans('btn_cancel')}</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modal-payment-methods');
        }
        modal.classList.remove('hidden');
    },

    connectCreditCard() {
        this.haptic('medium');
        this.closeModals();
        let modal = document.getElementById('modal-cc-form');
        if (!modal) {
            const modalHTML = `
                <div id="modal-cc-form" class="fixed inset-0 z-[96] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md hidden">
                    <div class="bg-neutral-900 border-2 border-[#00f3ff] rounded-3xl p-6 w-11/12 max-w-md flex flex-col shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#00f3ff]/30">
                            <h3 class="text-lg font-black text-[#00f3ff] uppercase tracking-wider"><i class="fa-solid fa-lock mr-2"></i> ${this.getTrans('cc_modal_title')}</h3>
                            <button onclick="app.closeModals()" class="text-neutral-400 hover:text-white font-bold p-1"><i class="fa-solid fa-times text-xl"></i></button>
                        </div>
                        <div class="space-y-3 flex-1 overflow-y-auto pr-1 mt-2">
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_number')}</label>
                                <input type="text" id="cc-number" placeholder="4532 1234 5678 8921" maxlength="19" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/(.{4})/g, '$1 ').trim()" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium" />
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_name')}</label>
                                <input type="text" id="cc-name" placeholder="Felipe Sanchez" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium" />
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="relative">
                                    <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_expiry')}</label>
                                    <input type="text" id="cc-expiry" placeholder="MM/AA" maxlength="5" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium text-center" />
                                </div>
                                <div class="relative">
                                    <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_cvv')}</label>
                                    <input type="password" id="cc-cvv" placeholder="•••" maxlength="4" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium text-center" />
                                </div>
                            </div>
                            <div>
                                <label class="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">${this.getTrans('cc_label_bank')}</label>
                                <select id="cc-bank" class="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs w-full text-white focus:border-[#00f3ff] outline-none font-medium">
                                    <option value="" disabled selected>${this.getTrans('cc_select_bank')}</option>
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
                        </div>
                        <div class="mt-5 pt-3 border-t border-[#00f3ff]/30 flex gap-2">
                            <button onclick="app.openPaymentMethods()" class="w-1/2 bg-neutral-800 border border-neutral-600 text-white py-3 rounded-xl text-xs font-black uppercase transition">${this.getTrans('btn_back')}</button>
                            <button onclick="app.saveCreditCardData()" class="w-1/2 bg-[#00f3ff] text-black py-3 rounded-xl text-xs font-black uppercase shadow-[0_0_10px_rgba(0,243,255,0.5)] transition">${this.getTrans('btn_save_bio')}</button>
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

        const num = numInput?.value.trim();
        const name = nameInput?.value.trim();
        const expiry = expiryInput?.value.trim();
        const cvv = cvvInput?.value.trim();
        const bank = bankSelect?.value;

        if (!num || !name || !bank || !expiry || !cvv) {
            this.showToast(this.getTrans('toast_cc_empty'));
            return;
        }

        if(num.replace(/\D/g,'').length < 13) {
            this.showToast(this.getTrans('toast_cc_invalid'));
            return;
        }

        const maskedCard = {
            last4: num.slice(-4),
            bank: bank,
            token: "tok_alpha_" + Math.random().toString(36).substr(2, 10),
            connected_at: new Date().toISOString()
        };

        localStorage.setItem('alpha_cc_data', JSON.stringify(maskedCard));
        localStorage.setItem('alpha_cc_connected', 'true');
        
        numInput.value = ''; nameInput.value = ''; expiryInput.value = ''; cvvInput.value = ''; bankSelect.selectedIndex = 0;
        
        this.showToast(this.getTrans('toast_cc_linked'));
        this.closeModals();
        this.updateProfileUI();
    },

    payWithCreditCard(alphaAmount, targetLevel = null) {
        this.haptic('heavy');
        
        const ccData = JSON.parse(localStorage.getItem('alpha_cc_data') || '{}');
        if(!ccData.token) {
            this.showToast(this.getTrans('toast_cc_sec_error'));
            this.openPaymentMethods();
            return;
        }

        this.showToast(this.getTrans('toast_cc_processing').replace('{amount}', alphaAmount));
        
        setTimeout(() => {
            this.showToast(this.getTrans('toast_payment_completed'));
            this.triggerFireworks();
            this.refreshUserData();
            setTimeout(async () => {
                await this.syncKYCStatus();
                let finalLevel = targetLevel !== null ? targetLevel : this.userData.access_tier;
                this.showLevelUpAnimation(finalLevel);
            }, 1500);
        }, 2000);
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
                        <p class="text-xs text-neutral-300 mb-4 font-medium leading-relaxed">${this.getTrans('favorites_desc')}</p>
                        <div id="favorites-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        
                        <div class="mt-4 pt-4 border-t border-[#00f3ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2">${this.getTrans('btn_back')}</button>
                            <button onclick="app.saveAllFavorites()" class="bg-[#00f3ff] text-black hover:bg-[#00f3ff]/80 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2 shadow-[0_0_10px_rgba(0,243,255,0.5)]">${this.getTrans('btn_save_bio')}</button>
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
                        <p class="text-xs text-neutral-300 mb-4 font-medium leading-relaxed">Configura tus 10 opciones de propina. No olvides guardar los cambios.</p>
                        <div id="tip-menu-slots-form" class="flex-1 space-y-3 overflow-y-auto pr-2 pb-6"></div>
                        
                        <div class="mt-4 pt-4 border-t border-[#ff00ff]/30 flex justify-between gap-2 shrink-0">
                            <button onclick="app.closeModals()" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2">${this.getTrans('btn_back')}</button>
                            <button onclick="app.saveAllTipSlots()" class="bg-[#ff00ff] text-black hover:bg-[#ff00ff]/80 px-5 py-3 rounded-xl text-sm font-black transition uppercase w-1/2 shadow-[0_0_10px_rgba(255,0,255,0.5)]">${this.getTrans('btn_save_bio')}</button>
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
        this.showToast(this.getTrans('toast_tip_saving'));
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
        this.showToast(this.getTrans('toast_tip_saved').replace('{count}', successCount));
        if(successCount > 0) this.closeModals();
    },

    async viewCreatorProfile(creatorId, creatorName) {
        this.haptic('medium');
        this.closeModals();
        this.showToast(this.getTrans('toast_profile_connecting').replace('{name}', creatorName));
        
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
                            <button onclick="app.closeModals();" class="bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 px-6 py-2.5 rounded-xl text-sm font-black transition uppercase">${this.getTrans('btn_back')}</button>
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
        container.innerHTML = `<div class="text-center text-neutral-500 mt-4 text-xs font-bold">${this.getTrans('msg_loading_bunker')}</div>`;

        try {
            const res = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            const data = res.ok ? await res.json() : {};
            const allPosts = data.posts || [];
            const creatorPosts = allPosts.filter(p => p.creator_id == creatorId);

            if (creatorPosts.length === 0) {
                container.innerHTML = `<div class="text-center text-neutral-500 mt-4 text-xs font-bold uppercase tracking-widest bg-black/50 p-4 rounded-xl">${this.getTrans('msg_no_posts')}</div>`;
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
                                <div class="relative inline-block w-4 h-4 mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[4px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div>
                                <span class="text-[10px] text-neutral-400 uppercase font-black">${rankInfo.name}</span>
                                ${isOwnerOrAdmin ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1 ml-2"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${this.escapeHtml(post.content)}</p>` : ''}
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">${this.getTrans('txt_protected_content')}</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">
                                    🔓 ${this.getTrans('btn_unlock')} (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${this.sanitizeUrl(post.media_url)}" class="rounded-xl w-full max-h-80 object-cover mb-3" alt="Media"/>` : '')}
                        
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'}">
                                <i class="fa-solid fa-heart"></i> ${this.getTrans('btn_like')}
                            </button>
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${safeAuthorAttr}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">
                                🪙 ${this.getTrans('btn_tip')}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = `<div class="text-center text-red-500 mt-4 text-xs font-bold">${this.getTrans('msg_error_profile')}</div>`;
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
                            <button onclick="app.closeModals()" class="w-full bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700 py-3 rounded-xl text-sm font-black transition uppercase">${this.getTrans('btn_back')}</button>
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
        container.innerHTML = `<div class="text-center text-neutral-400 mt-4 font-bold">${this.getTrans('msg_loading')}</div>`;
        
        const slots = await this.loadTipMenu(creatorId);
        container.innerHTML = slots.length === 0 ? `<div class="text-center text-neutral-500 mt-10 font-bold bg-black/50 p-4 rounded-xl">${this.getTrans('msg_no_tip_menu')}</div>` : slots.map(s => `
            <button onclick="app.sendTipFromPost(${creatorId}, ${s.price_alpha}, ${postId || null})" class="w-full bg-black border border-[#ffb703]/50 hover:bg-[#ffb703]/20 rounded-2xl p-4 flex justify-between items-center text-white transition active:scale-95 shadow-md">
                <span class="font-bold text-sm text-left truncate pr-2">${this.escapeHtml(s.title)}</span>
                <span class="bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-xs font-black px-3 py-1.5 rounded-xl shadow-md whitespace-nowrap">${s.price_alpha} $ALPHA</span>
            </button>
        `).join('');
    },

    // ============================================================================
    // 🛡️ MÓDULO DE FONDEO EXTERNO A 1-CLIC (SKRILL, PANDA, TON)
    // ============================================================================

    openExternalCheckout(packageSlug) {
        this.closeModals();
        if (!packageSlug || typeof packageSlug !== 'string') return;
        
        // 🔒 Sanitizar el input antes de procesarlo
        const safeSlug = encodeURIComponent(packageSlug.replace(/[^a-zA-Z0-9_-]/g, ''));
        this.currentCheckoutPackage = safeSlug;
        
        let modal = document.getElementById('modal-external-checkout');
        if (!modal) {
            // Se inyecta HTML escapando explícitamente los valores para evitar XSS
            const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            const t1     = esc(this.getTrans('checkout_title_1click'));
            const t2     = esc(this.getTrans('checkout_desc_1click'));
            const lSkrill = esc(this.getTrans('btn_pay_skrill'));
            const lPanda  = esc(this.getTrans('btn_pay_panda'));
            const lTon    = esc(this.getTrans('btn_connect_ton'));

            const modalHTML = `
                <div id="modal-external-checkout" class="fixed inset-0 z-[200] bg-black bg-opacity-95 backdrop-blur-md flex justify-center items-center p-4 hidden">
                    <div class="glass-panel border-2 border-[#00f3ff] shadow-[0_0_25px_rgba(0,243,255,0.3)] rounded-3xl p-6 w-full max-w-md text-white relative">
                        <button onclick="app.closeCheckout()" class="absolute top-4 right-4 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:scale-110 transition shadow-[0_0_10px_red]"><i class="fa-solid fa-times"></i></button>
                        <h2 class="text-2xl font-black text-center mb-2 text-[#00f3ff] uppercase tracking-wider">${t1}</h2>
                        <p class="text-center text-gray-300 mb-6 text-[10px] uppercase font-bold tracking-widest">${t2}</p>

                        <div class="space-y-3">
                            <button onclick="app.processOneClickPay('skrill')" class="w-full bg-[#802a55] hover:bg-[#601a3e] text-white font-black py-4 rounded-xl shadow-[0_0_15px_rgba(128,42,85,0.4)] uppercase flex justify-center items-center gap-2 transition active:scale-95">
                                <i class="fa-solid fa-wallet text-xl"></i> ${lSkrill}
                            </button>
                            <button onclick="app.processOneClickPay('panda')" class="w-full bg-[#11bc76] hover:bg-[#0e945c] text-white font-black py-4 rounded-xl shadow-[0_0_15px_rgba(17,188,118,0.4)] uppercase flex justify-center items-center gap-2 transition active:scale-95">
                                <i class="fa-solid fa-leaf text-xl"></i> ${lPanda}
                            </button>
                            <div class="w-full mt-2 pt-2 border-t border-[#00f3ff]/30">
                                <button onclick="app.connectWallet()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] uppercase flex justify-center items-center gap-2 transition active:scale-95">
                                    <i class="fa-brands fa-telegram text-xl"></i> ${lTon}
                                </button>
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

    // 🔒 URLs base de pasarelas centralizadas (Reemplazar con URLs reales del perfil de MasterTom)
    _gatewayUrls: {
        skrill: 'https://skrill.com',   
        panda:  'https://pandapay.com'  
    },

    processOneClickPay(gateway) {
        if (!this.currentCheckoutPackage) {
            this.showToast('⚠️ Selecciona un plan primero.');
            return;
        }
        
        // 🔒 Whitelist: solo se permiten keys existentes en el objeto _gatewayUrls
        if (!Object.keys(this._gatewayUrls).includes(gateway)) {
            console.warn('[CHECKOUT] Gateway no reconocida:', gateway);
            return;
        }

        this.haptic('heavy');
        this.showToast(this.getTrans('toast_redirecting').replace('{gateway}', gateway.toUpperCase()));
        
        // 🚀 Redirección dinámica y blindada a pasarelas
        setTimeout(() => {
            // El slug ya fue sanitizado en openExternalCheckout
            const paymentUrl = `${this._gatewayUrls[gateway]}?pkg=${this.currentCheckoutPackage}`;
            
            // Abrir en pestaña blindada para que el target no pueda secuestrar la ventana padre
            window.open(paymentUrl, '_blank', 'noopener,noreferrer');
            this.closeCheckout();
        }, 1500);
    },

    closeCheckout() {
        this.haptic('light');
        const quickModal = document.getElementById('modal-external-checkout');
        if (quickModal) quickModal.classList.add('hidden');
        // Purgar caché visual del modal viejo por seguridad, si aún existe en el DOM
        const oldModal = document.getElementById('checkoutModal');
        if (oldModal) oldModal.classList.add('hidden');
    },
    // ============================================================================

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
            let mediaRecorder;
            let chunks = [];
            try { mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' }); } catch (e) { mediaRecorder = new MediaRecorder(stream); }

            this.showToast(this.getTrans('toast_recording_selfie'));
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.tempChatMediaData = e.target.result;
                    const previewContainer = document.getElementById('global-chat-preview-container');
                    const previewVideo = document.getElementById('global-chat-preview-video');
                    const previewImg = document.getElementById('global-chat-preview-img');
                    const previewName = document.getElementById('global-chat-preview-name');
                    if (previewContainer) {
                        previewContainer.classList.remove('hidden');
                        if (previewImg) previewImg.classList.add('hidden');
                        if (previewVideo) { previewVideo.src = e.target.result; previewVideo.classList.remove('hidden'); previewVideo.play(); }
                        if (previewName) previewName.innerText = `${this.getTrans('media_video_selfie')} 📸`;
                    }
                    this.showToast(this.getTrans('toast_selfie_ready'));
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setTimeout(() => { if (mediaRecorder.state === 'recording') { mediaRecorder.stop(); } }, 5000);
        } catch (err) { this.showToast(this.getTrans('toast_cam_error')); }
    },

    triggerAvatarInput() { this.haptic('light'); const input = document.getElementById('avatar-file-input'); if (input) input.click(); },
    
    async handleAvatarChange(event) {
        const file = event.target.files[0]; if (!file) return;
        this.haptic('light'); this.showToast(this.getTrans('toast_optimizing_photo'));
        const avatarUrl = await this.compressImage(file, 400, 0.8);
        localStorage.setItem('alpha_user_avatar', avatarUrl);
        const avatarImg = document.getElementById('prof-avatar-img'), avatarFeed = document.getElementById('avatar-feed');
        if (avatarImg) { avatarImg.src = avatarUrl; avatarImg.classList.remove('hidden'); }
        if (avatarFeed) avatarFeed.src = avatarUrl;
        
        try { await fetch(`${this.backendUrl}/users/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, name: this.userData.name, avatar: avatarUrl }) }); } catch(e) {}
        this.showToast(this.getTrans('toast_avatar_updated'));
    },

    async saveProfile() {
        this.haptic('medium');
        const aliasInput = document.getElementById('prof-alias'), bioInput = document.getElementById('prof-bio');
        const newName = aliasInput ? aliasInput.value.trim() : '', newBio = bioInput ? bioInput.value.trim() : '';
        if (newName) { this.userData.name = newName; localStorage.setItem('alpha_user_name', newName); }
        if (newBio) { localStorage.setItem('alpha_user_bio', newBio); }
        
        try {
            await fetch(`${this.backendUrl}/users/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, name: newName, bio: newBio }) });
        } catch(e) {}

        this.showToast(this.getTrans('toast_profile_saved')); 
        this.updateProfileUI();
    },

    openKYCModal() { this.closeModals(); document.getElementById('modal-kyc')?.classList.remove('hidden'); },
    async handleKYCDocPreview(event) {
        const file = event.target.files[0]; if (!file) return;
        this.tempKYCDoc = await this.compressImage(file, 1200, 0.75);
        const label = document.getElementById('kyc-doc-label'); if (label) label.innerText = `✅ ${this.getTrans('txt_doc_ready')}`;
    },
    async handleKYCSelfiePreview(event) {
        const file = event.target.files[0]; if (!file) return;
        this.tempKYCSelfie = await this.compressImage(file, 1024, 0.75);
        const label = document.getElementById('kyc-selfie-label'); if (label) label.innerText = `✅ ${this.getTrans('txt_selfie_ready')}`;
    },

    async submitKYC() {
        this.haptic('medium');
        const legalName = document.getElementById('kyc-legal-name')?.value.trim();
        if (!legalName || !this.tempKYCDoc || !this.tempKYCSelfie) { this.showToast(this.getTrans('toast_kyc_empty')); return; }
        this.initUserId(); this.showToast(this.getTrans('toast_kyc_sending'));
        try {
            const res = await fetch(`${this.backendUrl}/kyc/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, legal_name: legalName, document_base64: this.tempKYCDoc, selfie_base64: this.tempKYCSelfie }) });
            if (res.ok) { localStorage.setItem('alpha_kyc_status', 'pending'); this.showToast(this.getTrans('toast_kyc_sent')); this.closeModals(); this.updateProfileUI(); }
        } catch (err) {}
    },

    setRegisterRole(role) {
        this.haptic('light'); this.registerRoleSelected = role;
        const btnFan = document.getElementById('reg-role-fan'), btnCreator = document.getElementById('reg-role-creator');
        if (role === 'fan') {
            btnFan?.classList.replace('border-neutral-700', 'border-[#ff00ff]'); btnFan?.classList.replace('bg-black', 'bg-[#ff00ff]/20'); btnFan?.classList.replace('text-neutral-400', 'text-white');
            btnCreator?.classList.replace('border-[#00f3ff]', 'border-neutral-700'); btnCreator?.classList.replace('bg-[#00f3ff]/20', 'bg-black'); btnCreator?.classList.replace('text-white', 'text-neutral-400');
        } else {
            btnCreator?.classList.replace('border-neutral-700', 'border-[#00f3ff]'); btnCreator?.classList.replace('bg-black', 'bg-[#00f3ff]/20'); btnCreator?.classList.replace('text-white', 'text-neutral-400');
            btnFan?.classList.replace('border-[#ff00ff]', 'border-neutral-700'); btnFan?.classList.replace('bg-[#ff00ff]/20', 'bg-black'); btnFan?.classList.replace('text-white', 'text-neutral-400');
        }
    },

    registerWithData() {
        this.haptic('medium');
        const email = document.getElementById('reg-email-input')?.value.trim(), phone = document.getElementById('reg-phone-input')?.value.trim();
        if (!phone && !email) { this.showToast(this.getTrans('toast_reg_empty')); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        const isCreator = this.registerRoleSelected === 'creator';
        this.userData.role = this.registerRoleSelected; 
        
        if(!existingName) {
            this.userData.name = phone || email.split('@')[0] || (isCreator ? "mastertom" : "VIP Fan");
            localStorage.setItem('alpha_user_name', this.userData.name); 
        }

        localStorage.setItem('alpha_logged_in', 'true'); 
        localStorage.setItem('alpha_user_role', this.registerRoleSelected);
        this.switchView('feed'); this.syncKYCStatus(); this.updateProfileUI(); this.updateViewsCounter(); this.refreshUserData(); this.renderFeed();
    },

    async loginWithPhone() {
        this.haptic('medium'); const phone = document.getElementById('phone-input')?.value.trim();
        if (!phone) { this.showToast(this.getTrans('toast_login_empty')); return; }
        
        const existingName = localStorage.getItem('alpha_user_name');
        ['alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        
        this.userData = { name: existingName || 'USER', access_tier: 0, role: 'fan', warnings: 0 }; 
        this.initUserId();
        localStorage.setItem('alpha_logged_in', 'true'); 
        
        if(!existingName || existingName === 'USER') {
            localStorage.setItem('alpha_user_name', `Tel: ${phone}`);
        }
        
        this.switchView('feed'); await this.syncKYCStatus(); this.updateProfileUI(); this.updateViewsCounter(); this.refreshUserData(); this.renderFeed();
    },

    async loginWithTelegram() { 
        this.haptic('medium'); this.initUserId(); localStorage.setItem('alpha_logged_in', 'true'); 
        try { 
            const initData = window.Telegram?.WebApp?.initData || "";
            await fetch(`${this.backendUrl}/users/sync`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ user_id: this.userId, name: localStorage.getItem('alpha_user_name') || this.getTrans('default_agent'), bio: this.getTrans('default_bio_tg'), init_data: initData, is_telegram: !!initData }) 
            }); 
        } catch (e) {}
        this.switchView('feed'); this.updateProfileUI(); this.updateViewsCounter(); await this.syncKYCStatus(); this.refreshUserData(); this.renderFeed();
    },

    async checkSession() {
        try {
            this.initUserId(); 
            await this.initTonConnect(); 
            this.initTheme();
            
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
                if (!localStorage.getItem('alpha_user_name') || localStorage.getItem('alpha_user_name').startsWith('Tel:')) { 
                    localStorage.setItem('alpha_user_name', tgUser.first_name || 'VIP User'); 
                } 
            }
            
            if (activeLogin === 'true' || (tgUser && tgUser.id) || !hasConsent) { 
                // Forzar siempre la vista de feed para que los botones nunca desaparezcan
                this.switchView('feed'); 
                this.updateProfileUI(); 
                this.updateViewsCounter(); 
                await this.renderFeed();
            } else if (hasConsent === 'true') { 
                this.switchView('login'); 
            } else { 
                this.switchView('consent'); 
            }
        } catch (e) {
            console.error("[SESSION ERROR]:", e);
            // Fallback de seguridad: si algo falla, muestra el feed para no bloquear al usuario
            this.switchView('feed');
            this.renderFeed();
        }
    },

    exitApp() { if (window.Telegram?.WebApp) window.Telegram.WebApp.close(); },

    logout() { 
        this.haptic('medium'); 
        ['alpha_logged_in', 'alpha_user_name', 'alpha_user_bio', 'alpha_user_avatar', 'alpha_kyc_status', 'alpha_user_role', 'alpha_user_liked_posts'].forEach(k => localStorage.removeItem(k));
        this.userData = { name: 'USER', access_tier: 0, role: 'fan', warnings: 0 }; this.userId = null; this.switchView('consent'); 
    },

    switchView(viewName) {
        ['consent', 'login', 'captcha', 'register', 'lang', 'feed', 'upload'].forEach(v => { const el = document.getElementById(`view-${v}`); if (el) el.classList.add('hidden'); });
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) { targetView.classList.remove('hidden'); window.scrollTo(0, 0); if (viewName !== 'lang') this.lastView = viewName; }
    },

    goHome() { this.haptic('light'); this.closeModals(); this.switchView('feed'); this.renderFeed(); },
    acceptConsent() { this.haptic('medium'); localStorage.setItem('alpha_consent', 'true'); this.switchView('captcha'); this.generateCaptcha(); },

    generateCaptcha() {
        this.haptic('light'); const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = '';
        for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        this.currentCaptcha = code; const display = document.getElementById('captcha-display'); if (display) display.innerText = code;
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
            this.switchView('login');
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

    closeModals() {
        this.haptic('light');
        if (this.chatSocket) { this.chatSocket.close(); this.chatSocket = null; }
        if (this.globalChatSocket) { this.globalChatSocket.close(); this.globalChatSocket = null; }
        ['modal-profile', 'modal-settings', 'modal-creator-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-payment-methods', 'modal-cc-form', 'modal-favorites-edit', 'modal-banks', 'modal-chat', 'modal-global-chat', 'modal-kyc', 'modal-tip-menu-edit', 'modal-fan-tip-menu', 'media-lightbox-modal', 'modal-external-checkout'].forEach(m => {
            document.getElementById(m)?.classList.add('hidden');
        });
    },

    openProfile() { this.closeModals(); document.getElementById('modal-profile')?.classList.remove('hidden'); this.syncKYCStatus(); this.updateProfileUI(); this.refreshUserData(); },
    openMenuModal() { this.openCatalogPackages(); },
    openCommunitiesModal() { this.closeModals(); },

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
    
    async openSupport() { this.closeModals(); document.getElementById('modal-chat')?.classList.remove('hidden'); this.setupSystemMessageObserver('chat-messages'); await this.loadChatHistory(); BunkerChat.initCRM(this.userId, this.backendUrl); },
    async loadChatHistory() { const container = document.getElementById('chat-messages'); if (container) container.innerHTML = ''; try { const res = await fetch(`${this.backendUrl}/chat/history?limit=50`); if (res.ok) { const data = await res.json(); if (data.messages && data.messages.length > 0) { data.messages.forEach(msg => this.appendChatMessage(msg, 'chat-messages')); this.scrollToBottom('chat-messages'); } } } catch (err) {} },
    
    async openGlobalChat() { 
        this.closeModals(); 
        document.getElementById('modal-global-chat')?.classList.remove('hidden'); 
        this.updateOnlineUsersRadar();
        this.setupSystemMessageObserver('global-chat-messages'); 
        await this.loadGlobalChatHistory(); 
        BunkerChat.initGlobal(this.userId, this.backendUrl); 
    },
    
    updateOnlineUsersRadar() {
        const chipsContainerChat = document.getElementById('online-users-chips');
        const chipsContainerVideo = document.getElementById('bunker-video-active-members');
        const countSpan = document.getElementById('online-users-count');
        const userName = localStorage.getItem('alpha_user_name') || 'mastertom';
        
        if (countSpan) countSpan.innerText = '1';
        
        if (chipsContainerChat) {
            chipsContainerChat.innerHTML = `
                <div class="flex items-center gap-1 bg-black px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 truncate">
                    <i class="fa-solid fa-circle text-[4px] neon-green-dot"></i> @${this.escapeHtml(userName)} (${this.getTrans('txt_you')})
                </div>
            `;
        }
        if(chipsContainerVideo) {
            chipsContainerVideo.innerHTML = `
                <div class="flex items-center gap-1 bg-neutral-900 px-1.5 py-1 rounded border border-neutral-700 truncate">
                    <i class="fa-solid fa-circle text-[4px] text-amber-500"></i> @${this.escapeHtml(userName)}
                </div>
            `;
        }
    },

    async loadGlobalChatHistory() { const container = document.getElementById('global-chat-messages'); if (container) container.innerHTML = ''; try { const res = await fetch(`${this.backendUrl}/chat/global/history?limit=50`); if (res.ok) { const data = await res.json(); if (data.messages && data.messages.length > 0) { data.messages.forEach(msg => this.appendChatMessage(msg, 'global-chat-messages')); this.scrollToBottom('global-chat-messages'); } } } catch (e) {} },

    async handleChatMediaPreview(event, type) {
        document.getElementById('global-media-menu')?.classList.add('hidden');
        const file = event.target.files[0]; if (!file) return;
        this.initUserId();
        const isAdminUser = this.isAdminUser(), isCreator = this.userData?.role === 'creator', userTier = this.userData?.access_tier || 0;
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        
        if (type === 'global' && !isAdminUser && !isCreator) {
            if (userTier < 2) { this.showToast(this.getTrans('toast_tier_req_photo')); return; }
            if (isVideo && userTier < 3) { this.showToast(this.getTrans('toast_tier_req_video')); return; }
        }
        
        this.haptic('light'); 
        const inputEl = type === 'global' ? document.getElementById('global-chat-input') : document.getElementById('chat-input');
        const previewContainer = document.getElementById(`${type}-chat-preview-container`);
        const previewImg = document.getElementById(`${type}-chat-preview-img`);
        const previewVideo = document.getElementById(`${type}-chat-preview-video`);
        const previewName = document.getElementById(`${type}-chat-preview-name`);
        
        if (isVideo) {
            if (file.size > 5 * 1024 * 1024) { this.showToast(this.getTrans('toast_max_video_size')); this.clearChatMedia(type); return; }
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                this.tempChatMediaData = e.target.result; 
                if (previewContainer) { 
                    previewContainer.classList.remove('hidden'); 
                    if(previewImg) previewImg.classList.add('hidden'); 
                    if(previewVideo) {
                        previewVideo.src = e.target.result; 
                        previewVideo.classList.remove('hidden'); 
                    }
                    if(previewName) previewName.innerText = `${this.getTrans('txt_video')}: ${file.name.substring(0,12)}...`; 
                } 
                if (inputEl) inputEl.focus(); 
                this.showToast(this.getTrans('toast_video_attached')); 
            }; 
            reader.readAsDataURL(file);
        } else if (isAudio) {
            if (file.size > 2 * 1024 * 1024) { this.showToast(this.getTrans('toast_max_audio_size')); this.clearChatMedia(type); return; }
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                this.tempChatMediaData = e.target.result; 
                if (previewContainer) { 
                    previewContainer.classList.remove('hidden'); 
                    if(previewImg) previewImg.classList.add('hidden'); 
                    if(previewVideo) {
                        previewVideo.src = ""; 
                        previewVideo.classList.add('hidden'); 
                    }
                    if(previewName) previewName.innerHTML = `<i class="fa-solid fa-microphone text-[#ffb703] mr-1"></i> ${this.getTrans('txt_audio')}: ${file.name.substring(0,12)}...`; 
                } 
                if (inputEl) inputEl.focus(); 
                this.showToast(this.getTrans('toast_audio_attached')); 
            }; 
            reader.readAsDataURL(file);
        } else {
            this.tempChatMediaData = await this.compressImage(file, 800, 0.7); 
            if (previewContainer) { 
                previewContainer.classList.remove('hidden'); 
                if(previewVideo) {
                    previewVideo.classList.add('hidden'); 
                    previewVideo.src = ""; 
                }
                if(previewImg) {
                    previewImg.src = this.tempChatMediaData; 
                    previewImg.classList.remove('hidden'); 
                }
                if(previewName) previewName.innerText = `${this.getTrans('txt_photo')}: ${file.name.substring(0,12)}...`; 
            }
            if (inputEl) inputEl.focus(); 
            this.showToast(this.getTrans('toast_photo_attached'));
        }
    },

    clearChatMedia(type) {
        this.haptic('light'); this.tempChatMediaData = null;
        const uploadInput = document.getElementById(`${type}-media-upload`), previewContainer = document.getElementById(`${type}-chat-preview-container`), previewImg = document.getElementById(`${type}-chat-preview-img`), previewVideo = document.getElementById(`${type}-chat-preview-video`);
        if (uploadInput) uploadInput.value = ''; if (previewContainer) previewContainer.classList.add('hidden'); if (previewImg) { previewImg.src = ''; previewImg.classList.add('hidden'); } if (previewVideo) { previewVideo.src = ''; previewVideo.classList.add('hidden'); }
    },

    deleteChatMessage(msgId, btnElement) {
        this.haptic('medium');
        if(confirm(this.getTrans('confirm_delete_chat'))) {
            const bubble = btnElement.closest('.flex-col');
            if(bubble) {
                bubble.style.transition = 'all 0.3s ease';
                bubble.style.opacity = '0';
                bubble.style.height = '0px';
                setTimeout(() => bubble.remove(), 300);
            }
            this.showToast(this.getTrans('toast_chat_deleted'));
        }
    },

    reportChatMessage(msgId, btnElement) {
        this.haptic('light');
        const menu = document.getElementById(`media-menu-${msgId}`);
        if(menu) menu.classList.add('hidden');
        this.showToast(this.getTrans('toast_chat_reported'));
    },

    appendChatMessage(msg, containerId) {
        const container = document.getElementById(containerId); if (!container) return;
        const isMe = msg.user_id == this.userId;
        const isAdminUser = this.isAdminUser();
        const rankInfo = this.getRankBadge(msg.access_level);
        let contentObj = { text: msg.content, media_url: null };
        try { const parsed = JSON.parse(msg.content); if(parsed.text !== undefined) contentObj = parsed; } catch(e) {}
        let safeText = this.escapeHtml(contentObj.text || ''), safeMedia = '';
        
        if (contentObj.media_url) {
            const encodedUrl = encodeURI(this.sanitizeUrl(contentObj.media_url));
            if (!encodedUrl) { safeMedia = ''; } else {
            const uniqueId = msg.id || Math.random().toString(36).substr(2,9);
            const isOwner = msg.user_id == this.userId;
            
            let menuHtml = `
                <div class="absolute top-2 right-2 z-10" onclick="event.stopPropagation();">
                    <button onclick="document.getElementById('media-menu-${uniqueId}').classList.toggle('hidden')" class="bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#00f3ff]/40 border border-transparent hover:border-[#00f3ff] backdrop-blur-md transition shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <div id="media-menu-${uniqueId}" class="hidden absolute right-0 mt-2 w-36 bg-neutral-900 border border-neutral-700 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col z-20">
                        ${(isOwner || isAdminUser) ? `<button onclick="app.deleteChatMessage('${uniqueId}', this)" class="px-4 py-3 text-xs font-black text-red-400 hover:bg-neutral-800 text-left w-full border-b border-neutral-800 transition flex items-center"><i class="fa-solid fa-trash-can mr-2"></i> ${this.getTrans('btn_delete')}</button>` : ''}
                        <button onclick="app.reportChatMessage('${uniqueId}', this)" class="px-4 py-3 text-xs font-black text-amber-400 hover:bg-neutral-800 text-left w-full transition flex items-center"><i class="fa-solid fa-flag mr-2"></i> ${this.getTrans('btn_report')}</button>
                    </div>
                </div>
            `;

            if (contentObj.media_url.startsWith('data:video') || contentObj.media_url.includes('.mp4') || contentObj.media_url.includes('.webm')) { 
                safeMedia = `<div class="relative mt-2 mb-1 cursor-pointer group" onclick="app.openLightbox('${encodedUrl}', 'video')"><video src="${encodedUrl}" class="rounded-xl w-full max-h-48 object-cover pointer-events-none no-download" autoplay muted loop playsinline></video><div class="absolute inset-0 bg-black/20 flex items-center justify-center rounded-xl pointer-events-none"><i class="fa-solid fa-expand text-white text-xl drop-shadow-[0_0_5px_black]"></i></div>${menuHtml}</div>`; 
            } else if (contentObj.media_url.startsWith('data:audio') || contentObj.media_url.includes('.mp3') || contentObj.media_url.includes('.wav') || contentObj.media_url.includes('.ogg')) {
                safeMedia = `<div class="relative mt-2 mb-1"><audio src="${encodedUrl}" controls class="w-full h-10 rounded-full" controlsList="nodownload"></audio>${menuHtml}</div>`;
            } else { 
                safeMedia = `<div class="relative mt-2 mb-1 cursor-pointer group" onclick="app.openLightbox('${encodedUrl}', 'image')"><img src="${encodedUrl}" class="rounded-xl w-full max-h-48 object-cover pointer-events-none no-download" /><div class="absolute inset-0 bg-black/20 flex items-center justify-center rounded-xl pointer-events-none"><i class="fa-solid fa-magnifying-glass-plus text-white text-xl drop-shadow-[0_0_5px_black]"></i></div>${menuHtml}</div>`; 
            }
        }}

        const safeAuthorName = this.escapeHtml(msg.author_name);
        let html = '';
        if (msg.is_system) {
            try { const sysData = JSON.parse(contentObj.text); if (sysData.code === 'SYS_WARN_SPAM') { let template = this.getTrans('sys_warn_spam'); safeText = template.replace('{user}', this.escapeHtml(sysData.user)).replace('{warn}', sysData.warnings).replace('{penalty}', sysData.penalty); } } catch(e) {}
            const msgId = `sys-msg-${msg.id || Date.now()}-${Math.random().toString(36).substr(2,9)}`;
            html = `<div id="${msgId}" class="flex flex-col items-center my-2 transition-opacity duration-300"><div class="bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full font-black text-center"><i class="fa-solid fa-bolt mr-1"></i> ${safeText}</div></div>`;
            setTimeout(() => { const el = document.getElementById(msgId); if(el) { el.style.transition = 'all 0.4s ease'; el.style.opacity = '0'; el.style.height = '0px'; el.style.margin = '0px'; setTimeout(() => el.remove(), 400); } }, 1500); 
        } else if (isMe) {
            html = `<div class="flex flex-col items-end my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold mr-1 flex items-center gap-1">${this.getTrans('txt_you')} • <div class="relative inline-block w-3 h-3"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[4px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> ${rankInfo.name}</span><div class="bg-[#00f3ff]/20 text-white text-sm p-3 rounded-2xl border border-[#00f3ff]/50 max-w-[85%]">${safeText}${safeMedia}</div></div>`;
        } else {
            html = `<div class="flex flex-col items-start my-2"><span class="text-[9px] text-neutral-500 mb-1 font-bold ml-1 flex items-center gap-1"><span class="text-[#00f3ff] font-black">@${safeAuthorName}</span> • <div class="relative inline-block w-3 h-3"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[4px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div> ${rankInfo.name}</span><div class="bg-neutral-800 text-white text-sm p-3 rounded-2xl border border-neutral-700 max-w-[85%]">${safeText}${safeMedia}</div></div>`;
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
    scrollToBottom(containerId) { const container = document.getElementById(containerId); if (container) container.scrollTop = container.scrollHeight; },

    sendChatMessage() { 
        this.haptic('light'); const input = document.getElementById('chat-input'); const text = input ? input.value.trim() : '';
        if (!text && !this.tempChatMediaData) return;
        const payload = JSON.stringify({ text: text, media_url: this.tempChatMediaData });
        if (BunkerChat.sendCRM(payload)) { if (input) { input.value = ''; input.placeholder = this.getTrans('chat_placeholder'); } this.clearChatMedia('crm'); } else { BunkerChat.initCRM(this.userId, this.backendUrl); setTimeout(() => { BunkerChat.sendCRM(payload); if (input) { input.value = ''; input.placeholder = this.getTrans('chat_placeholder'); } this.clearChatMedia('crm'); }, 500); }
    },

    sendGlobalChatMessage() {
        this.haptic('light'); this.initUserId();
        const userRole = this.userData?.role || 'fan', kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified', isAdminUser = this.isAdminUser();
        const input = document.getElementById('global-chat-input'); const text = input ? input.value.trim() : '';
        if (!text && !this.tempChatMediaData) return;
        if (userRole === 'creator' && kycStatus !== 'verified' && !isAdminUser) { this.showToast(this.getTrans('toast_kyc_interact')); this.openKYCModal(); return; }
        const payload = JSON.stringify({ text: text, media_url: this.tempChatMediaData });
        if(!BunkerChat.globalSocket || BunkerChat.globalSocket.readyState !== 1) { BunkerChat.initGlobal(this.userId, this.backendUrl); setTimeout(() => { if (BunkerChat.globalSocket && BunkerChat.globalSocket.readyState === 1) { BunkerChat.sendGlobal(payload); if (input) { input.value = ''; input.placeholder = this.getTrans('chat_placeholder'); } this.clearChatMedia('global'); } }, 1500); return; }
        if (BunkerChat.sendGlobal(payload)) { if (input) { input.value = ''; input.placeholder = this.getTrans('chat_placeholder'); } this.clearChatMedia('global'); }
    },

    handleChatKeyPress(e) { if (e.key === 'Enter') this.sendChatMessage(); },
    handleGlobalChatKeyPress(e) { if (e.key === 'Enter') this.sendGlobalChatMessage(); },

    async joinVideoBunker() {
        this.haptic('medium'); this.initUserId();
        const isAdminUser = this.isAdminUser(), userTier = this.userData?.access_tier || 0;
        if (userTier < 4 && !isAdminUser) { this.showToast(this.getTrans('toast_tier_req_bunker')); this.openCatalogPackages(); return; }
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
            let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch (e) { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
            this.activeWebcamStream = stream; this.isMicMuted = false; this.isCamOff = false; this.updateMediaTogglesUI();
            const videoElem = document.getElementById('bunker-webcam-feed'), placeholder = document.getElementById('cam-loading-placeholder');
            if (videoElem) { videoElem.srcObject = this.activeWebcamStream; videoElem.play(); videoElem.classList.remove('hidden'); }
            if (placeholder) { placeholder.classList.add('hidden'); }
            await this.populateMediaDevices(stream);
        } catch (err) { const placeholder = document.getElementById('cam-loading-placeholder'); if(placeholder) { placeholder.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-4xl text-red-600 mb-2"></i>`; } }
    },

    async populateMediaDevices(currentStream) {
        if (!navigator.mediaDevices.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices(), videoDevices = devices.filter(d => d.kind === 'videoinput'), audioDevices = devices.filter(d => d.kind === 'audioinput');
        const selectCam = document.getElementById('setting-cam-source'), selectMic = document.getElementById('setting-mic-source');
        if (selectCam) {
            selectCam.innerHTML = ''; let seen = new Set(), obsFound = false;
            videoDevices.forEach((device, index) => {
                let original = device.label.toLowerCase(), cleanLabel = `${this.getTrans('cam_front')} #${index + 1}`;
                if (original.includes('obs') || original.includes('virtual')) { cleanLabel = `🎥 ${this.getTrans('cam_obs')}`; obsFound = true; } 
                else if (original.includes('front')) { cleanLabel = `📱 ${this.getTrans('cam_front')}`; } 
                else if (original.includes('back')) { cleanLabel = `📱 ${this.getTrans('cam_back')}`; } 
                else if (device.label) { cleanLabel = device.label; }
                
                if (!seen.has(cleanLabel)) { seen.add(cleanLabel); const opt = document.createElement('option'); opt.value = device.deviceId; opt.text = cleanLabel; selectCam.appendChild(opt); }
            });
            if(!obsFound) { const optObs = document.createElement('option'); optObs.value = "obs-fallback"; optObs.text = `🎥 ${this.getTrans('cam_force_obs')}`; selectCam.appendChild(optObs); }
            if (currentStream) { const currentTrack = currentStream.getVideoTracks()[0]; if (currentTrack) { const currentSettings = currentTrack.getSettings(); if (currentSettings.deviceId) selectCam.value = currentSettings.deviceId; } }
        }
        if (selectMic) {
            selectMic.innerHTML = `<option value="none">🔇 ${this.getTrans('mic_none')}</option>`;
            audioDevices.forEach((device, index) => { const opt = document.createElement('option'); opt.value = device.deviceId; opt.text = device.label || `${this.getTrans('txt_mic')} #${index + 1}`; selectMic.appendChild(opt); });
            if (currentStream && currentStream.getAudioTracks().length > 0) { const currentTrack = currentStream.getAudioTracks()[0]; const currentSettings = currentTrack.getSettings(); if (currentSettings.deviceId) selectMic.value = currentSettings.deviceId; }
        }
    },

    toggleMic() { this.haptic('light'); if (this.activeWebcamStream && this.activeWebcamStream.getAudioTracks().length > 0) { this.isMicMuted = !this.isMicMuted; this.activeWebcamStream.getAudioTracks()[0].enabled = !this.isMicMuted; this.updateMediaTogglesUI(); } },
    toggleCam() { this.haptic('light'); if (this.activeWebcamStream && this.activeWebcamStream.getVideoTracks().length > 0) { this.isCamOff = !this.isCamOff; this.activeWebcamStream.getVideoTracks()[0].enabled = !this.isCamOff; this.updateMediaTogglesUI(); } },

    updateMediaTogglesUI() {
        const btnMic = document.getElementById('btn-toggle-mic'), btnCam = document.getElementById('btn-toggle-cam');
        if(btnMic) { if(this.isMicMuted) { btnMic.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>'; btnMic.className = 'w-11 h-11 rounded-full bg-red-600 border border-red-400 text-white flex items-center justify-center transition shadow-[0_0_10px_rgba(255,0,0,0.4)] text-lg'; } else { btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i>'; btnMic.className = 'w-11 h-11 rounded-full bg-neutral-800 border border-neutral-600 text-white flex items-center justify-center hover:bg-neutral-700 transition shadow-[0_0_10px_rgba(255,255,255,0.1)] text-lg'; } }
        if(btnCam) { if(this.isCamOff) { btnCam.innerHTML = '<i class="fa-solid fa-video-slash"></i>'; btnCam.className = 'w-11 h-11 rounded-full bg-red-600 border border-red-400 text-white flex items-center justify-center transition shadow-[0_0_10px_rgba(255,0,0,0.4)] text-lg'; } else { btnCam.innerHTML = '<i class="fa-solid fa-video"></i>'; btnCam.className = 'w-11 h-11 rounded-full bg-neutral-800 border border-neutral-600 text-white flex items-center justify-center hover:bg-neutral-700 transition shadow-[0_0_10px_rgba(255,255,255,0.1)] text-lg'; } }
    },

    openAVSettings() { this.haptic('light'); document.getElementById('modal-av-settings')?.classList.remove('hidden'); },
    closeAVSettings() { this.haptic('light'); document.getElementById('modal-av-settings')?.classList.add('hidden'); },

    async applyAVSettings() {
        this.haptic('heavy');
        const camId = document.getElementById('setting-cam-source')?.value, micId = document.getElementById('setting-mic-source')?.value;
        if (this.activeWebcamStream) { this.activeWebcamStream.getTracks().forEach(track => track.stop()); }
        let constraints = { video: true, audio: false };
        if (camId === 'obs-fallback') constraints.video = true; else if (camId) constraints.video = { deviceId: { exact: camId } };
        if (micId && micId !== 'none') constraints.audio = { deviceId: { exact: micId } }; else if (micId === 'none') constraints.audio = false;
        try { this.activeWebcamStream = await navigator.mediaDevices.getUserMedia(constraints); const videoElem = document.getElementById('bunker-webcam-feed'); if (videoElem) { videoElem.srcObject = this.activeWebcamStream; videoElem.play(); } this.isMicMuted = false; this.isCamOff = false; this.updateMediaTogglesUI(); this.closeAVSettings(); } catch(e) { }
    },

    toggleMinimizeVideo() {
        this.haptic('light');
        const bunker = document.getElementById('floating-video-bunker'), controls = document.getElementById('video-controls-bar'), icon = document.getElementById('icon-minimize');
        this.isVideoMinimized = !this.isVideoMinimized;
        if (this.isVideoMinimized) { bunker.classList.add('pip-mode'); bunker.classList.remove('inset-0'); controls.classList.add('hidden'); icon.className = 'fa-solid fa-expand'; } else { bunker.classList.remove('pip-mode'); bunker.classList.add('inset-0'); controls.classList.remove('hidden'); icon.className = 'fa-solid fa-compress'; }
    },

    startLiveTransmission() {
        this.haptic('heavy');
        const badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live'), btnCancel = document.getElementById('btn-cancel-stream');
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded animate-pulse shadow-md uppercase'; badge.innerText = 'EN VIVO'; }
        if(btnGoLive) btnGoLive.classList.add('hidden'); if(btnCancel) btnCancel.classList.remove('hidden');
        if (typeof BunkerChat !== 'undefined') { BunkerChat.sendGlobal(JSON.stringify({ text: this.getTrans('stream_announce'), media_url: null })); }
    },

    cancelLiveTransmission() {
        this.haptic('medium');
        const badge = document.getElementById('video-badge'), btnGoLive = document.getElementById('btn-go-live'), btnCancel = document.getElementById('btn-cancel-stream');
        if(badge) { badge.className = 'absolute top-3 left-3 z-20 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded shadow-md uppercase'; badge.innerText = 'PREVISUALIZACIÓN'; }
        if(btnCancel) btnCancel.classList.add('hidden'); if(btnGoLive) btnGoLive.classList.remove('hidden');
    },

    leaveVideoBunker() {
        this.haptic('light');
        if (this.activeWebcamStream) { this.activeWebcamStream.getTracks().forEach(track => track.stop()); this.activeWebcamStream = null; }
        const bunker = document.getElementById('floating-video-bunker'), videoElem = document.getElementById('bunker-webcam-feed'), placeholder = document.getElementById('cam-loading-placeholder');
        if (videoElem) { videoElem.srcObject = null; videoElem.classList.add('hidden'); }
        if (placeholder) placeholder.classList.remove('hidden'); if (bunker) bunker.classList.add('hidden');
        this.isVideoMinimized = false;
    },

    startVideoCall() { this.haptic('light'); this.openGlobalChat(); },

    openUploadPanel() {
        this.initUserId();
        const kycStatus = localStorage.getItem('alpha_kyc_status') || 'unverified';
        const userRole = this.userData?.role || 'fan';
        const isAdminUser = this.isAdminUser();
        const walletConnected = this.tonConnectUI?.connected || localStorage.getItem('alpha_ton_connected') === 'true' || localStorage.getItem('alpha_cc_connected') === 'true';

        if (userRole === 'creator' && kycStatus !== 'verified' && !isAdminUser) { 
            this.showToast(this.getTrans('toast_kyc_post_creator')); 
            this.openKYCModal(); 
            return; 
        }
        if (userRole === 'fan' && !walletConnected && !isAdminUser) {
            this.showToast(this.getTrans('toast_wallet_req_post')); 
            this.openPaymentMethods();
            return;
        }
        
        this.closeModals(); this.switchView('upload'); 
    },

    openRoleModal() { this.closeModals(); document.getElementById('modal-role')?.classList.remove('hidden'); },
    
    toggleLanguage() { 
        this.haptic('medium');
        const languages = ['es', 'en', 'it', 'pt', 'de', 'fr'], currentLang = localStorage.getItem('alpha_lang') || 'es', nextLang = languages[(languages.indexOf(currentLang) + 1) % languages.length];
        this.setLanguage(nextLang);
    },

    setLanguage(lang) { 
        this.haptic('light'); localStorage.setItem('alpha_lang', lang); this.currentLang = lang;
        const langText = document.getElementById('fab-lang-text'); if (langText) langText.innerText = lang.toUpperCase();
        if (typeof window.applyTranslations === 'function') window.applyTranslations(lang);
        
        this.updateProfileUI();
        if(!document.getElementById('modal-catalog')?.classList.contains('hidden')) {
            this.openCatalogPackages();
        }
    },

    toggleAdminSecret() { this.haptic('light'); this.initUserId(); const isAdminUser = this.isAdminUser(); if (isAdminUser) { this.isAdmin = !this.isAdmin; } },
    
    async previewImage(event) { 
        const file = event.target.files[0]; if (!file) return; 
        this.tempPostMedia = await this.compressImage(file, 1200, 0.75); 
        document.getElementById('txt-upload').innerText = this.getTrans('toast_image_loaded').replace('{name}', file.name); 
    },

    async publishPost() {
        this.haptic('medium');
        const content = document.getElementById('admin-text-es')?.value.trim() || '', tierRequired = parseInt(document.getElementById('admin-level')?.value || '0');
        if (!content && !this.tempPostMedia) return;
        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/posts/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, author: this.userData?.name || "mastertom", text_es: content, image_url: this.tempPostMedia, levelRequired: tierRequired, is_ppv: false, price_alpha: 0 }) });
            const data = await res.json(); if (res.ok && data.status === "success") { this.switchView('feed'); await this.renderFeed(); }
        } catch (err) { }
    },

    async deletePost(postId) { if (!confirm(this.getTrans('confirm_delete_post'))) return; try { await fetch(`${this.backendUrl}/posts/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: this.userId || 0, post_id: postId }) }); this.renderFeed(); } catch (e) {} },
    
    async unlockPostContent(postId, priceAlpha) { 
        try { 
            const res = await fetch(`${this.backendUrl}/posts/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: this.userId || 0, post_id: postId }) }); 
            if (res.ok) { await this.refreshUserData(); await this.renderFeed(); } 
        } catch (e) {} 
    },
    
    toggleLike(postId) {
        let liked = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
        if (liked.includes(postId)) liked = liked.filter(id => id !== postId); else liked.push(postId);
        localStorage.setItem('alpha_user_liked_posts', JSON.stringify(liked)); this.renderFeed();
    },

    async renderFeed() {
        const feedContainer = document.getElementById('feed-container'); if (!feedContainer) return;
        this.initUserId();
        try {
            const res = await fetch(`${this.backendUrl}/posts/feed/${this.userId || 0}`);
            const data = res.ok ? await res.json() : {}; const posts = data.posts || [];
            const likedPosts = JSON.parse(localStorage.getItem('alpha_user_liked_posts') || '[]');
            if (posts.length === 0) { 
                feedContainer.innerHTML = `<div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-neutral-400 font-bold">${this.getTrans('msg_no_posts')}</div>`; 
                return; 
            }

            feedContainer.innerHTML = posts.map(post => {
                const isLiked = likedPosts.includes(post.id), isAdminUser = this.isAdminUser(), isOwnerOrAdmin = (this.userId == post.creator_id || isAdminUser);
                const safeAuthor = this.escapeHtml(post.author || 'mastertom'), safeContent = this.escapeHtml(post.content), safeAuthorAttr = this.escapeHtml(post.author || 'Creador').replace(/"/g, '&quot;');
                const showTipBtn = (post.author_role === 'creator' || post.author_role === 'admin');
                const rankInfo = this.getRankBadge(post.levelRequired);

                return `
                    <div class="post-card bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-4 shadow-lg text-white" id="post-${post.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 cursor-pointer" onclick="app.viewCreatorProfile(${post.creator_id || 99999}, '${safeAuthorAttr}')">
                                <div class="w-9 h-9 rounded-full border border-[#00f3ff] overflow-hidden bg-black flex items-center justify-center">
                                    <i class="fa-solid fa-user text-xs text-[#00f3ff]"></i>
                                </div>
                                <span class="font-bold text-amber-400 text-sm">@${safeAuthor}</span>
                            </div>
                            <div class="flex items-center gap-2 bg-black/50 px-2 py-1 rounded-lg">
                                <div class="relative inline-block w-4 h-4 mr-1"><div class="absolute inset-0 bg-[#00f3ff] rounded-full blur-[4px] opacity-80"></div><img src="${rankInfo.img}" class="relative w-full h-full object-contain rank-badge" onerror="this.src='./assets/badge_0.png'"></div>
                                <span class="text-[10px] text-neutral-400 uppercase font-black">${rankInfo.name}</span>
                                ${isOwnerOrAdmin ? `<button onclick="app.deletePost(${post.id})" class="text-neutral-500 hover:text-red-400 p-1 ml-2"><i class="fa-solid fa-trash-can text-sm"></i></button>` : ''}
                            </div>
                        </div>
                        ${post.content ? `<p class="text-sm text-neutral-200 mb-3">${this.escapeHtml(post.content)}</p>` : ''}
                        ${post.is_locked ? `
                            <div class="bg-black/60 border border-amber-500/30 rounded-xl p-6 text-center mb-3">
                                <i class="fa-solid fa-lock text-3xl text-amber-400 mb-2"></i>
                                <p class="text-sm font-bold text-amber-300">${this.getTrans('txt_protected_content')}</p>
                                <button onclick="app.unlockPostContent(${post.id}, ${post.price_alpha || 20})" class="mt-3 bg-amber-500 text-black font-black py-2 px-4 rounded-xl text-xs">
                                    🔓 ${this.getTrans('btn_unlock')} (${post.price_alpha || 20} $ALPHA)
                                </button>
                            </div>
                        ` : (post.media_url ? `<img src="${this.sanitizeUrl(post.media_url)}" class="rounded-xl w-full max-h-80 object-cover mb-3" alt="Media"/>` : '')}
                        
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800">
                            <button onclick="app.toggleLike(${post.id})" class="flex items-center gap-1 text-xs font-semibold py-1 px-2.5 rounded-lg border ${isLiked ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'}">
                                <i class="fa-solid fa-heart"></i> ${this.getTrans('btn_like')}
                            </button>
                            <button onclick="app.openFanTipMenu(${post.creator_id || 99999}, ${post.id}, '${safeAuthorAttr}')" class="bg-amber-500 text-black font-bold py-1.5 px-3 rounded-lg text-xs">
                                🪙 ${this.getTrans('btn_tip')}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            feedContainer.innerHTML = `<div class="text-center text-red-500 mt-4 text-xs font-bold">${this.getTrans('msg_error_profile')}</div>`;
        }
    },

    selectCreatorRole() { this.closeModals(); },
    selectFanRole() { this.closeModals(); }
};

window.app = app;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof app === 'undefined') return;
    app.checkSession(); 
    app.generateCaptcha();
    
    const isTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
    
    // 🛡️ Blindaje: solo aplicar pantalla negra si estamos estrictamente dentro de Telegram móvil
    const applyPrivacyBlackout = () => { 
        if (isTelegram) document.body.classList.add('privacy-blur'); 
    };
    const removePrivacyBlackout = () => {
        document.body.classList.remove('privacy-blur');
    };

    if (isTelegram) {
        document.addEventListener('visibilitychange', () => { 
            if (document.hidden) applyPrivacyBlackout(); 
            else removePrivacyBlackout(); 
        });
        window.addEventListener('blur', applyPrivacyBlackout);
        window.addEventListener('focus', removePrivacyBlackout);
    } else {
        // En navegador de escritorio siempre removemos el blackout
        removePrivacyBlackout();
    }

    // Permitir clic derecho y teclas F12 para desarrollo si no es Telegram nativo
    if (isTelegram) {
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'PrintScreen' || e.keyCode === 44) { 
                navigator.clipboard.writeText(app.getTrans('txt_protected_content')); 
                app.showToast(app.getTrans('toast_screenshots_blocked')); 
            }
            if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) e.preventDefault();
        });
    }
});