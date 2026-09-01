const BunkerChat = {
    socket: null,
    globalSocket: null,

    initCRM(userId, backendUrl) {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        const wsProtocol = backendUrl.startsWith('https') ? 'wss://' : 'ws://';
        const cleanUrl = backendUrl.replace(/^https?:\/\//, '');
        this.socket = new WebSocket(`${wsProtocol}${cleanUrl}/chat/ws/${userId}`);

        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                app.appendChatMessage(msg, 'chat-messages');
                app.scrollToBottom('chat-messages');
            } catch (e) {}
        };
    },

    initGlobal(userId, backendUrl) {
        if (this.globalSocket && (this.globalSocket.readyState === WebSocket.OPEN || this.globalSocket.readyState === WebSocket.CONNECTING)) {
            return; // Evita el bucle masivo de conexiones que viste en los logs
        }
        if (this.globalSocket) {
            this.globalSocket.close();
            this.globalSocket = null;
        }

        const wsProtocol = backendUrl.startsWith('https') ? 'wss://' : 'ws://';
        const cleanUrl = backendUrl.replace(/^https?:\/\//, '');
        this.globalSocket = new WebSocket(`${wsProtocol}${cleanUrl}/chat/global/ws/${userId}`);

        this.globalSocket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.is_error) {
                    app.showToast(msg.message);
                } else {
                    app.appendChatMessage(msg, 'global-chat-messages');
                    app.scrollToBottom('global-chat-messages');
                }
            } catch (e) {}
        };

        this.globalSocket.onclose = () => {
            setTimeout(() => this.initGlobal(userId, backendUrl), 3000);
        };
    },

    sendGlobal(payload) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            this.globalSocket.send(payload);
            return true;
        }
        return false;
    },

    sendCRM(payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(payload);
            return true;
        }
        return false;
    }
};

window.BunkerChat = BunkerChat;