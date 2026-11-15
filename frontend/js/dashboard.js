document.addEventListener('DOMContentLoaded', () => {
    const alertsFeed = document.getElementById('alertsFeed');
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if(!token || !tenantId) {
        document.getElementById('activeCandidatesList').innerHTML =
            '<div class="text-center padded">No token found. Please <a href="index.html">Login</a>.</div>';
        return;
    }

    // UI Helpers
    function addAlertToFeed(alert) {
        const time = new Date(alert.timestamp).toLocaleTimeString();

        const alertEl = document.createElement('div');
        alertEl.className = 'alert-item';

        // Color coding based on event type
        // blue for normal events, red for violations
        if (alert.eventType === 'EXAM_STARTED' || alert.eventType === 'EXAM_COMPLETED' || alert.eventType === 'SYSTEM') {
            alertEl.classList.add('info');
        }

        alertEl.innerHTML = `
            <div class="alert-header">
                <span class="alert-type">${alert.eventType || 'VIOLATION'}</span>
                <span class="alert-time">${time}</span>
            </div>
            ${alert.studentEmail ? `
            <div class="bold small mb-1">
                ${escapeHtml(alert.studentEmail)} - <span class="muted normal">${escapeHtml(alert.examTitle || '')}</span>
            </div>` : ''}
            <div class="alert-body">
                ${escapeHtml(alert.details || 'Suspicious activity detected.')}
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
            alertsFeed.innerHTML = '<div class="muted text-center padded">Feed cleared. Waiting for new alerts...</div>';
            Toast.success('Live feed cleared locally');
        });
    }

    // Setup WebSocket callbacks
    const statusBadge = document.getElementById('connectionStatus');

    if (window.proctorWS) {
        window.proctorWS.onConnect(() => {
            if (statusBadge) {
                statusBadge.className = 'status-badge status-online';
                statusBadge.textContent = 'Live';
            }

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
            if (statusBadge) {
                statusBadge.className = 'status-badge status-offline';
                statusBadge.textContent = 'Offline';
            }
        });

        // Automatically connect on load
        window.proctorWS.connect(token, tenantId);
    }

    // API Integration: Fetch Active Candidates
    async function loadActiveCandidates() {
        try {
            const attempts = await ApiClient.get('/attempts/active');
            renderCandidates(attempts);
        } catch(e) {
            console.error(e);
            const list = document.getElementById('activeCandidatesList');
            if (list) {
                list.innerHTML = '<div class="text-center text-red padded">Failed to load active exams.</div>';
            }
        }
    }

    function renderCandidates(attempts) {
        const list = document.getElementById('activeCandidatesList');
        list.innerHTML = '';

        if(attempts.length === 0) {
            list.innerHTML = '<div class="text-center muted padded">No active exams found.</div>';
            return;
        }

        attempts.forEach(attempt => {
            const div = document.createElement('div');
            div.className = 'list-item';

            div.innerHTML = `
                <div class="bold mb-1">${escapeHtml(attempt.student?.email || 'Unknown Student')}</div>
                <div class="small muted">Exam: ${escapeHtml(attempt.exam?.title || 'Unknown')}</div>
                <div class="small text-blue mt-1">• In Progress</div>
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
                list.innerHTML = '<div class="text-center text-red padded">Failed to load exams.</div>';
            }
        }
    }

    // The real state of an exam, using its status AND its schedule:
    // ACTIVE = open now, SCHEDULED = starts later, PAST = closed by the admin or end time passed
    function getExamState(exam) {
        if (exam.status === 'PAST') return 'PAST';
        const now = new Date();
        if (exam.scheduledStartTime && new Date(exam.scheduledStartTime) > now) return 'SCHEDULED';
        if (exam.scheduledEndTime && new Date(exam.scheduledEndTime) < now) return 'PAST';
        return 'ACTIVE';
    }

    function renderFilteredExams() {
        const filterDropdown = document.getElementById('examsStatusFilter');
        const filterVal = filterDropdown ? filterDropdown.value : 'ACTIVE';

        let filteredExams = allExams;
        if (filterVal !== 'ALL') {
            filteredExams = allExams.filter(e => getExamState(e) === filterVal);
        }
        renderExams(filteredExams);
    }

    function renderExams(exams) {
        const list = document.getElementById('activeExamsList');
        list.innerHTML = '';

        if(exams.length === 0) {
            list.innerHTML = '<div class="text-center muted padded">No exams available.</div>';
            return;
        }

        exams.forEach(exam => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const state = getExamState(exam);
            if (state === 'PAST') div.classList.add('closed');

            let actionBtn = '';
            if (exam.status === 'PAST') {
                // closed by the admin: can be opened again
                actionBtn = `<button class="btn-primary toggle-status-btn small" data-id="${exam.id}" data-action="ACTIVE">Re-open</button>`;
            } else if (state === 'PAST') {
                // end time has passed: nothing to do
                actionBtn = `<span class="small muted">Ended</span>`;
            } else {
                // open now or starting later: the admin can close it
                actionBtn = `<button class="btn-danger toggle-status-btn small" data-id="${exam.id}" data-action="PAST">Close Exam</button>`;
            }

            // when it opens/closes, in words that are quick to read
            let timeInfo = `<div class="small muted">Duration: ${exam.durationMinutes} mins</div>`;
            if (state === 'SCHEDULED' && exam.scheduledStartTime) {
                timeInfo += `<div class="small">Opens ${timeFromNow(exam.scheduledStartTime)} <span class="muted">(${new Date(exam.scheduledStartTime).toLocaleString()})</span></div>`;
            }
            if (state === 'ACTIVE' && exam.scheduledEndTime) {
                timeInfo += `<div class="small text-blue">Closes ${timeFromNow(exam.scheduledEndTime)} <span class="muted">(${new Date(exam.scheduledEndTime).toLocaleString()})</span></div>`;
            }
            if (state === 'PAST' && exam.scheduledEndTime) {
                timeInfo += `<div class="small muted">Closed ${new Date(exam.scheduledEndTime).toLocaleString()}</div>`;
            }

            div.innerHTML = `
                <div class="flex space-between align-start">
                    <div>
                        <div class="bold mb-1">${escapeHtml(exam.title)}</div>
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
                list.innerHTML = '<div class="text-center text-red padded">Failed to load analytics.</div>';
            }
        }
    }

    function renderQuickAnalytics(stats) {
        const list = document.getElementById('quickAnalyticsList');
        list.innerHTML = `
            <div class="stat-row">
                <span>Active students</span>
                <span class="stat-number">${stats.activeStudents}</span>
            </div>
            <div class="stat-row">
                <span>Completed exams</span>
                <span class="stat-number">${stats.completedToday ?? 0}</span>
            </div>
            <div class="stat-row text-red">
                <span>Violations</span>
                <span class="stat-number">${stats.totalViolations}</span>
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

    // refresh the exam list every minute, so exams move to "Past" on their own when they close
    setInterval(loadExams, 60000);
});
