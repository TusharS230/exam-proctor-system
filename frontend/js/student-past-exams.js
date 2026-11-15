document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if (!token || !tenantId) {
        window.location.href = 'index.html';
        return;
    }



    let allHistory = [];

    async function loadHistory() {
        const historyList = document.getElementById('historyList');
        try {
            const [attempts, missedExams] = await Promise.all([
                ApiClient.get('/attempts/history'),
                ApiClient.get('/exams/missed')
            ]);

            historyList.innerHTML = '';

            if ((!attempts || attempts.length === 0) && (!missedExams || missedExams.length === 0)) {
                historyList.innerHTML = '<div class="muted padded text-center">No past exams.</div>';
                return;
            }

            allHistory = [];

            (attempts || []).forEach(a => allHistory.push({
                id: a.id,
                isMissed: false,
                examTitle: a.exam?.title || 'Unknown Exam',
                dateStr: a.completedAt ? new Date(a.completedAt).toLocaleString() : 'N/A',
                timestamp: a.completedAt ? new Date(a.completedAt).getTime() : 0,
                status: a.status,
                totalScore: a.totalScore
            }));

            (missedExams || []).forEach(e => allHistory.push({
                isMissed: true,
                examTitle: e.title || 'Unknown Exam',
                dateStr: e.scheduledEndTime ? new Date(e.scheduledEndTime).toLocaleString() : 'N/A',
                timestamp: e.scheduledEndTime ? new Date(e.scheduledEndTime).getTime() : 0,
                status: 'MISSED',
                totalScore: null
            }));

            renderHistory();
        } catch(e) {
            console.error(e);
            historyList.innerHTML = '<div class="text-red padded">Failed to load history.</div>';
        }
    }

    function renderHistory() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        const startDateStr = document.getElementById('filterStartDate').value;
        const endDateStr = document.getElementById('filterEndDate').value;
        const sortOrder = document.getElementById('sortOrder').value;

        let filtered = allHistory.filter(item => {
            if (startDateStr) {
                const startObj = new Date(startDateStr);
                startObj.setHours(0, 0, 0, 0);
                if (item.timestamp < startObj.getTime()) return false;
            }
            if (endDateStr) {
                const endObj = new Date(endDateStr);
                endObj.setHours(23, 59, 59, 999);
                if (item.timestamp > endObj.getTime()) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sortOrder === 'desc') {
                return b.timestamp - a.timestamp;
            } else {
                return a.timestamp - b.timestamp;
            }
        });

        if (filtered.length === 0) {
            historyList.innerHTML = '<div class="muted padded text-center">No matching exams found.</div>';
            return;
        }

        filtered.forEach(item => {
                let scoreHtml = '';
                if (item.isMissed) {
                    scoreHtml = `<div class="bold text-red">Missed / Not Taken</div>`;
                } else if (item.status === 'SUBMITTED' && item.totalScore == null) {
                    scoreHtml = `<div class="bold muted">Pending Evaluation</div>`;
                } else {
                    const scoreClass = item.totalScore >= 80 ? 'score good' : 'score low';
                    scoreHtml = `<div class="${scoreClass}">${item.totalScore != null ? item.totalScore + '%' : 'N/A'}</div>`;
                }

                const div = document.createElement('div');
                div.className = 'exam-card';
                div.innerHTML = `
                    <div class="exam-info">
                        <h3>${escapeHtml(item.examTitle)}</h3>
                        <p>${item.isMissed ? 'Expired on' : 'Completed on'}: ${item.dateStr}</p>
                    </div>
                    <div class="flex align-center gap-2">
                        ${scoreHtml}
                        ${!item.isMissed ? `<button class="btn-primary view-btn small" data-id="${item.id}" data-status="${item.status}">View Answers</button>` : ''}
                    </div>
                `;
                historyList.appendChild(div);
            });

            // Add event listeners for view buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const attemptId = e.target.getAttribute('data-id');
                    const status = e.target.getAttribute('data-status');
                    await openViewModal(attemptId, status);
                });
            });
    }

    document.getElementById('filterStartDate').addEventListener('change', renderHistory);
    document.getElementById('filterEndDate').addEventListener('change', renderHistory);
    document.getElementById('sortOrder').addEventListener('change', renderHistory);

    loadHistory();

    async function openViewModal(attemptId, attemptStatus) {
        const container = document.getElementById('viewQuestionsContainer');
        container.innerHTML = '<div class="text-center">Loading...</div>';
        document.getElementById('viewModal').style.display = 'flex';

        try {
            const answers = await ApiClient.get(`/attempts/${attemptId}/answers`);
            if (answers && answers.length > 0) {
                container.innerHTML = '';
                answers.forEach((ans, index) => {
                    const q = ans.question;
                    const maxMarks = q.marks || 0;
                    const providedAns = ans.providedAnswer || 'No answer provided';

                    let isPending = ans.marksAwarded == null;
                    if (q.questionType === 'TEXT_RESPONSE' && attemptStatus === 'SUBMITTED') {
                        isPending = true; // for old data that saved 0
                    }

                    const initialMark = isPending ? 0 : ans.marksAwarded;

                    let isCorrectHtml = '';
                    if (!isPending) {
                        isCorrectHtml = ans.isCorrect
                            ? `<span class="text-blue bold">(Correct)</span>`
                            : `<span class="text-red bold">(Incorrect)</span>`;
                    }

                    const markDisplay = !isPending
                        ? `${initialMark} / ${maxMarks} ${isCorrectHtml}`
                        : `Pending / ${maxMarks}`;

                    container.innerHTML += `
                        <div class="answer-block">
                            <div class="bold mb-1">Q${index + 1}: ${escapeHtml(q.questionText)}</div>
                            <div class="small muted mb-1">Your Answer:</div>
                            <div class="answer-text">${escapeHtml(providedAns)}</div>

                            <div class="flex align-center space-between">
                                <div>
                                    <span class="small muted">Type: ${q.questionType}</span>
                                </div>
                                <div class="small">
                                    <strong>Marks: </strong> ${markDisplay}
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                container.innerHTML = '<div class="text-red">No answers found.</div>';
            }
        } catch (err) {
            container.innerHTML = '<div class="text-red">Failed to load answers.</div>';
        }
    }

    document.getElementById('closeViewModal').addEventListener('click', () => {
        document.getElementById('viewModal').style.display = 'none';
    });
});
