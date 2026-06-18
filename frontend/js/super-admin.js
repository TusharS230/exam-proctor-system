document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('jwt_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    async function loadStats() {
        try {
            const stats = await ApiClient.get('/system/stats');
            if (stats) {
                document.getElementById('totalOrgs').textContent = stats.totalOrganizations;
                document.getElementById('totalUsers').textContent = stats.totalUsers;
                document.getElementById('totalExams').textContent = stats.totalExams;
            }
        } catch(e) {
            console.error('Failed to load stats', e);
        }
    }

    loadStats();
});
