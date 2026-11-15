document.addEventListener('DOMContentLoaded', async () => {
    const examsList = document.getElementById('examsList');

    // 1. If the student left an exam half way (closed the tab), let them go back to it
    try {
        const activeAttempt = await ApiClient.get('/attempts/my-active', { silent: true });
        if (activeAttempt && activeAttempt.exam) {
            const notice = document.createElement('p');
            notice.className = 'mb-3';
            notice.innerHTML = `You have an exam in progress: <strong>${escapeHtml(activeAttempt.exam.title)}</strong>.
                <a href="exam.html">Resume exam</a>`;
            examsList.before(notice);
        }
    } catch (e) {
        // no exam in progress, nothing to show
    }

    // 2. Load the exams this student can take
    try {
        const exams = await ApiClient.get('/exams');
        renderExams(exams || []);
    } catch (e) {
        console.error(e);
        examsList.innerHTML = `<p class="text-center text-red">Failed to load exams.</p>`;
    }

    function renderExams(exams) {
        examsList.innerHTML = '';
        if (exams.length === 0) {
            examsList.innerHTML = `<p class="text-center muted mt-2">No exams assigned to you right now.</p>`;
            return;
        }

        const now = new Date();

        exams.forEach(exam => {
            const opensLater = exam.scheduledStartTime && new Date(exam.scheduledStartTime) > now;

            // exams that have not opened yet show when they open, instead of a Start button
            const action = opensLater
                ? `<span class="small muted">Opens ${new Date(exam.scheduledStartTime).toLocaleString()}</span>`
                : `<button class="btn-primary start-btn" data-id="${exam.id}">Start Exam</button>`;

            const closesInfo = exam.scheduledEndTime
                ? ` | Closes: ${new Date(exam.scheduledEndTime).toLocaleString()}`
                : '';

            const div = document.createElement('div');
            div.className = 'exam-card';
            div.innerHTML = `
                <div class="exam-info">
                    <h3>${escapeHtml(exam.title)}</h3>
                    <p>${escapeHtml(exam.description || '')}</p>
                    <p class="mt-1">Duration: ${exam.durationMinutes} mins | Questions: ${exam.questions ? exam.questions.length : 0}${closesInfo}</p>
                </div>
                <div>${action}</div>
            `;
            examsList.appendChild(div);
        });

        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const examId = e.target.getAttribute('data-id');
                if (!confirm('Start this exam now? The timer starts as soon as you begin.')) return;

                e.target.disabled = true;
                e.target.textContent = 'Starting...';

                try {
                    await ApiClient.post(`/attempts/start?examId=${examId}`);
                    window.location.href = 'exam.html';
                } catch (err) {
                    // ApiClient already showed the error message
                    e.target.disabled = false;
                    e.target.textContent = 'Start Exam';
                }
            });
        });
    }
});
