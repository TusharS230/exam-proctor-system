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
                if (tbody) tbody.innerHTML = '<tr><td class="text-center text-red" colspan="3">Failed to load.</td></tr>';
            }
        } catch(e) {
            if (tbody) tbody.innerHTML = '<tr><td class="text-center text-red" colspan="3">Failed to load data.</td></tr>';
        }
    }

    function renderOrgs(orgs) {
        if (!tbody) return;
        tbody.innerHTML = '';
        if(orgs.length === 0) {
            tbody.innerHTML = '<tr><td class="text-center" colspan="3">No organizations found.</td></tr>';
            return;
        }

        orgs.forEach(org => {
            const tr = document.createElement('tr');
            const date = org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A';
            tr.innerHTML = `
                <td>${org.name}</td>
                <td><span class="bg-grey padded-sm small mono">${org.tenantSlug}</span></td>
                <td>${date}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    loadOrgs();
});
