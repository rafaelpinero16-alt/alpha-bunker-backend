async loginWithPhone() {
        this.haptic('medium');
        const phone = document.getElementById('phone-input')?.value.trim();
        const pass = document.getElementById('login-password')?.value.trim();
        const remember = document.getElementById('login-remember')?.checked;

        if (!phone) {
            this.showToast('⚠️ Ingresa tu número de teléfono.');
            return;
        }

        this.initUserId();
        
        // Sincronizar el usuario con el backend usando su número como identificador/nombre
        try {
            await fetch(`${this.backendUrl}/users/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: this.userId,
                    name: `Tel: ${phone}`,
                    bio: "Operativo autenticado por teléfono"
                })
            });
        } catch (e) {
            console.warn('[PHONE SYNC ERROR]:', e);
        }

        if (remember) {
            localStorage.setItem('alpha_remember_user', JSON.stringify({ phone, pass }));
        }

        localStorage.setItem('alpha_logged_in', 'true');
        localStorage.setItem('alpha_user_name', `Tel: ${phone}`);
        
        this.showToast('¡Acceso concedido al Búnker! 🛡️');
        this.switchView('feed');
        this.updateProfileUI();
        this.updateViewsCounter();
        this.refreshUserData();
        this.renderFeed();
    },

    // Eliminada la función simulateAndPay para evitar cualquier texto de prueba.