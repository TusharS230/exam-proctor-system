// Shared WebSocket Connection Manager
class ProctorWebSocket {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.stompClient = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.onConnectCallbacks = [];
        this.onDisconnectCallbacks = [];
        this.stopped = false; // true after logout or exam submit, so we don't reconnect
    }

    resolveWsUrl() {
        if (this.wsUrl) return this.wsUrl;
        if (typeof ApiClient !== 'undefined' && ApiClient.BASE_URL) {
            return ApiClient.BASE_URL.replace('/api/v1', '') + '/ws-proctor';
        }
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:8080/ws-proctor' : 'https://exam-proctor-system.onrender.com/ws-proctor';
    }

    connect(token, tenantId = sessionStorage.getItem('tenant_id')) {
        if (!token) {
            console.error("JWT Token is required to connect");
            return;
        }

        if (this.isConnected || this.isConnecting) {
            return;
        }
        this.stopped = false;

        if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
            console.warn("SockJS or Stomp library is not loaded.");
            return;
        }

        this.isConnecting = true;
        const targetUrl = this.resolveWsUrl();
        const socket = new SockJS(targetUrl);
        this.stompClient = Stomp.over(socket);

        // Disable debug logs in production
        this.stompClient.debug = null;

        const headers = {
            'Authorization': 'Bearer ' + token,
            'X-Tenant-ID': tenantId
        };

        this.stompClient.connect(headers,
            (frame) => {
                this.isConnected = true;
                this.isConnecting = false;
                this.onConnectCallbacks.forEach(cb => {
                    try { cb(frame); } catch(e) { console.error("Error in onConnect callback:", e); }
                });
            },
            (error) => {
                this.isConnected = false;
                this.isConnecting = false;
                console.error('WebSocket connection error:', error);
                this.onDisconnectCallbacks.forEach(cb => {
                    try { cb(error); } catch(e) { console.error("Error in onDisconnect callback:", e); }
                });

                // try again in 5 seconds, unless we disconnected on purpose or logged out
                setTimeout(() => {
                    if (!this.stopped && sessionStorage.getItem('jwt_token')) {
                        this.connect(token, tenantId);
                    }
                }, 5000);
            }
        );
    }

    disconnect() {
        this.stopped = true;
        if (this.stompClient !== null && this.isConnected) {
            this.stompClient.disconnect(() => {
                this.isConnected = false;
                this.isConnecting = false;
                this.onDisconnectCallbacks.forEach(cb => {
                    try { cb(); } catch(e) { console.error("Error in onDisconnect callback:", e); }
                });
            });
        }
    }

    subscribeToAlerts(attemptId, callback) {
        if (!this.isConnected || !this.stompClient) {
            console.error("Cannot subscribe: WebSocket is not connected.");
            return null;
        }
        const topicPath = `/topic/proctor/alerts/${attemptId}`;
        return this.stompClient.subscribe(topicPath, (message) => {
            if (message.body) {
                callback(JSON.parse(message.body));
            }
        });
    }

    subscribeToTenantAlerts(tenantId, callback) {
        if (!this.isConnected || !this.stompClient) {
            console.error("Cannot subscribe: WebSocket is not connected.");
            return null;
        }
        const topicPath = `/topic/proctor/tenant/${tenantId}`;
        return this.stompClient.subscribe(topicPath, (message) => {
            if (message.body) {
                callback(JSON.parse(message.body));
            }
        });
    }

    subscribeToMessages(role, userId, orgId, callback) {
        if (!this.isConnected || !this.stompClient) {
            console.error("Cannot subscribe to messages: WebSocket is not connected.");
            return [];
        }

        const subscriptions = [];
        const handleMessage = (message) => {
            if (message.body) {
                callback(JSON.parse(message.body));
            }
        };

        // Everyone receives direct messages
        if (userId) {
            subscriptions.push(this.stompClient.subscribe(`/topic/user/${userId}/messages`, handleMessage));
        }

        // Org admins receive messages sent to the org inbox
        if (role === 'ORG_ADMIN' && orgId) {
            subscriptions.push(this.stompClient.subscribe(`/topic/org/${orgId}/messages`, handleMessage));
        }

        // Super admins receive messages sent to the general inbox
        if (role === 'SUPER_ADMIN') {
            subscriptions.push(this.stompClient.subscribe(`/topic/superadmin/messages`, handleMessage));
        }

        return subscriptions;
    }

    sendViolation(attemptId, violationType, details = "") {
        if (!this.isConnected || !this.stompClient) {
            console.error("Cannot send violation: WebSocket is not connected.");
            return false;
        }
        const destination = `/app/proctor/violation`;
        const payload = JSON.stringify({
            examAttemptId: attemptId,
            eventType: violationType,
            details: details,
            timestamp: new Date().toISOString()
        });

        this.stompClient.send(destination, {}, payload);
        return true;
    }

    onConnect(callback) {
        if (typeof callback !== 'function') return;
        this.onConnectCallbacks.push(callback);
        if (this.isConnected) {
            try { callback(); } catch(e) { console.error("Error in onConnect callback:", e); }
        }
    }

    onDisconnect(callback) {
        if (typeof callback !== 'function') return;
        this.onDisconnectCallbacks.push(callback);
    }
}

// Global shared WebSocket instance
if (typeof window !== 'undefined') {
    window.proctorWS = new ProctorWebSocket();
}

