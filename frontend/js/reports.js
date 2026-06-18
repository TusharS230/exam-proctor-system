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
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load data.</td></tr>';
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
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No completed exams match the filters.</td></tr>';
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
                <td style="font-weight: 600;">${group.title}</td>
                <td>${group.attempts.length}</td>
                <td class="${scoreClass}">${avg}%</td>
                <td><button class="btn-primary view-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: none; transition: all 0.2s;">View Details</button></td>
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
            <th><button class="view-btn back-btn" style="background:var(--secondary-color); color:white; padding: 0.4rem 0.8rem; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: none; float: right;">&larr; Back to Exams</button></th>
        `;
        tbody.innerHTML = '';

        document.querySelector('.back-btn').addEventListener('click', () => {
            document.getElementById('filterStartDate').value = '';
            document.getElementById('filterEndDate').value = '';
            renderGroupedExams();
        });

        if (attempts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No attempts match the filters.</td></tr>';
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
                actionBtnHtml = `<button class="btn-primary grade-btn" data-id="${attempt.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: none; background: #d97706; color: white; margin-left: 0.5rem;">Grade Attempt</button>`;
            } else if (attempt.status === 'GRADED' || attempt.status === 'SUBMITTED') {
                actionBtnHtml = `<button class="btn-primary view-answers-btn" data-id="${attempt.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: none; background: var(--success); color: white; margin-left: 0.5rem;">View Answers</button>`;
            }

            tr.innerHTML = `
                <td style="font-weight:500;">${attempt.student?.email || 'Unknown'}</td>
                <td class="${scoreClass}">${scoreText}</td>
                <td><span style="background:var(--bg-color); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; border:1px solid var(--border-color);">${attempt.status}</span></td>
                <td style="color:var(--text-secondary);">${date}</td>
                <td>
                    <button class="btn-primary toggle-logs-btn" data-id="${attempt.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: none; background: var(--link-color); color: white;">View Logs</button>
                    ${actionBtnHtml}
                </td>
            `;
            tbody.appendChild(tr);

            // Add an invisible row for the logs accordion
            const logRow = document.createElement('tr');
            logRow.className = 'logs-row';
            logRow.style.display = 'none';
            logRow.style.background = 'var(--bg-color)';
            logRow.innerHTML = `
                <td colspan="5" style="padding: 1rem;">
                    <div class="logs-container" id="logs-${attempt.id}" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; background: var(--surface-color);">
                        <div style="text-align: center; color: var(--text-secondary);">Loading logs...</div>
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
                            logsContainer.innerHTML = '<div style="text-align: center; color: var(--success); font-weight: 500;">No suspicious activity detected.</div>';
                            return;
                        }

                        // Render logs
                        logsContainer.innerHTML = '';
                        logs.forEach(log => {
                            const time = new Date(log.timestamp).toLocaleTimeString();
                            
                            let borderClass = 'var(--danger)';
                            if (log.eventType === 'EXAM_STARTED' || log.eventType === 'EXAM_COMPLETED' || log.eventType === 'SYSTEM') {
                                borderClass = 'var(--link-color)';
                            }

                            logsContainer.innerHTML += `
                                <div style="border-left: 4px solid ${borderClass}; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-color); border-radius: 4px;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                        <span style="color: ${borderClass}; font-weight: 600; font-size: 0.85rem;">${log.eventType}</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem;">${time}</span>
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-primary);">
                                        ${log.details}
                                    </div>
                                </div>
                            `;
                        });
                        
                    } catch(err) {
                        logsContainer.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load logs.</div>';
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
        container.innerHTML = '<div style="text-align:center;">Loading...</div>';
        
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
                        <div style="background: var(--bg-color); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">Q${index + 1}: ${q.questionText}</div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Provided Answer:</div>
                            <div style="background: var(--surface-color); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; border: 1px solid var(--border-color);">${providedAns}</div>
                            
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <span style="font-size: 0.9rem; color: var(--text-secondary);">Type: ${q.questionType}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <label style="font-size: 0.9rem; font-weight: 600;">Marks Awarded:</label>
                                    <input type="number" class="grade-input" data-answer-id="${ans.id}" value="${initialMark}" min="0" max="${maxMarks}" ${(!isManual || isViewOnly) ? 'readonly' : ''} style="width: 60px; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: 4px; background: ${(!isManual || isViewOnly) ? 'var(--surface-color)' : 'var(--bg-color)'}">
                                    <span style="font-size: 0.9rem; color: var(--text-secondary);">/ ${maxMarks}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                container.innerHTML = '<div style="color:var(--danger);">No answers found.</div>';
            }
        } catch (err) {
            container.innerHTML = '<div style="color:var(--danger);">Failed to load answers.</div>';
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
