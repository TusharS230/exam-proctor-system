document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if (!token || !tenantId) return;

    try {
        const exams = await ApiClient.get('/exams');
        const activeExamsDot = document.getElementById('activeExamsDot');
        
        if (exams && exams.length > 0) {
            if (activeExamsDot) {
                activeExamsDot.style.display = 'block';
            }
        } else {
            if (activeExamsDot) {
                activeExamsDot.style.display = 'none';
            }
        }
    } catch (e) {
        // Silently fail for sidebar notification
        console.error('Failed to fetch active exams for notification', e);
    }
});
