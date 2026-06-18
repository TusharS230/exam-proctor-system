document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;

        try {
            const data = await ApiClient.post('/auth/login', { email, password });

            // Save token and tenant to sessionStorage
            sessionStorage.setItem('jwt_token', data.token);
            sessionStorage.setItem('tenant_id', data.tenantSlug);
            sessionStorage.setItem('role', data.role);
            sessionStorage.setItem('email', email);
            
            Toast.success('Login successful!');

            // Redirect to dashboard (or exam page based on role)
            setTimeout(() => {
                if (data.role === 'SUPER_ADMIN') {
                    window.location.href = 'super-admin.html';
                } else if (data.role === 'ORG_ADMIN' || data.role === 'ADMIN') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'student-dashboard.html';
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error during login:', error);
            // Toast will automatically be shown by ApiClient, but we can reset the UI here
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof Toast !== 'undefined') {
                Toast.warning("Please contact your organization's administrator to reset your password.");
            } else {
                alert("Please contact your organization's administrator to reset your password.");
            }
        });
    }
});
