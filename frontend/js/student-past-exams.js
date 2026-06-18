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
                historyList.innerHTML = '<div style="color:var(--text-secondary); padding:1rem; text-align:center;">No past exams.</div>';
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
            historyList.innerHTML = '<div style="color:var(--danger); padding:1rem;">Failed to load history.</div>';
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
            historyList.innerHTML = '<div style="color:var(--text-secondary); padding:1rem; text-align:center;">No matching exams found.</div>';
            return;
        }

        filtered.forEach(item => {
                let scoreHtml = '';
                if (item.isMissed) {
                    scoreHtml = `<div style="font-size: 1rem; font-weight: 600; color: var(--danger);">Missed / Not Taken</div>`;
                } else if (item.status === 'SUBMITTED' && item.totalScore == null) {
                    scoreHtml = `<div style="font-size: 1rem; font-weight: 600; color: var(--text-secondary);">Pending Evaluation</div>`;
                } else {
                    const scoreColor = item.totalScore >= 80 ? 'var(--success)' : (item.totalScore < 50 ? 'var(--danger)' : '#d97706');
                    scoreHtml = `<div style="font-size: 1.5rem; font-weight: 700; color: ${scoreColor};">${item.totalScore != null ? item.totalScore + '%' : 'N/A'}</div>`;
                }
                
                const div = document.createElement('div');
                div.className = 'exam-card';
                div.style.background = 'var(--bg-color)';
                div.innerHTML = `
                    <div class="exam-info">
                        <h3>${item.examTitle}</h3>
                        <p>${item.isMissed ? 'Expired on' : 'Completed on'}: ${item.dateStr}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${scoreHtml}
                        ${!item.isMissed ? `<button class="btn-primary view-btn" data-id="${item.id}" data-status="${item.status}" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;">View Answers</button>` : ''}
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
        container.innerHTML = '<div style="text-align:center;">Loading...</div>';
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
                            ? `<span style="color: var(--success); font-weight: bold;">(Correct)</span>` 
                            : `<span style="color: var(--danger); font-weight: bold;">(Incorrect)</span>`;
                    }
                        
                    const markDisplay = !isPending 
                        ? `${initialMark} / ${maxMarks} ${isCorrectHtml}`
                        : `Pending / ${maxMarks}`;
                    
                    container.innerHTML += `
                        <div style="background: var(--bg-color); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">Q${index + 1}: ${q.questionText}</div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Your Answer:</div>
                            <div style="background: var(--surface-color); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; border: 1px solid var(--border-color);">${providedAns}</div>
                            
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <span style="font-size: 0.9rem; color: var(--text-secondary);">Type: ${q.questionType}</span>
                                </div>
                                <div style="font-size: 0.9rem;">
                                    <strong>Marks: </strong> ${markDisplay}
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

    document.getElementById('closeViewModal').addEventListener('click', () => {
        document.getElementById('viewModal').style.display = 'none';
    });
});
