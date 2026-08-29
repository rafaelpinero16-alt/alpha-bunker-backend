async connectWallet() {
    this.haptic('medium');
    if (window.TON_CONNECT_UI) {
        try {
            // Instanciamos el conector TonConnect estilo Fragment si no está creado
            if (!this.tonConnectUI) {
                this.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                    manifestUrl: window.location.origin + '/tonconnect-manifest.json'
                });

                // Escuchar cambios de conexión para sincronizar la wallet y recargar $ALPHA
                this.tonConnectUI.onStatusChange(async (wallet) => {
                    if (wallet) {
                        const rawAddress = wallet.account.address;
                        this.showToast('¡Billetera conectada con éxito! 💎');
                        
                        // Sincronizar la wallet con el backend en Railway
                        await fetch(`${this.backendUrl}/wallet/connect-ton`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                user_id: this.userId,
                                ton_address: rawAddress
                            })
                        });
                        await this.refreshUserData();
                    }
                });
            }
            await this.tonConnectUI.openModal();
        } catch (err) {
            console.error("[TONCONNECT ERROR]:", err);
            this.showToast('⚠️ Error abriendo la billetera.');
        }
    } else {
        this.showToast('Actualizando saldo... 💎');
        await this.refreshUserData();
    }
},

async rechargeAlphaCoins(amountTon, alphaAmount) {
    this.haptic('heavy');
    if (!this.tonConnectUI || !this.tonConnectUI.connected) {
        this.showToast('⚠️ Conecta tu billetera TON primero.');
        return;
    }
    
    try {
        // Convertimos los TON a nanotons (1 TON = 10^9 nanotons)
        const nanoTonAmount = Math.floor(amountTon * 1000000000).toString();
        
        // Estructura de la transacción hacia la wallet oficial del búnker
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 360,
            messages: [
                {
                    address: "UQDWI2auHgQ5a9KnWn9_by-RSswIaKfz38b_Yib_cIy-Jklp",
                    amount: nanoTonAmount
                }
            ]
        };

        // Despliega la ventana emergente nativa para aprobar la transacción
        const result = await this.tonConnectUI.sendTransaction(transaction);
        this.showToast('¡Pago en TON procesado! Acreditando... 💎');

        // Notificamos al backend para sumar los $ALPHA al balance
        await fetch(`${this.backendUrl}/wallet/recharge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: this.userId,
                amount_ton: amountTon,
                alpha_added: alphaAmount,
                boc: result.boc
            })
        });

        await this.refreshUserData();
        this.showToast(`¡Recarga exitosa! +${alphaAmount} $ALPHA 🚀`);
    } catch (err) {
        console.error("[RECHARGE ERROR]:", err);
        this.showToast('⚠️ Transacción cancelada o fallida.');
    }
},