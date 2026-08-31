(function() {
    window.AlphaSecurity = {
        sanitize(str) {
            if (!str) return '';
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        saveSecureState(level, tier, user) {
            const payload = {
                lvl: level,
                tier: tier,
                usr: user,
                ts: Date.now()
            };
            try {
                const encoded = btoa(JSON.stringify(payload));
                localStorage.setItem('alpha_secure_token', encoded);
            } catch(e) {
                console.error('Error al asegurar estado de sesión');
            }
        },

        loadSecureState() {
            try {
                const token = localStorage.getItem('alpha_secure_token');
                if (!token) return null;
                const decoded = JSON.parse(atob(token));
                if (Date.now() - decoded.ts > 86400000) {
                    localStorage.removeItem('alpha_secure_token');
                    return null;
                }
                return decoded;
            } catch(e) {
                return null;
            }
        }
    };

    window.addEventListener('DOMContentLoaded', () => {
        if (typeof app !== 'undefined') {
            const secureSession = AlphaSecurity.loadSecureState();
            
            if (secureSession) {
                if (!app.isAdmin) {
                    app.userAccessLevel = secureSession.lvl;
                    app.userData.access_tier = secureSession.tier;
                    if(secureSession.usr) app.userData.name = secureSession.usr;
                }
                setTimeout(() => {
                    app.updateProfileUI();
                    app.switchView('feed');
                    app.renderFeed();
                }, 100);
            }

            // Integración segura para la publicación de posts
            const originalPublish = app.publishPost;
            if (originalPublish) {
                app.publishPost = function() {
                    const textEl = document.getElementById('admin-text-es');
                    if (textEl) {
                        textEl.value = AlphaSecurity.sanitize(textEl.value);
                    }
                    originalPublish.call(this);
                };
            }

            // Integración segura para el chat en vivo
            const originalSendChat = app.sendChatMessage;
            if (originalSendChat) {
                app.sendChatMessage = function() {
                    const input = document.getElementById('chat-input');
                    if (input) {
                        input.value = AlphaSecurity.sanitize(input.value);
                    }
                    originalSendChat.call(this);
                };
            }
        }
    });
})();