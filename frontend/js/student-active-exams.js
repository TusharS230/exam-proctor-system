document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if (!token || !tenantId) {
        window.location.href = 'index.html';
        return;
    }

    const examsList = document.getElementById('examsList');

    try {
        const exams = await ApiClient.get('/exams');
        if (exams) {
            renderExams(exams);
        } else {
            examsList.innerHTML = `<div style="text-align:center; color: var(--danger);">Failed to load exams.</div>`;
        }
    } catch (e) {
        console.error(e);
        examsList.innerHTML = `<div style="text-align:center; color: var(--danger);">Failed to load exams.</div>`;
    }

    function renderExams(exams) {
        examsList.innerHTML = '';
        if (exams.length === 0) {
            examsList.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">No exams currently assigned.</div>`;
            return;
        }

        exams.forEach(exam => {
            const div = document.createElement('div');
            div.className = 'exam-card';
            div.innerHTML = `
                <div class="exam-info">
                    <h3>${exam.title}</h3>
                    <p>${exam.description}</p>
                    <p style="margin-top: 0.5rem; font-weight: 500;">Duration: ${exam.durationMinutes} mins | Questions: ${exam.questions ? exam.questions.length : 0}</p>
                </div>
                <div>
                    <button class="btn-primary start-btn" data-id="${exam.id}">Start Exam</button>
                </div>
            `;
            examsList.appendChild(div);
        });

        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const examId = e.target.getAttribute('data-id');
                e.target.disabled = true;
                e.target.textContent = 'Starting...';

                try {
                    await ApiClient.post(`/attempts/start?examId=${examId}`);
                    window.location.href = 'exam.html';
                } catch (err) {
                    // ApiClient handles Toast errors
                    e.target.disabled = false;
                    e.target.textContent = 'Start Exam';
                }
            });
        });
    }


});
