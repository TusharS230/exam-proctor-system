document.addEventListener('DOMContentLoaded', async () => {
    const tenantId = sessionStorage.getItem('tenant_id');
    const token = sessionStorage.getItem('jwt_token');

    if(document.getElementById('sidebarTenant')) {
        document.getElementById('sidebarTenant').textContent = tenantId || 'Unknown';
    }

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const tableHeader = document.querySelector('thead tr');
    const tbody = document.getElementById('historyTableBody');
    let allAttempts = [];
    let currentView = 'grouped';
    let currentExamTitle = '';
    let currentAttempts = [];

    document.getElementById('filterStartDate').addEventListener('change', reRenderCurrentView);
    document.getElementById('filterEndDate').addEventListener('change', reRenderCurrentView);
    document.getElementById('sortOrder').addEventListener('change', reRenderCurrentView);

    try {
        const attempts = await ApiClient.get('/attempts/history');
        if (attempts) {
            allAttempts = attempts;
            renderGroupedExams();
        } else {
            tbody.innerHTML = '<tr><td class="text-center text-red" colspan="5">Failed to load.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td class="text-center text-red" colspan="5">Failed to load data.</td></tr>';
    }

    function getFilteredAttempts() {
        const startDateStr = document.getElementById('filterStartDate').value;
        const endDateStr = document.getElementById('filterEndDate').value;
        const sortOrder = document.getElementById('sortOrder').value;

        let filtered = allAttempts.filter(item => {
            const timestamp = item.completedAt ? new Date(item.completedAt).getTime() : 0;
            if (startDateStr) {
                const startObj = new Date(startDateStr);
                startObj.setHours(0, 0, 0, 0);
                if (timestamp < startObj.getTime()) return false;
            }
            if (endDateStr) {
                const endObj = new Date(endDateStr);
                endObj.setHours(23, 59, 59, 999);
                if (timestamp > endObj.getTime()) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return sortOrder === 'desc' ? tB - tA : tA - tB;
        });

        return filtered;
    }

    function reRenderCurrentView() {
        if (currentView === 'grouped') {
            renderGroupedExams();
        } else {
            // we need to get the latest filtered attempts for this specific exam
            const freshFiltered = getFilteredAttempts().filter(a => a.exam?.title === currentExamTitle);
            renderExamDetails(currentExamTitle, freshFiltered, false);
        }
    }

    function renderGroupedExams() {
        currentView = 'grouped';
        tableHeader.innerHTML = `
            <th>Exam Title</th>
            <th>Students Completed</th>
            <th>Average Score</th>
            <th>Action</th>
        `;
        tbody.innerHTML = '';

        const filtered = getFilteredAttempts();

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td class="text-center" colspan="4">No completed exams match the filters.</td></tr>';
            return;
        }

        // Group by exam id
        const grouped = {};
        filtered.forEach(attempt => {
            const examId = attempt.exam?.id;
            if (!examId) return;
            if (!grouped[examId]) {
                grouped[examId] = {
                    title: attempt.exam.title,
                    attempts: [],
                    totalScore: 0
                };
            }
            grouped[examId].attempts.push(attempt);
            if (attempt.totalScore != null) {
                grouped[examId].totalScore += attempt.totalScore;
            }
        });

        Object.values(grouped).forEach(group => {
            const tr = document.createElement('tr');
            const avg = Math.round(group.totalScore / group.attempts.length);

            let scoreClass = 'score-med';
            if (avg >= 80) scoreClass = 'score-high';
            else if (avg < 50) scoreClass = 'score-low';

            tr.innerHTML = `
                <td class="bold">${group.title}</td>
                <td>${group.attempts.length}</td>
                <td class="${scoreClass}">${avg}%</td>
                <td><button class="btn-primary view-btn small">View Details</button></td>
            `;

            tr.querySelector('.view-btn').addEventListener('click', () => {
                const freshFiltered = getFilteredAttempts().filter(a => a.exam?.id === examId);
                renderExamDetails(group.title, freshFiltered, true);
            });
            tbody.appendChild(tr);
        });
    }

    function renderExamDetails(examTitle, attempts, isNewTransition = false) {
        currentView = 'details';
        currentExamTitle = examTitle;
        currentAttempts = attempts;

        tableHeader.innerHTML = `
            <th>Student Email</th>
            <th>Score</th>
            <th>Status</th>
            <th>Completed At</th>
            <th><button class="view-btn back-btn btn-secondary small float-right">&larr; Back to Exams</button></th>
        `;
        tbody.innerHTML = '';

        document.querySelector('.back-btn').addEventListener('click', () => {
            document.getElementById('filterStartDate').value = '';
            document.getElementById('filterEndDate').value = '';
            renderGroupedExams();
        });

        if (attempts.length === 0) {
            tbody.innerHTML = '<tr><td class="text-center" colspan="5">No attempts match the filters.</td></tr>';
            return;
        }

        attempts.forEach(attempt => {
            const tr = document.createElement('tr');
            const date = attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : 'N/A';

            let scoreClass = 'score-med';
            let scoreText = attempt.totalScore != null ? attempt.totalScore + '%' : 'N/A';
            if (attempt.status === 'SUBMITTED' && attempt.totalScore == null) {
                scoreText = 'Pending Evaluation';
                scoreClass = '';
            } else {
                if (attempt.totalScore >= 80) scoreClass = 'score-high';
                else if (attempt.totalScore < 50) scoreClass = 'score-low';
            }

            let actionBtnHtml = '';
            if (attempt.status === 'SUBMITTED' && attempt.totalScore == null) {
                actionBtnHtml = `<button class="btn-danger grade-btn small ml-1" data-id="${attempt.id}">Grade Attempt</button>`;
            } else if (attempt.status === 'GRADED' || attempt.status === 'SUBMITTED') {
                actionBtnHtml = `<button class="btn-primary view-answers-btn small ml-1" data-id="${attempt.id}">View Answers</button>`;
            }

            tr.innerHTML = `
                <td>${attempt.student?.email || 'Unknown'}</td>
                <td class="${scoreClass}">${scoreText}</td>
                <td><span class="tag">${attempt.status}</span></td>
                <td class="muted">${date}</td>
                <td>
                    <button class="btn-primary toggle-logs-btn small" data-id="${attempt.id}">View Logs</button>
                    ${actionBtnHtml}
                </td>
            `;
            tbody.appendChild(tr);

            // Add an invisible row for the logs accordion
            const logRow = document.createElement('tr');
            logRow.className = 'logs-row';
            logRow.style.display = 'none';
            logRow.innerHTML = `
                <td class="padded" colspan="5">
                    <div class="logs-container max-h-300 scroll-y" id="logs-${attempt.id}">
                        <div class="text-center muted">Loading logs...</div>
                    </div>
                </td>
            `;
            tbody.appendChild(logRow);

            // Add click listener
            tr.querySelector('.toggle-logs-btn').addEventListener('click', async (e) => {
                const btn = e.target;
                const isHidden = logRow.style.display === 'none';
                logRow.style.display = isHidden ? 'table-row' : 'none';
                btn.textContent = isHidden ? 'Hide Logs' : 'View Logs';

                if (isHidden) {
                    const logsContainer = document.getElementById(`logs-${attempt.id}`);
                    try {
                        const logs = await ApiClient.get(`/attempts/${attempt.id}/logs`);

                        if (!logs || logs.length === 0) {
                            logsContainer.innerHTML = '<div class="text-center text-blue">No suspicious activity detected.</div>';
                            return;
                        }

                        // Render logs
                        logsContainer.innerHTML = '';
                        logs.forEach(log => {
                            const time = new Date(log.timestamp).toLocaleTimeString();

                            let logClass = 'log-item';
                            if (log.eventType === 'EXAM_STARTED' || log.eventType === 'EXAM_COMPLETED' || log.eventType === 'SYSTEM') {
                                logClass = 'log-item info';
                            }

                            logsContainer.innerHTML += `
                                <div class="${logClass}">
                                    <div class="flex space-between mb-1">
                                        <span class="log-type">${log.eventType}</span>
                                        <span class="muted small">${time}</span>
                                    </div>
                                    <div class="small">
                                        ${log.details}
                                    </div>
                                </div>
                            `;
                        });

                    } catch(err) {
                        logsContainer.innerHTML = '<div class="text-center text-red">Failed to load logs.</div>';
                    }
                }
            });

            const gradeBtn = tr.querySelector('.grade-btn');
            if (gradeBtn) {
                gradeBtn.addEventListener('click', () => openGradingModal(attempt.id, false));
            }

            const viewBtn = tr.querySelector('.view-answers-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => openGradingModal(attempt.id, true));
            }
        });
    }

    let currentGradingAttemptId = null;

    async function openGradingModal(attemptId, isViewOnly = false) {
        currentGradingAttemptId = attemptId;
        const container = document.getElementById('gradingQuestionsContainer');
        container.innerHTML = '<div class="text-center">Loading...</div>';

        const modalTitle = document.querySelector('#gradingModal h2');
        if (modalTitle) modalTitle.textContent = isViewOnly ? 'View Answers' : 'Manual Grading';

        const submitBtn = document.getElementById('submitGradesBtn');
        if (submitBtn) submitBtn.style.display = isViewOnly ? 'none' : 'block';

        document.getElementById('gradingModal').style.display = 'flex';

        try {
            const answers = await ApiClient.get(`/attempts/${attemptId}/answers`);
            if (answers && answers.length > 0) {
                container.innerHTML = '';
                answers.forEach((ans, index) => {
                    const q = ans.question;
                    const maxMarks = q.marks || 0;
                    const isManual = q.questionType === 'TEXT_RESPONSE';
                    const providedAns = ans.providedAnswer || 'No answer provided';
                    const initialMark = ans.marksAwarded != null ? ans.marksAwarded : 0;

                    container.innerHTML += `
                        <div class="answer-block">
                            <div class="bold mb-1">Q${index + 1}: ${q.questionText}</div>
                            <div class="small muted mb-1">Provided Answer:</div>
                            <div class="answer-text">${providedAns}</div>

                            <div class="flex align-center space-between">
                                <div>
                                    <span class="small muted">Type: ${q.questionType}</span>
                                </div>
                                <div class="flex align-center gap-1">
                                    <label class="small bold">Marks Awarded:</label>
                                    <input type="number" class="grade-input" data-answer-id="${ans.id}" value="${initialMark}" min="0" max="${maxMarks}" ${(!isManual || isViewOnly) ? 'readonly' : ''}>
                                    <span class="small muted">/ ${maxMarks}</span>
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

    document.getElementById('closeGradingModal').addEventListener('click', () => {
        document.getElementById('gradingModal').style.display = 'none';
        currentGradingAttemptId = null;
    });

    document.getElementById('submitGradesBtn').addEventListener('click', async () => {
        if (!currentGradingAttemptId) return;

        const inputs = document.querySelectorAll('.grade-input');
        const grades = Array.from(inputs).map(input => {
            let val = parseInt(input.value) || 0;
            const max = parseInt(input.getAttribute('max')) || 0;
            if (val > max) val = max;
            if (val < 0) val = 0;
            return {
                answerId: input.getAttribute('data-answer-id'),
                marksAwarded: val
            };
        });

        try {
            await ApiClient.post(`/attempts/${currentGradingAttemptId}/grade`, { grades });
            Toast.show('success', 'Grades submitted successfully!');
            document.getElementById('gradingModal').style.display = 'none';
            // Reload the list
            const attempts = await ApiClient.get('/attempts/history');
            allAttempts = attempts;
            renderGroupedExams();
        } catch (err) {
            Toast.show('error', 'Failed to submit grades.');
        }
    });

});
