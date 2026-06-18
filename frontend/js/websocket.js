// Shared WebSocket Connection Manager
class ProctorWebSocket {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.stompClient = null;
        this.isConnected = false;
        this.onConnectCallbacks = [];
        this.onDisconnectCallbacks = [];
    }

    connect(token, tenantId = sessionStorage.getItem('tenant_id')) {
        if (!token) {
            console.error("JWT Token is required to connect");
            return;
        }

        const socket = new SockJS(this.wsUrl);
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
                this.onConnectCallbacks.forEach(cb => cb(frame));
            }, 
            (error) => {
                this.isConnected = false;
                console.error('WebSocket connection error:', error);
                this.onDisconnectCallbacks.forEach(cb => cb(error));
                
                // Implement basic retry logic
                setTimeout(() => this.connect(token, tenantId), 5000);
            }
        );
    }

    disconnect() {
        if (this.stompClient !== null && this.isConnected) {
            this.stompClient.disconnect(() => {
                this.isConnected = false;
                this.onDisconnectCallbacks.forEach(cb => cb());
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
        this.onConnectCallbacks.push(callback);
    }

    onDisconnect(callback) {
        this.onDisconnectCallbacks.push(callback);
    }
}

// Initialize global instance for the app pointing to the Spring Boot backend
window.proctorWS = new ProctorWebSocket('http://localhost:8080/ws-proctor');
