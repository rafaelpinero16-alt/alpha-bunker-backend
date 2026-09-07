const BunkerChat = {
    crmSocket: null,
    globalSocket: null,
    reconnectAttemptsCRM: 0,
    reconnectAttemptsGlobal: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 2000,
    activeTargetUserId: null,
    activeTargetName: null,
    currentUserId: null,

    getWsUrl(baseUrl) {
        if (!baseUrl) return '';
        return baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    },

    setTargetUser(targetId, targetName = 'Usuario') {
        // 🛡️ Sanitización estricta: Evitar strings "null" o "undefined" que rompen el backend
        if (targetId && targetId !== 'null' && targetId !== 'undefined' && !isNaN(targetId)) {
            this.activeTargetUserId = String(targetId);
        } else {
            this.activeTargetUserId = null;
        }
        this.activeTargetName = targetName;
        
        const headerTitle = document.getElementById('crm-chat-title') || document.getElementById('chat-title');
        if (headerTitle) {
            headerTitle.innerText = this.activeTargetUserId ? `CHAT CON @${targetName}` : "DMs (MENSAJES DIRECTOS)";
        }

        // Notificar lectura instantánea ('R') al abrir o cambiar de chat privado
        if (this.activeTargetUserId && this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: parseInt(this.activeTargetUserId) }));
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
        if (!userId) return;
        this.currentUserId = String(userId);
        
        // Si ya está activo y abierto, reutilizar la conexión
        if (this.crmSocket && (this.crmSocket.readyState === WebSocket.OPEN || this.crmSocket.readyState === WebSocket.CONNECTING)) {
            if (this.activeTargetUserId && this.crmSocket.readyState === WebSocket.OPEN) {
                this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: parseInt(this.activeTargetUserId) }));
            }
            return;
        }
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/ws/${userId}`;
        try {
            this.crmSocket = new WebSocket(wsUrl);

            this.crmSocket.onopen = () => {
                this.reconnectAttemptsCRM = 0;
                console.log("[CRM] Centro de mando y DMs conectado.");
                if (this.activeTargetUserId) {
                    this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: parseInt(this.activeTargetUserId) }));
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
                        document.querySelectorAll('.msg-status-indicator').forEach(el => {
                            el.innerText = 'R';
                            el.className = 'text-[9px] text-cyan-400 font-bold ml-1.5 msg-status-indicator';
                            el.title = 'Leído';
                        });
                    } else {
                        if (typeof app !== 'undefined') {
                            const senderId = String(data.user_id);
                            const recipientId = data.recipient_id ? String(data.recipient_id) : null;
                            const myId = String(this.currentUserId || app.userId);
                            const activeTarget = this.activeTargetUserId ? String(this.activeTargetUserId) : null;

                            // Verificar si el mensaje pertenece estrictamente al chat abierto
                            const isCurrentConversation = activeTarget && (
                                (senderId === activeTarget && recipientId === myId) ||
                                (senderId === myId && recipientId === activeTarget)
                            );

                            if (isCurrentConversation || (!activeTarget && !recipientId)) {
                                app.appendChatMessage(data, 'chat-messages');
                                app.scrollToBottom('chat-messages');
                                
                                if (senderId === activeTarget && this.crmSocket?.readyState === WebSocket.OPEN) {
                                    this.crmSocket.send(JSON.stringify({ type: 'mark_read', target_id: parseInt(activeTarget) }));
                                }
                            } else if (senderId !== myId) {
                                app.showToast(`📩 Nuevo mensaje de @${data.author_name || senderId}`);
                                const inboxView = document.getElementById('dm-inbox-view');
                                if (inboxView && !inboxView.classList.contains('hidden')) {
                                    app.loadConversations();
                                }
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
                if (this.crmSocket) this.crmSocket.close();
            };
        } catch(e) {
            console.error("[CRM WS INIT ERROR]", e);
        }
    },

    initGlobal(userId, baseUrl) {
        if (!userId) return;
        if (this.globalSocket && (this.globalSocket.readyState === WebSocket.OPEN || this.globalSocket.readyState === WebSocket.CONNECTING)) return;
        
        const wsUrl = `${this.getWsUrl(baseUrl)}/chat/global/ws/${userId}`;
        try {
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
                if (this.globalSocket) this.globalSocket.close();
            };
        } catch(e) {
            console.error("[GLOBAL WS INIT ERROR]", e);
        }
    },

    sendCRM(payload, requiredTier = 0) {
        if (!this.validateTierAccess(requiredTier)) return false;

        if (this.crmSocket && this.crmSocket.readyState === WebSocket.OPEN) {
            let targetVal = null;
            if (this.activeTargetUserId && !isNaN(this.activeTargetUserId)) {
                targetVal = parseInt(this.activeTargetUserId);
            }
            const senderTier = (typeof app !== 'undefined') ? (app.userData?.access_tier || 0) : 0;

            let finalPayload;
            if (typeof payload === 'string') {
                try {
                    const parsed = JSON.parse(payload);
                    parsed.target_id = targetVal;
                    parsed.sender_tier = senderTier;
                    finalPayload = JSON.stringify(parsed);
                } catch (e) {
                    finalPayload = JSON.stringify({ text: payload, target_id: targetVal, sender_tier: senderTier });
                }
            } else if (typeof payload === 'object') {
                payload.target_id = targetVal;
                payload.sender_tier = senderTier;
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