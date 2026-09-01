const BunkerChat = {
    socket: null,
    globalSocket: null,

    initCRM(userId, backendUrl) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
        if (this.socket) this.socket.close();

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
        // 🛡️ Blindaje absoluto: Si ya está conectado o conectándose, no abre otro socket jamás.
        if (this.globalSocket && (this.globalSocket.readyState === WebSocket.OPEN || this.globalSocket.readyState === WebSocket.CONNECTING)) {
            return; 
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
            setTimeout(() => {
                const modal = document.getElementById('modal-global-chat');
                if (modal && !modal.classList.contains('hidden')) {
                    this.initGlobal(userId, backendUrl);
                }
            }, 3000);
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