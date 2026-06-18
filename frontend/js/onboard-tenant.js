document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('jwt_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const onboardForm = document.getElementById('onboardForm');

    if (onboardForm) {
        onboardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('createBtn');
            btn.disabled = true;
            btn.textContent = 'Creating...';

            const name = document.getElementById('orgName').value;
            const tenantSlug = document.getElementById('orgSlug').value;
            const adminEmail = document.getElementById('adminEmail').value;
            const adminPassword = document.getElementById('adminPassword').value;

            try {
                // 1. Create Organization
                const createdOrg = await ApiClient.post('/organizations', { name, tenantSlug });

                // 2. Create Initial Admin
                await ApiClient.post(`/organizations/${createdOrg.id}/admin`, { email: adminEmail, password: adminPassword, role: 'ORG_ADMIN' });

                Toast.success('Organization and Admin provisioned successfully!');
                onboardForm.reset();
            } catch(err) {
                // Toast handles the error
            } finally {
                btn.disabled = false;
                btn.textContent = 'Create Organization & Admin';
            }
        });
    }
});
