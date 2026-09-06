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

    setTargetUser(targetId, targetName = 'Usuario') {
        this.activeTargetUserId = targetId ? String(targetId) : null;
        this.activeTargetName = targetName;
        
        const headerTitle = document.getElementById('crm-chat-title') || document.getElementById('chat-title');
        if (headerTitle) {
            headerTitle.innerText = targetId ? `CHAT CON @${targetName}` : "CENTRO DE MANDO CRM";
        }

        // 🛡️ Notificar lectura instantánea ('R') al abrir o cambiar de chat privado
        if (targetId && this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: targetId }));
        }
    },

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
            console.log("[CRM] Centro de mando conectado.");
            if (this.activeTargetUserId) {
                this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: this.activeTargetUserId }));
            }
        };

        this.crmSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.is_error || data.type === 'tier_error') {
                    if (typeof app !== 'undefined') {
                        app.showToast(data.message || 'Acceso restringido.');
                    }
                } else if (data.type === 'delete_msg') {
                    const bubble = document.getElementById(`media-menu-${data.msg_id}`)?.closest('.flex-col');
                    if (bubble) bubble.remove();
                } else if (data.type === 'messages_read') {
                    // Actualizar marca de lectura 'R' instantánea
                    document.querySelectorAll('.msg-status-indicator').forEach(el => {
                        el.innerText = 'R';
                        el.className = 'text-[9px] text-cyan-400 font-bold ml-1.5 msg-status-indicator';
                        el.title = 'Leído';
                    });
                } else {
                    if (typeof app !== 'undefined') {
                        app.appendChatMessage(data, 'chat-messages');
                        app.scrollToBottom('chat-messages');
                        
                        if (String(data.user_id) === String(this.activeTargetUserId)) {
                            this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: data.user_id }));
                        }
                    }
                }
            } catch (e) {
                console.error("[CRM] Error procesando mensaje:", e);
            }
        };

        this.crmSocket.onclose = () => {
            if (this.reconnectAttemptsCRM < this.maxReconnectAttempts) {
                this.reconnectAttemptsCRM++;
                setTimeout(() => this.initCRM(userId, baseUrl), this.reconnectDelay);
            }
        };

        this.crmSocket.onerror = (err) => {
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
                } else if (data.type === 'online_count_update') {
                    const countEl = document.getElementById('online-users-count');
                    if (countEl && data.count !== undefined) {
                        countEl.innerText = data.count;
                    }
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
            if (this.reconnectAttemptsGlobal < this.maxReconnectAttempts) {
                this.reconnectAttemptsGlobal++;
                setTimeout(() => this.initGlobal(userId, baseUrl), this.reconnectDelay);
            }
        };

        this.globalSocket.onerror = (err) => {
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
                if (typeof app !== 'undefined') app.showToast("⚠️ Error al transmitir mensaje.");
                return false;
            }
        }
        return false;
    },

    sendGlobal(payload) {
        if (this.globalSocket && this.globalSocket.readyState === WebSocket.OPEN) {
            const finalPayload = typeof payload === 'object' ? JSON.stringify(payload) : payload;
            try {
                this.globalSocket.send(finalPayload);
                return true;
            } catch (err) {
                return false;
            }
        }
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