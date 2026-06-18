document.addEventListener('DOMContentLoaded', () => {
    const alertsFeed = document.getElementById('alertsFeed');
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if(!token || !tenantId) {
        document.getElementById('activeCandidatesList').innerHTML = 
            '<div style="text-align:center; padding:1rem;">No token found. Please <a href="index.html">Login</a>.</div>';
        return;
    }

    // UI Helpers
    function addAlertToFeed(alert) {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        
        const alertEl = document.createElement('div');
        alertEl.className = 'alert-item';
        
        // Color coding based on event type
        let borderClass = 'var(--danger)';
        if (alert.eventType === 'EXAM_STARTED' || alert.eventType === 'EXAM_COMPLETED' || alert.eventType === 'SYSTEM') {
            borderClass = 'var(--link-color)';
        }

        alertEl.style.borderLeft = `4px solid ${borderClass}`;

        alertEl.innerHTML = `
            <div class="alert-header">
                <span class="alert-type" style="color: ${borderClass}">${alert.eventType || 'VIOLATION'}</span>
                <span class="alert-time">${time}</span>
            </div>
            ${alert.studentEmail ? `
            <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem;">
                ${alert.studentEmail} - <span style="color: var(--text-secondary); font-weight: normal;">${alert.examTitle || ''}</span>
            </div>` : ''}
            <div class="alert-body">
                ${alert.details || 'Suspicious activity detected.'}
            </div>
        `;
        
        // Add to top of the feed, remove the placeholder if present
        if (alertsFeed.innerHTML.includes('Waiting for connection...') || alertsFeed.innerHTML.includes('Feed cleared')) {
            alertsFeed.innerHTML = '';
        }
        alertsFeed.insertBefore(alertEl, alertsFeed.firstChild);
    }

    // Clear Feed Logic
    const clearAlertsBtn = document.getElementById('clearAlertsBtn');
    if (clearAlertsBtn) {
        clearAlertsBtn.addEventListener('click', () => {
            alertsFeed.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">Feed cleared. Waiting for new alerts...</div>';
            Toast.success('Live feed cleared locally');
        });
    }

    // Setup WebSocket callbacks
    window.proctorWS.onConnect(() => {
        // Subscribe globally to the tenant's alerts
        window.proctorWS.subscribeToTenantAlerts(tenantId, (alertData) => {
            addAlertToFeed(alertData);
            
            // If the alert is a status change, reload the active candidates list and analytics
            if (alertData.eventType === 'EXAM_STARTED' || alertData.eventType === 'EXAM_COMPLETED') {
                // Wait briefly before fetching active candidates to ensure backend transactions have fully committed
                setTimeout(() => {
                    loadActiveCandidates();
                    loadQuickAnalytics();
                }, 500);
            }
        });

        // Add a system message
        const sysAlert = {
            eventType: 'SYSTEM',
            details: `Successfully connected to global live stream for organization.`,
            timestamp: new Date().toISOString()
        };
        addAlertToFeed(sysAlert);
    });

    window.proctorWS.onDisconnect(() => {
        // Do nothing on disconnect now, UI removed
    });

    // Automatically connect on load
    window.proctorWS.connect(token, tenantId);

    // API Integration: Fetch Active Candidates
    async function loadActiveCandidates() {
        try {
            const attempts = await ApiClient.get('/attempts/active');
            renderCandidates(attempts);
        } catch(e) {
            console.error(e);
            const list = document.getElementById('activeCandidatesList');
            if (list) {
                list.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 1rem;">Failed to load active exams.</div>';
            }
        }
    }

    function renderCandidates(attempts) {
        const list = document.getElementById('activeCandidatesList');
        list.innerHTML = '';

        if(attempts.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 1rem;">No active exams found.</div>';
            return;
        }

        attempts.forEach(attempt => {
            const div = document.createElement('div');
            div.style.marginBottom = '1rem';
            div.style.padding = '1rem';
            div.style.border = '1px solid var(--border-color)';
            div.style.borderRadius = '4px';
            div.style.borderLeft = '4px solid var(--success)';

            div.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${attempt.student?.email || 'Unknown Student'}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Exam: ${attempt.exam?.title || 'Unknown'}</div>
                <div style="font-size: 0.75rem; color: var(--success); margin-top: 0.5rem;">• In Progress</div>
            `;
            list.appendChild(div);
        });
    }

    let allExams = [];

    // API Integration: Fetch Exams
    async function loadExams() {
        try {
            allExams = await ApiClient.get('/exams');
            renderFilteredExams();
        } catch(e) {
            console.error(e);
            const list = document.getElementById('activeExamsList');
            if (list) {
                list.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 1rem;">Failed to load exams.</div>';
            }
        }
    }

    function renderFilteredExams() {
        const filterDropdown = document.getElementById('examsStatusFilter');
        const filterVal = filterDropdown ? filterDropdown.value : 'ACTIVE';
        
        let filteredExams = allExams;
        if (filterVal !== 'ALL') {
            filteredExams = allExams.filter(e => e.status === filterVal);
        }
        renderExams(filteredExams);
    }

    function renderExams(exams) {
        const list = document.getElementById('activeExamsList');
        list.innerHTML = '';

        if(exams.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 1rem;">No exams available.</div>';
            return;
        }

        exams.forEach(exam => {
            const div = document.createElement('div');
            div.style.marginBottom = '1rem';
            div.style.padding = '1rem';
            div.style.border = '1px solid var(--border-color)';
            div.style.borderRadius = '4px';
            div.style.borderLeft = `4px solid ${exam.status === 'ACTIVE' ? 'var(--success)' : (exam.status === 'PAST' ? 'var(--danger)' : 'var(--link-color)')}`;

            let actionBtn = '';
            if (exam.status === 'ACTIVE') {
                actionBtn = `<button class="btn-primary toggle-status-btn" data-id="${exam.id}" data-action="PAST" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--danger);">Close Exam</button>`;
            } else if (exam.status === 'SCHEDULED' || exam.status === 'PAST') {
                actionBtn = `<button class="btn-primary toggle-status-btn" data-id="${exam.id}" data-action="ACTIVE" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--success);">Activate</button>`;
            }

            let timeInfo = `<div style="font-size: 0.8rem; color: var(--text-secondary);">Duration: ${exam.durationMinutes} mins</div>`;
            if (exam.scheduledStartTime) {
                timeInfo += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Start: ${new Date(exam.scheduledStartTime).toLocaleString()}</div>`;
            }
            if (exam.scheduledEndTime) {
                timeInfo += `<div style="font-size: 0.75rem; color: var(--text-secondary);">End: ${new Date(exam.scheduledEndTime).toLocaleString()}</div>`;
            }

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${exam.title}</div>
                        ${timeInfo}
                    </div>
                    <div>${actionBtn}</div>
                </div>
            `;
            list.appendChild(div);
        });

        // Attach listeners to buttons
        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const examId = e.target.getAttribute('data-id');
                const newStatus = e.target.getAttribute('data-action');
                try {
                    await ApiClient.put(`/exams/${examId}/status?status=${newStatus}`);
                    Toast.success(`Exam status updated to ${newStatus}`);
                    loadExams(); // reload
                } catch(err) {
                    Toast.error("Failed to update status");
                }
            });
        });
    }

    // API Integration: Fetch Quick Analytics
    async function loadQuickAnalytics() {
        try {
            const timeframeSelect = document.getElementById('analyticsTimeframe');
            const timeframe = timeframeSelect ? timeframeSelect.value : 'today';
            const stats = await ApiClient.get(`/analytics/dashboard?timeframe=${timeframe}`);
            renderQuickAnalytics(stats);
        } catch(e) {
            console.error(e);
            const list = document.getElementById('quickAnalyticsList');
            if (list) {
                list.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 1rem;">Failed to load analytics.</div>';
            }
        }
    }

    function renderQuickAnalytics(stats) {
        const list = document.getElementById('quickAnalyticsList');
        list.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                <div style="padding: 1rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: var(--text-secondary);">Active Students</span>
                    <span style="font-size: 1.5rem; font-weight: 600; color: var(--success);">${stats.activeStudents}</span>
                </div>
                <div style="padding: 1rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: var(--text-secondary);">Completed Today</span>
                    <span style="font-size: 1.5rem; font-weight: 600; color: var(--link-color);">${stats.completedToday}</span>
                </div>
                <div style="padding: 1rem; background: var(--bg-color); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: var(--danger);">Total Violations</span>
                    <span style="font-size: 1.5rem; font-weight: 600; color: var(--danger);">${stats.totalViolations}</span>
                </div>
            </div>
        `;
    }

    // Add event listeners
    const timeframeDropdown = document.getElementById('analyticsTimeframe');
    if (timeframeDropdown) {
        timeframeDropdown.addEventListener('change', () => {
            loadQuickAnalytics();
        });
    }

    const statusDropdown = document.getElementById('examsStatusFilter');
    if (statusDropdown) {
        statusDropdown.addEventListener('change', () => {
            renderFilteredExams();
        });
    }

    // Initial load
    loadActiveCandidates();
    loadExams();
    loadQuickAnalytics();
});
