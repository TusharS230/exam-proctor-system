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
                ${alert.studentEmail} - <span class="muted normal">${alert.examTitle || ''}</span>
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
            alertsFeed.innerHTML = '<div class="muted text-center padded">Feed cleared. Waiting for new alerts...</div>';
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
                <div class="bold mb-1">${attempt.student?.email || 'Unknown Student'}</div>
                <div class="small muted">Exam: ${attempt.exam?.title || 'Unknown'}</div>
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
            list.innerHTML = '<div class="text-center muted padded">No exams available.</div>';
            return;
        }

        exams.forEach(exam => {
            const div = document.createElement('div');
            div.className = 'list-item';
            if (exam.status === 'PAST') div.classList.add('closed');

            let actionBtn = '';
            if (exam.status === 'ACTIVE') {
                actionBtn = `<button class="btn-danger toggle-status-btn small" data-id="${exam.id}" data-action="PAST">Close Exam</button>`;
            } else if (exam.status === 'SCHEDULED' || exam.status === 'PAST') {
                actionBtn = `<button class="btn-primary toggle-status-btn small" data-id="${exam.id}" data-action="ACTIVE">Activate</button>`;
            }

            let timeInfo = `<div class="small muted">Duration: ${exam.durationMinutes} mins</div>`;
            if (exam.scheduledStartTime) {
                timeInfo += `<div class="small muted mt-1">Start: ${new Date(exam.scheduledStartTime).toLocaleString()}</div>`;
            }
            if (exam.scheduledEndTime) {
                timeInfo += `<div class="small muted">End: ${new Date(exam.scheduledEndTime).toLocaleString()}</div>`;
            }

            div.innerHTML = `
                <div class="flex space-between align-start">
                    <div>
                        <div class="bold mb-1">${exam.title}</div>
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
            <div class="grid gap-2">
                <div class="padded bg-grey bordered flex space-between align-center">
                    <span class="muted">Active Students</span>
                    <span class="large bold text-blue">${stats.activeStudents}</span>
                </div>
                <div class="padded bg-grey bordered flex space-between align-center">
                    <span class="muted">Completed Today</span>
                    <span class="large bold text-blue">${stats.completedToday}</span>
                </div>
                <div class="padded bg-grey bordered border-red flex space-between align-center">
                    <span class="text-red">Total Violations</span>
                    <span class="large bold text-red">${stats.totalViolations}</span>
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
