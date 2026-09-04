const BunkerChat = {
    crmSocket: null,
    globalSocket: null,
    reconnectAttemptsCRM: 0,
    reconnectAttemptsGlobal: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,

    getWsUrl(baseUrl) {
        return baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    },

    initCRM(userId, baseUrl) {
        if (this.crmSocket && (this.crmSocket.readyState === WebSocket.OPEN || this.crmSocket.readyState === WebSocket.CONNECTING)) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/ws/${userId}`;
        this.crmSocket = new WebSocket(wsUrl);

        this.crmSocket.onopen = () => {
            this.reconnectAttemptsCRM = 0;
            console.log("[CRM] Socket conectado exitosamente.");
        };

        this.crmSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.is_error) {
                    if (typeof app !== 'undefined') app.showToast(data.message);
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
                console.error("[CRM] Error procesando mensaje:", e);
            }
        };

        this.crmSocket.onclose = () => {
            console.warn("[CRM] Conexión perdida. Intentando reconectar...");
            if (this.reconnectAttemptsCRM < this.maxReconnectAttempts) {
                this.reconnectAttemptsCRM++;
                setTimeout(() => this.initCRM(userId, baseUrl), this.reconnectDelay);
            } else {
                if (typeof app !== 'undefined') app.showToast("⚠️ CRM desconectado. Por favor, recarga la aplicación.");
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
            console.log("[GLOBAL] Socket conectado exitosamente.");
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
                console.error("[GLOBAL] Error procesando mensaje:", e);
            }
        };

        this.globalSocket.onclose = () => {
            console.warn("[GLOBAL] Conexión perdida. Intentando reconectar...");
            if (this.reconnectAttemptsGlobal < this.maxReconnectAttempts) {
                this.reconnectAttemptsGlobal++;
                setTimeout(() => this.initGlobal(userId, baseUrl), this.reconnectDelay);
            } else {
                if (typeof app !== 'undefined') app.showToast("⚠️ Chat Global desconectado. Por favor, recarga la aplicación.");
            }
        };

        this.globalSocket.onerror = (err) => {
            console.error("[GLOBAL] Error de WebSocket:", err);
            this.globalSocket.close();
        };
    },

    sendCRM(payload) {
        if (this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            this.crmSocket.send(payload);
            return true;
        }
        console.warn("[CRM] No se pudo enviar el mensaje, socket inactivo.");
        return false;
    },

    sendGlobal(payload) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(payload);
            return true;
        }
        console.warn("[GLOBAL] No se pudo enviar el mensaje, socket inactivo.");
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