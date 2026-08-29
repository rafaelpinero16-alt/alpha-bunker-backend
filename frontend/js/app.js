async connectWallet() {
    try {
        this.haptic('medium');
        
        // Rescate seguro del userId de Telegram WebApp si no está definido
        if (!this.userId && window.Telegram && window.Telegram.WebApp.initDataUnsafe?.user) {
            this.userId = window.Telegram.WebApp.initDataUnsafe.user.id;
        }

        if (window.TON_CONNECT_UI && typeof TON_CONNECT_UI !== 'undefined') {
            // Instanciamos el conector TonConnect estilo Fragment si no está creado
            if (!this.tonConnectUI) {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                    manifestUrl: window.location.origin + '/tonconnect-manifest.json'
                });

                // Escuchar cambios de conexión de forma totalmente asíncrona y segura
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
        
        // Convertimos los TON a nanotons (1 TON = 10^9 nanotons)
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

        if (!response.ok) {
            throw new Error("El pago se realizó pero el servidor no pudo registrar la recarga.");
        }

        if (typeof this.refreshUserData === 'function') {
            await this.refreshUserData();
        }
        this.showToast(`¡Recarga exitosa! +${alphaAmount} $ALPHA 🚀`);
    } catch (err) {
        console.error("[RECHARGE ERROR]:", err);
        this.showToast('⚠️ Transacción cancelada o fallida.');
    }
},

// Método universal para cambiar entre vistas sin bloqueos
switchView(viewName) {
    const views = ['consent', 'login', 'captcha', 'register', 'lang', 'feed', 'upload'];
    
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            el.classList.add('hidden');
        }
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    } else {
        console.error(`[VIEW ERROR]: No se encontró la vista view-${viewName}`);
    }
},

// Acción al presionar el botón de aceptación +18
acceptConsent() {
    this.haptic('medium');
    try {
        localStorage.setItem('alpha_consent', 'true');
    } catch (e) {
        console.warn("Storage warning:", e);
    }
    this.switchView('login');
}