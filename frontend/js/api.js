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

    // log out: forget the session, close the live connection, go back to the login page
    static logout() {
        if (window.proctorWS) {
            window.proctorWS.disconnect();
        }
        sessionStorage.clear();
        window.location.href = 'index.html';
    }

    // options.silent = true hides the error toast (the page shows its own message instead)
    static async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const { silent, ...fetchOptions } = options;
        const config = {
            ...fetchOptions,
            headers: {
                ...this.getHeaders(),
                ...fetchOptions.headers
            }
        };

        this.startLoading();
        try {
            const response = await fetch(url, config);

            // 401 means the session is missing or expired: go back to login.
            // (Not for the login request itself, where 401 just means a wrong password.)
            if (response.status === 401 && !endpoint.startsWith('/auth/')) {
                this.logout();
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
            if (window.Toast && !silent) {
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

// Makes user-typed text safe to put inside innerHTML,
// so a message like "<script>..." is shown as text instead of being run.
window.escapeHtml = function(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// How far away a date is, in words: "in 25 min", "in 2 h 5 min", "in 3 days", or "5 min ago"
window.timeFromNow = function(date) {
    const diffMs = new Date(date).getTime() - Date.now();
    const minutes = Math.round(Math.abs(diffMs) / 60000);
    let text;
    if (minutes < 1) text = 'less than a minute';
    else if (minutes < 60) text = `${minutes} min`;
    else if (minutes < 60 * 24) {
        const h = Math.floor(minutes / 60), m = minutes % 60;
        text = m ? `${h} h ${m} min` : `${h} h`;
    } else {
        const days = Math.round(minutes / (60 * 24));
        text = `${days} day${days > 1 ? 's' : ''}`;
    }
    return diffMs >= 0 ? `in ${text}` : `${text} ago`;
};

// Every page except the login page needs a logged-in user
(function requireLogin() {
    const page = window.location.pathname.split('/').pop();
    const isLoginPage = page === '' || page === 'index' || page === 'index.html';
    if (!isLoginPage && !sessionStorage.getItem('jwt_token')) {
        window.location.href = 'index.html';
    }
})();

// Any button with id="logoutBtn" logs the user out
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => ApiClient.logout());
    }
});

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
            const isOrgSettingsPage = /(^|\/)settings(\.html)?$/.test(path);
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
                if (user.role === 'SUPER_ADMIN' && !isSuperAdminPage) {
                    window.location.href = isOrgSettingsPage ? 'super-admin-settings.html' : 'super-admin.html';
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
            }

            // Create Modal
            const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
            const modalHTML = `
                <div class="profile-modal-overlay" id="profileModalOverlay">
                    <div class="profile-modal">
                        <button class="profile-modal-close" onclick="document.getElementById('profileModalOverlay').classList.remove('active')">&times;</button>
                        <div class="profile-modal-header">
                            <div class="profile-modal-avatar">${letter}</div>
                            <div>
                                <h2 class="m-0 large truncate max-w-250">${escapeHtml(user.email)}</h2>
                                <p class="m-0 muted capitalize">${role.replace('_', ' ').toLowerCase()}</p>
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
                            <span class="profile-detail-value text-blue">Active</span>
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
            if (window.proctorWS) {
                window.proctorWS.onConnect(() => {
                    console.log("Global WebSocket connected.");
                    const orgId = user.organization ? user.organization.id : null;
                    window.proctorWS.subscribeToMessages(user.role, user.id, orgId, (newMsg) => {
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
                            messagesLink.appendChild(dot);
                        }
                    });
                });
                window.proctorWS.connect(token, sessionStorage.getItem('tenant_id'));
            }
        }
    } catch(e) {
        console.error("Failed to load user profile:", e);
    }
});
