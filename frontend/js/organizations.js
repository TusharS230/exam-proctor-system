document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('jwt_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const tbody = document.getElementById('orgsTableBody');

    async function loadOrgs() {
        try {
            const orgs = await ApiClient.get('/organizations');
            if (orgs) {
                renderOrgs(orgs);
            } else {
                if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--danger);">Failed to load.</td></tr>';
            }
        } catch(e) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--danger);">Failed to load data.</td></tr>';
        }
    }

    function renderOrgs(orgs) {
        if (!tbody) return;
        tbody.innerHTML = '';
        if(orgs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No organizations found.</td></tr>';
            return;
        }

        orgs.forEach(org => {
            const tr = document.createElement('tr');
            const date = org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A';
            tr.innerHTML = `
                <td style="font-weight:500;">${org.name}</td>
                <td><span style="background:var(--bg-color); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.85rem; font-family:monospace;">${org.tenantSlug}</span></td>
                <td>${date}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    loadOrgs();
});
