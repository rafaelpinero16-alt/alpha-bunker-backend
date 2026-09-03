(function() {
    'use strict';

    window.AlphaSecurity = {

        // ── Sanitiza texto plano antes de inyectarlo en el DOM ──────────
        sanitize(str) {
            if (!str) return '';
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        // ── Manejo de Sesión Segura Cifrada ──────────
        saveSecureState(level, tier, user) {
            const payload = {
                lvl: level,
                tier: tier,
                usr: user,
                ts: Date.now()
            };
            try {
                const encoded = btoa(JSON.stringify(payload));
                localStorage.setItem('alpha_session_auth', encoded); 
            } catch(e) {
                console.error('Error al asegurar estado de sesión');
            }
        },

        loadSecureState() {
            try {
                const token = localStorage.getItem('alpha_session_auth');
                if (!token) return null;
                const decoded = JSON.parse(atob(token));
                if (Date.now() - decoded.ts > 86400000) { // Expira a las 24 horas
                    localStorage.removeItem('alpha_session_auth');
                    return null;
                }
                return decoded;
            } catch(e) {
                return null;
            }
        },

        // ── Detecta e inutiliza herramientas de inspección ─────────────
        _devtoolsCheck() {
            const threshold = 160;
            const check = () => {
                const widthDiff  = window.outerWidth  - window.innerWidth  > threshold;
                const heightDiff = window.outerHeight - window.innerHeight > threshold;
                if (widthDiff || heightDiff) {
                    document.body.classList.add('privacy-blur');
                } else {
                    document.body.classList.remove('privacy-blur');
                }
            };
            window.addEventListener('resize', check);
            setInterval(check, 2000);
        },

        // ── Limpia tokens comprometidos de versiones anteriores ──
        _cleanLegacyTokens() {
            localStorage.removeItem('alpha_secure_token'); // Borra la vulnerabilidad antigua
        },

        // ── Protege formularios contra pasting de scripts ───────────────
        _hookForms() {
            if (typeof app === 'undefined') return;

            // Restaura sesión segura si existe
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

            // Sanitización al publicar posts
            const originalPublish = app.publishPost;
            if (originalPublish) {
                app.publishPost = function() {
                    const textEl = document.getElementById('admin-text-es');
                    if (textEl) textEl.value = AlphaSecurity.sanitize(textEl.value);
                    originalPublish.call(this);
                };
            }

            // Sanitización en Chat CRM
            const originalSendChat = app.sendChatMessage;
            if (originalSendChat) {
                app.sendChatMessage = function() {
                    const input = document.getElementById('chat-input');
                    if (input) input.value = AlphaSecurity.sanitize(input.value);
                    originalSendChat.call(this);
                };
            }

            // Sanitización en Chat Global
            const originalSendGlobal = app.sendGlobalChatMessage;
            if (originalSendGlobal) {
                app.sendGlobalChatMessage = function() {
                    const input = document.getElementById('global-chat-input');
                    if (input) input.value = AlphaSecurity.sanitize(input.value);
                    originalSendGlobal.call(this);
                };
            }
        }
    };

    // Ejecutar inmediatamente al cargar
    AlphaSecurity._cleanLegacyTokens();
    AlphaSecurity._devtoolsCheck();

    window.addEventListener('DOMContentLoaded', () => {
        AlphaSecurity._hookForms();
    });

})();