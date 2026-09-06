const BunkerChat = {
    crmSocket: null,
    globalSocket: null,
    reconnectAttemptsCRM: 0,
    reconnectAttemptsGlobal: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    activeTargetUserId: null,
    activeTargetName: null,

    getWsUrl(baseUrl) {
        return baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    },

    // 🛡️ Centro de Mando: Fijar usuario objetivo para chat directo
    setTargetUser(targetId, targetName = 'Usuario') {
        this.activeTargetUserId = targetId ? String(targetId) : null;
        this.activeTargetName = targetName;
        console.log(`[CRM] Canal fijado con: @${targetName} (ID: ${targetId || 'Soporte General'})`);
    },

    // 🛡️ Validar permiso de rango antes de emitir mensaje
    validateTierAccess(requiredTier = 1) {
        if (typeof app === 'undefined') return true;
        const userTier = app.userData?.access_tier || 0;
        const isAdmin = typeof app.isAdminUser === 'function' ? app.isAdminUser() : false;
        
        if (!isAdmin && userTier < requiredTier) {
            const rankBadge = typeof app.getRankBadge === 'function' ? app.getRankBadge(requiredTier) : { name: `Nivel ${requiredTier}` };
            app.showToast(`Requiere rango ${rankBadge.name} para este canal`);
            if (typeof app.openCatalogPackages === 'function') {
                setTimeout(() => app.openCatalogPackages(), 1200);
            }
            return false;
        }
        return true;
    },

    initCRM(userId, baseUrl) {
        if (this.crmSocket && (this.crmSocket.readyState === WebSocket.OPEN || this.crmSocket.readyState === WebSocket.CONNECTING)) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/ws/${userId}`;
        this.crmSocket = new WebSocket(wsUrl);

        this.crmSocket.onopen = () => {
            this.reconnectAttemptsCRM = 0;
            console.log("[CRM] Centro de mando conectado exitosamente.");
        };

        this.crmSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.is_error || data.type === 'tier_error') {
                    if (typeof app !== 'undefined') {
                        app.showToast(data.message || 'Acceso restringido por rango de suscripción.');
                    }
                } else if (data.type === 'delete_msg') {
                    const bubble = document.getElementById(`media-menu-${data.msg_id}`)?.closest('.flex-col');
                    if (bubble) bubble.remove();
                } else {
                    if (typeof app !== 'undefined') {
                        app.appendChatMessage(data, 'chat-messages');
                        app.scrollToBottom('chat-messages');
                    }
                }
            } catch (e) {
                console.error("[CRM] Error procesando mensaje del centro de mando:", e);
            }
        };

        this.crmSocket.onclose = () => {
            console.warn("[CRM] Conexión cerrada. Reintentando...");
            if (this.reconnectAttemptsCRM < this.maxReconnectAttempts) {
                this.reconnectAttemptsCRM++;
                setTimeout(() => this.initCRM(userId, baseUrl), this.reconnectDelay);
            } else {
                if (typeof app !== 'undefined') app.showToast("⚠️ Centro de mando CRM desconectado. Recarga la app.");
            }
        };

        this.crmSocket.onerror = (err) => {
            console.error("[CRM] Error de WebSocket:", err);
            this.crmSocket.close();
        };
    },

    initGlobal(userId, baseUrl) {
        if (this.globalSocket && (this.globalSocket.readyState === WebSocket.OPEN || this.globalSocket.readyState === WebSocket.CONNECTING)) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/global/ws/${userId}`;
        this.globalSocket = new WebSocket(wsUrl);

        this.globalSocket.onopen = () => {
            this.reconnectAttemptsGlobal = 0;
            console.log("[GLOBAL] Socket global activo.");
        };

        this.globalSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.is_error) {
                    if (typeof app !== 'undefined') app.showToast(data.message);
                } else if (data.type && data.type.startsWith('webrtc_')) {
                    if (typeof app !== 'undefined') app.handleWebRTCMessage(data);
                } else if (data.type === 'radar_update') {
                    if (typeof app !== 'undefined') app.handleRadarUpdate(data);
                } else if (data.type === 'delete_msg') {
                    const bubble = document.getElementById(`media-menu-${data.msg_id}`)?.closest('.flex-col');
                    if (bubble) bubble.remove();
                } else {
                    if (typeof app !== 'undefined') {
                        app.appendChatMessage(data, 'global-chat-messages');
                        app.scrollToBottom('global-chat-messages');
                    }
                }
            } catch (e) {
                console.error("[GLOBAL] Error procesando payload:", e);
            }
        };

        this.globalSocket.onclose = () => {
            console.warn("[GLOBAL] Conexión perdida. Intentando reconectar...");
            if (this.reconnectAttemptsGlobal < this.maxReconnectAttempts) {
                this.reconnectAttemptsGlobal++;
                setTimeout(() => this.initGlobal(userId, baseUrl), this.reconnectDelay);
            } else {
                if (typeof app !== 'undefined') app.showToast("⚠️ Chat Global desconectado. Recarga la app.");
            }
        };

        this.globalSocket.onerror = (err) => {
            console.error("[GLOBAL] Error en socket:", err);
            this.globalSocket.close();
        };
    },

    sendCRM(payload, requiredTier = 0) {
        if (!this.validateTierAccess(requiredTier)) return false;

        if (this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            let finalPayload = payload;

            if (typeof payload === 'string') {
                try {
                    const parsed = JSON.parse(payload);
                    parsed.target_id = this.activeTargetUserId || null;
                    parsed.sender_tier = (typeof app !== 'undefined') ? (app.userData?.access_tier || 0) : 0;
                    finalPayload = JSON.stringify(parsed);
                } catch (e) {}
            } else if (typeof payload === 'object') {
                payload.target_id = this.activeTargetUserId || null;
                payload.sender_tier = (typeof app !== 'undefined') ? (app.userData?.access_tier || 0) : 0;
                finalPayload = JSON.stringify(payload);
            }

            try {
                this.crmSocket.send(finalPayload);
                return true;
            } catch (err) {
                console.error("[CRM] Error al enviar paquete multimedia:", err);
                if (typeof app !== 'undefined') app.showToast("⚠️ Archivo demasiado pesado para transmitir.");
                return false;
            }
        }
        console.warn("[CRM] Socket inactivo.");
        return false;
    },

    sendGlobal(payload) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            const finalPayload = typeof payload === 'object' ? JSON.stringify(payload) : payload;
            try {
                this.globalSocket.send(finalPayload);
                return true;
            } catch (err) {
                console.error("[GLOBAL] Error al enviar multimedia al global:", err);
                if (typeof app !== 'undefined') app.showToast("⚠️ El archivo multimedia excede el límite del canal.");
                return false;
            }
        }
        console.warn("[GLOBAL] Socket inactivo.");
        return false;
    },
    
    closeConnections() {
        if (this.crmSocket) {
            this.crmSocket.close();
            this.crmSocket = null;
        }
        if (this.globalSocket) {
            this.globalSocket.close();
            this.globalSocket = null;
        }
    }
};

window.BunkerChat = BunkerChat;