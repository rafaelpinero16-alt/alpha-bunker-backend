const app = {
    userId: null,
    tonConnectUI: null,
    backendUrl: "https://alpha-bunker-backend-production.up.railway.app",
    currentCaptcha: '',
    isAdmin: false,
    userData: { name: 'USER', access_tier: 0 },

    // ==========================================
    // 1. UTILIDADES Y SISTEMA
    // ==========================================
    haptic(style) {
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
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
        } else {
            console.log(msg);
        }
    },

    copyText(text) {
        navigator.clipboard.writeText(text).then(() => this.showToast('¡Copiado! 📋'));
    },

    openLink(url) {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
            window.Telegram.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    },

    refreshUserData() {
        console.log("Refrescando datos de usuario...");
    },

    // ==========================================
    // 2. BILLETERA Y TONCONNECT
    // ==========================================
    async connectWallet() {
        try {
            this.haptic('medium');
            
            if (!this.userId && window.Telegram && window.Telegram.WebApp.initDataUnsafe?.user) {
                this.userId = window.Telegram.WebApp.initDataUnsafe.user.id;
            }

            if (window.TON_CONNECT_UI && typeof TON_CONNECT_UI !== 'undefined') {
                if (!this.tonConnectUI) {
                    this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                        manifestUrl: window.location.origin + '/tonconnect-manifest.json'
                    });

                    this.tonConnectUI.onStatusChange(async (wallet) => {
                        if (wallet && wallet.account) {
                            const rawAddress = wallet.account.address;
                            this.showToast('¡Billetera conectada con éxito! 💎');
                            
                            try {
                                const response = await fetch(`${this.backendUrl}/wallet/connect-ton`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        user_id: this.userId || 0,
                                        ton_address: rawAddress
                                    })
                                });
                                if (!response.ok) throw new Error("Error sincronizando en servidor");
                            } catch (apiErr) {
                                console.warn("[BACKEND SYNC WARNING]:", apiErr);
                            }

                            if (typeof this.refreshUserData === 'function') {
                                await this.refreshUserData();
                            }
                        }
                    });
                }
                await this.tonConnectUI.openModal();
            } else {
                this.showToast('Actualizando saldo... 💎');
                if (typeof this.refreshUserData === 'function') {
                    await this.refreshUserData();
                }
            }
        } catch (err) {
            console.error("[TONCONNECT ERROR]:", err);
            this.showToast('⚠️ Error abriendo la billetera.');
        }
    },

    async rechargeAlphaCoins(amountTon, alphaAmount) {
        try {
            this.haptic('heavy');
            
            if (!this.tonConnectUI || !this.tonConnectUI.connected) {
                this.showToast('⚠️ Conecta tu billetera TON primero.');
                return;
            }
            
            this.showToast('Preparando transacción TON...');
            const nanoTonAmount = Math.floor(amountTon * 1000000000).toString();
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [
                    {
                        address: "UQDWI2auHgQ5a9KnWn9_by-RSswIaKfz38b_Yib_cIy-Jklp",
                        amount: nanoTonAmount
                    }
                ]
            };

            const result = await this.tonConnectUI.sendTransaction(transaction);
            this.showToast('¡Pago en TON procesado! Acreditando... 💎');

            const response = await fetch(`${this.backendUrl}/wallet/recharge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId || 0,
                    amount_ton: amountTon,
                    alpha_added: alphaAmount,
                    boc: result?.boc || "DIRECT_TX"
                })
            });

            if (!response.ok) throw new Error("El pago se realizó pero el servidor no pudo registrar la recarga.");

            if (typeof this.refreshUserData === 'function') {
                await this.refreshUserData();
            }
            this.showToast(`¡Recarga exitosa! +${alphaAmount} $ALPHA 🚀`);
        } catch (err) {
            console.error("[RECHARGE ERROR]:", err);
            this.showToast('⚠️ Transacción cancelada o fallida.');
        }
    },

    // ==========================================
    // 3. CAPTCHA Y VISTAS
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
            window.scrollTo(0, 0); // Sube la pantalla al inicio al cambiar de vista
        } else {
            console.error(`[VIEW ERROR]: No se encontró la vista view-${viewName}`);
        }
    },

    goHome() {
        this.haptic('light');
        this.closeModals();
        this.switchView('feed');
    },

    acceptConsent() {
        this.haptic('medium');
        try { localStorage.setItem('alpha_consent', 'true'); } catch (e) { console.warn("Storage warning:", e); }
        this.switchView('captcha');
        this.generateCaptcha();
    },

    generateCaptcha() {
        if (typeof this.haptic === 'function') this.haptic('light');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.currentCaptcha = code;
        
        const display = document.getElementById('captcha-display');
        if (display) display.innerText = code;
        
        const input = document.getElementById('captcha-input');
        if (input) input.value = '';
    },

    verifyCaptcha() {
        if (typeof this.haptic === 'function') this.haptic('medium');
        const input = document.getElementById('captcha-input');
        const display = document.getElementById('captcha-display');
        
        const actualCaptcha = (this.currentCaptcha || (display ? display.innerText : '')).trim();
        const userValue = input ? input.value.trim().toUpperCase() : '';

        if (userValue === actualCaptcha && userValue !== '') {
            this.showToast('¡Verificación exitosa! 🛡️');
            this.switchView('login');
        } else {
            this.showToast('⚠️ Código incorrecto. Intenta de nuevo.');
            this.generateCaptcha();
        }
    },

    // ==========================================
    // 4. MODALES VISUALES
    // ==========================================
    closeModals() {
        this.haptic('light');
        const modals = ['modal-profile', 'modal-role', 'modal-catalog', 'modal-communities', 'modal-payment', 'modal-banks', 'modal-chat'];
        modals.forEach(m => {
            const el = document.getElementById(m);
            if(el) el.classList.add('hidden');
        });
    },

    openProfile() { this.closeModals(); document.getElementById('modal-profile')?.classList.remove('hidden'); },
    openMenuModal() { this.closeModals(); document.getElementById('modal-catalog')?.classList.remove('hidden'); },
    openCommunitiesModal() { this.closeModals(); document.getElementById('modal-communities')?.classList.remove('hidden'); },
    openSupport() { this.closeModals(); document.getElementById('modal-chat')?.classList.remove('hidden'); },
    openManualBanks() { this.closeModals(); document.getElementById('modal-banks')?.classList.remove('hidden'); },
    openUploadPanel() { this.closeModals(); this.switchView('upload'); },
    openRoleModal() { this.closeModals(); document.getElementById('modal-role')?.classList.remove('hidden'); },
    
    openPaymentFlow(plan, price, link, tier) {
        this.closeModals();
        document.getElementById('modal-payment')?.classList.remove('hidden');
    },
    closePaymentModal() {
        document.getElementById('modal-payment')?.classList.add('hidden');
    },

    // ==========================================
    // 5. FUNCIONES DE INTERACCIÓN BÁSICA
    // ==========================================
    loginWithTelegram() { this.haptic('medium'); this.switchView('feed'); },
    loginWithPhone() { this.haptic('medium'); this.switchView('feed'); },
    registerWithData() { this.haptic('medium'); this.switchView('login'); },
    registerWithGoogle() { this.haptic('medium'); this.switchView('feed'); },
    exitApp() { if(window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.close(); },
    logout() { this.switchView('consent'); },
    
    toggleLanguage() { this.showToast('Idioma cambiado'); },
    setLanguage(lang) { this.switchView('feed'); },
    toggleAdminSecret() { this.isAdmin = !this.isAdmin; this.showToast(this.isAdmin ? 'Admin Mode ON' : 'Admin Mode OFF'); },
    
    simulateAndPay() { this.showToast('Simulando pago...'); },
    startVideoCall() { this.showToast('Conectando Video Llamada Segura... 📹'); },
    
    sendChatMessage() {
        const i = document.getElementById('chat-input');
        if(i && i.value) {
            this.showToast('Mensaje enviado');
            i.value = '';
        }
    },
    handleChatKeyPress(e) { if(e.key === 'Enter') this.sendChatMessage(); },
    
    publishPost() { this.showToast('Publicación enviada'); this.switchView('feed'); },
    previewImage(event) { this.showToast('Imagen cargada'); },
    saveProfile() { this.showToast('Perfil guardado'); },
    
    selectCreatorRole() { this.showToast('Rol de Creador seleccionado'); this.closeModals(); },
    selectFanRole() { this.showToast('Rol de Fan seleccionado'); this.closeModals(); }
};

// Exponemos el objeto al HTML
window.app = app;

// Disparador inicial al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    if (typeof app.generateCaptcha === 'function') {
        app.generateCaptcha();
    }
});