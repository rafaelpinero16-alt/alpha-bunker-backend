const BunkerChat = {
    crmSocket: null,
    globalSocket: null,
    reconnectAttemptsCRM: 0,
    reconnectAttemptsGlobal: 0,

    getWsUrl(baseUrl) {
        return baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    },

    initCRM(userId, baseUrl) {
        if (this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/ws/${userId}`;
        this.crmSocket = new WebSocket(wsUrl);

        this.crmSocket.onopen = () => {
            this.reconnectAttemptsCRM = 0;
            console.log("CRM Socket conectado.");
        };

        this.crmSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.is_error) {
                    if (typeof app !== 'undefined') app.showToast(data.message);
                } else {
                    if (typeof app !== 'undefined') {
                        app.appendChatMessage(data, 'chat-messages');
                        app.scrollToBottom('chat-messages');
                    }
                }
            } catch (e) {
                console.error("Error parseando mensaje CRM", e);
            }
        };

        this.crmSocket.onclose = () => {
            if (this.reconnectAttemptsCRM < 5) {
                this.reconnectAttemptsCRM++;
                setTimeout(() => this.initCRM(userId, baseUrl), 2000);
            }
        };
    },

    initGlobal(userId, baseUrl) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/global/ws/${userId}`;
        this.globalSocket = new WebSocket(wsUrl);

        this.globalSocket.onopen = () => {
            this.reconnectAttemptsGlobal = 0;
            console.log("Global Socket conectado.");
        };

        this.globalSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.is_error) {
                    if (typeof app !== 'undefined') app.showToast(data.message);
                } else {
                    if (typeof app !== 'undefined') {
                        app.appendChatMessage(data, 'global-chat-messages');
                        app.scrollToBottom('global-chat-messages');
                    }
                }
            } catch (e) {
                console.error("Error parseando mensaje Global", e);
            }
        };

        this.globalSocket.onclose = () => {
            if (this.reconnectAttemptsGlobal < 5) {
                this.reconnectAttemptsGlobal++;
                setTimeout(() => this.initGlobal(userId, baseUrl), 2000);
            }
        };
    },

    sendCRM(payload) {
        if (this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            this.crmSocket.send(payload);
            return true;
        }
        return false;
    },

    sendGlobal(payload) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(payload);
            return true;
        }
        return false;
    }
};

window.BunkerChat = BunkerChat;