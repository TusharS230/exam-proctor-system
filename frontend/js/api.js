class ApiClient {
    static BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8080/api/v1' 
        : 'https://exam-proctor-system.onrender.com/api/v1';
    static activeRequests = 0;

    static startLoading() {
        this.activeRequests++;
        let bar = document.getElementById('global-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'global-progress-bar';
            bar.style.cssText = 'position:fixed; top:0; left:0; height:3px; background-color:var(--primary-color); z-index:9999; transition:width 0.2s ease, opacity 0.3s ease; width:0; opacity:1; box-shadow:0 0 10px var(--primary-color);';
            document.body.appendChild(bar);
        }
        bar.style.opacity = '1';
        bar.style.width = '30%';
    }

    static stopLoading() {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        if (this.activeRequests === 0) {
            const bar = document.getElementById('global-progress-bar');
            if (bar) {
                bar.style.width = '100%';
                setTimeout(() => {
                    if (this.activeRequests === 0) {
                        bar.style.opacity = '0';
                        setTimeout(() => {
                            if (this.activeRequests === 0) bar.style.width = '0';
                        }, 300);
                    }
                }, 200);
            }
        }
    }

    static getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = sessionStorage.getItem('jwt_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const tenantId = sessionStorage.getItem('tenant_id');
        if (tenantId) {
            headers['X-Tenant-ID'] = tenantId;
        }

        return headers;
    }

    static async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        this.startLoading();
        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                // Unauthorized, clear tokens and redirect to login
                sessionStorage.removeItem('jwt_token');
                sessionStorage.removeItem('tenant_id');
                window.location.href = 'index.html';
                return null;
            }

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: 'An unexpected error occurred.' };
                }
                throw new Error(errorData.message || `Request failed with status ${response.status}`);
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }

        } catch (error) {
            console.error('API Request Error:', error);
            if (window.Toast) {
                window.Toast.error(error.message || 'Network error. Please try again.');
            }
            throw error;
        } finally {
            this.stopLoading();
        }
    }

    static get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    static post(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });
    }

    static put(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) });
    }

    static delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

window.ApiClient = ApiClient;

// Global UI Utility
window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
    } else {
        input.type = 'password';
        btn.textContent = 'Show';
    }
};

// Global User Profile Fetch and Modal Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const profileBtn = document.getElementById('userProfileBtn');
    if (!profileBtn) return; // Only execute if sidebar exists on page

    const token = sessionStorage.getItem('jwt_token');
    if (!token) return;

    try {
        const user = await ApiClient.get('/users/me');
        if (user) {
            // Enforce role-based routing to prevent cross-tab token leaking
            const path = window.location.pathname;
            const isStudentPage = path.includes('student-');
            const isSuperAdminPage = path.includes('super-admin') || path.includes('organizations') || path.includes('onboard-tenant');
            const isSettingsPage = path.includes('settings') && !path.includes('super-admin-settings');
            const isAuthPage = path.includes('index') || path === '/' || path.endsWith('/');
            
            if (!isAuthPage) {
                if (user.role === 'STUDENT' && !isStudentPage) {
                    window.location.href = path.includes('settings') ? 'student-settings.html' : 'student-dashboard.html';
                    return;
                }
                if (user.role === 'ORG_ADMIN' && (isStudentPage || isSuperAdminPage)) {
                    window.location.href = path.includes('settings') ? 'settings.html' : 'dashboard.html';
                    return;
                }
                if (user.role === 'SUPER_ADMIN' && !isSuperAdminPage && !isSettingsPage) {
                    window.location.href = 'super-admin.html';
                    return;
                }
            }

            // Update sidebar profile
            const nameEl = document.getElementById('sidebarName');
            const tenantEl = document.getElementById('sidebarTenant');
            const avatarEl = document.getElementById('sidebarAvatar');
            
            const name = user.email.split('@')[0];
            const tenant = user.organization ? user.organization.tenantSlug : (user.role === 'SUPER_ADMIN' ? 'System Owner' : 'Unknown');
            const role = user.role;
            const letter = role === 'SUPER_ADMIN' ? 'S' : name.charAt(0).toUpperCase();

            if (nameEl) nameEl.textContent = role === 'SUPER_ADMIN' ? 'Super Admin' : (role === 'ORG_ADMIN' ? 'Admin' : name);
            if (tenantEl) tenantEl.textContent = tenant;
            if (avatarEl) {
                avatarEl.textContent = letter;
                if (role === 'SUPER_ADMIN') avatarEl.style.background = 'var(--danger)';
            }

            // Create Modal
            const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
            const modalHTML = `
                <div class="profile-modal-overlay" id="profileModalOverlay">
                    <div class="profile-modal">
                        <button class="profile-modal-close" onclick="document.getElementById('profileModalOverlay').classList.remove('active')">&times;</button>
                        <div class="profile-modal-header">
                            <div class="profile-modal-avatar" style="${role === 'SUPER_ADMIN' ? 'background: var(--danger);' : ''}">${letter}</div>
                            <div>
                                <h2 style="margin: 0; font-size: 1.25rem; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${user.email}</h2>
                                <p style="margin: 0; color: var(--text-secondary); text-transform: capitalize;">${role.replace('_', ' ').toLowerCase()}</p>
                            </div>
                        </div>
                        <div class="profile-detail-row">
                            <span class="profile-detail-label">Organization</span>
                            <span class="profile-detail-value">${tenant}</span>
                        </div>
                        <div class="profile-detail-row">
                            <span class="profile-detail-label">Active Since</span>
                            <span class="profile-detail-value">${createdDate}</span>
                        </div>
                        <div class="profile-detail-row">
                            <span class="profile-detail-label">Account Status</span>
                            <span class="profile-detail-value" style="color: var(--success);">Active</span>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Hook up click
            profileBtn.addEventListener('click', () => {
                document.getElementById('profileModalOverlay').classList.add('active');
            });

            // Close on outside click
            document.getElementById('profileModalOverlay').addEventListener('click', (e) => {
                if(e.target.id === 'profileModalOverlay') {
                    e.target.classList.remove('active');
                }
            });

            // GLOBAL WEBSOCKET CONNECTION
            if (typeof ProctorWebSocket !== 'undefined') {
                const wsUrl = ApiClient.BASE_URL.replace('/api/v1', '') + '/ws-proctor';
                const wsClient = new ProctorWebSocket(wsUrl);
                
                wsClient.onConnect(() => {
                    console.log("Global WebSocket connected.");
                    const orgId = user.organization ? user.organization.id : null;
                    wsClient.subscribeToMessages(user.role, user.id, orgId, (newMsg) => {
                        if (newMsg.senderId === user.id) return;
                        
                        // Dispatch event so messages.js can update the thread view
                        const event = new CustomEvent('newMessageReceived', { detail: newMsg });
                        document.dispatchEvent(event);

                        // Global Toast Notification
                        if (typeof Toast !== 'undefined') {
                            Toast.info(`New message from ${newMsg.senderEmail}: ${newMsg.subject || 'No Subject'}`);
                        }

                        // Add Notification Dot to Sidebar
                        const messagesLink = document.querySelector('a[href*="messages.html"]');
                        if (messagesLink && !messagesLink.querySelector('.msg-dot')) {
                            const dot = document.createElement('span');
                            dot.className = 'msg-dot';
                            dot.style.cssText = 'display:inline-block; width:8px; height:8px; background:var(--danger); border-radius:50%; margin-left:auto;';
                            messagesLink.appendChild(dot);
                        }
                    });
                });
                wsClient.connect(token, tenant);
            }
        }
    } catch(e) {
        console.error("Failed to load user profile:", e);
    }
});
