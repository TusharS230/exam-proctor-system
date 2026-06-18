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

    const tbody = document.getElementById('candidatesTableBody');

    async function loadCandidates() {
        try {
            const [students, attempts] = await Promise.all([
                ApiClient.get('/users/students'),
                ApiClient.get('/attempts/history')
            ]);
                
            // compute stats
            const statsMap = {};
            attempts.forEach(attempt => {
                const sid = attempt.student?.id;
                if (!sid) return;
                if (!statsMap[sid]) {
                    statsMap[sid] = { count: 0, totalScore: 0 };
                }
                statsMap[sid].count++;
                if (attempt.totalScore != null) {
                    statsMap[sid].totalScore += attempt.totalScore;
                }
            });

            renderTable(students, statsMap);
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Failed to load data.</td></tr>';
        }
    }

    function renderTable(students, statsMap) {
        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No students found in this organization.</td></tr>';
            return;
        }

        students.forEach(student => {
            const tr = document.createElement('tr');
            const date = new Date(student.createdAt).toLocaleDateString();
            const statusClass = student.active ? 'status-active' : 'status-revoked';
            const statusText = student.active ? 'Active' : 'Revoked';
            
            const stats = statsMap[student.id] || { count: 0, totalScore: 0 };
            const avgScore = stats.count > 0 ? Math.round(stats.totalScore / stats.count) + '%' : 'N/A';
            
            let scoreClass = 'score-med';
            if (stats.count > 0 && Math.round(stats.totalScore / stats.count) >= 80) scoreClass = 'score-high';
            else if (stats.count > 0 && Math.round(stats.totalScore / stats.count) < 50) scoreClass = 'score-low';
            if (stats.count === 0) scoreClass = '';

            tr.innerHTML = `
                <td style="font-weight: 500;">${student.email}</td>
                <td style="color:var(--text-secondary);">${date}</td>
                <td class="${statusClass}"><span style="background:var(--bg-color); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; border:1px solid var(--border-color);">${statusText}</span></td>
                <td style="font-weight: 600;">${stats.count}</td>
                <td class="${scoreClass}">${avgScore}</td>
                <td style="text-align: right;">
                    ${student.active ? `
                        <button class="btn-sm btn-warning reset-btn" data-id="${student.id}" style="margin-right:0.5rem; cursor:pointer;">Reset Password</button>
                        <button class="btn-sm btn-danger revoke-btn" data-id="${student.id}" style="cursor:pointer;">Revoke Access</button>
                    ` : `<span style="color:var(--text-secondary);font-size:0.8rem;">Access Revoked</span>`}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Revoke Access
        document.querySelectorAll('.revoke-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm("Are you sure you want to permanently revoke this student's access?")) return;
                
                const id = e.target.getAttribute('data-id');
                e.target.disabled = true;
                e.target.textContent = 'Revoking...';

                try {
                    await ApiClient.post(`/users/students/${id}/revoke`);
                    Toast.success("Access revoked successfully.");
                    loadCandidates(); // reload table
                } catch (err) {
                    e.target.disabled = false;
                    e.target.textContent = 'Revoke Access';
                }
            });
        });

        // Reset Password
        document.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const newPassword = prompt("Enter a new password for this student:");
                if(!newPassword) return;

                const id = e.target.getAttribute('data-id');
                e.target.disabled = true;

                try {
                    await ApiClient.post(`/users/students/${id}/reset-password`, { newPassword });
                    Toast.success("Password reset successfully.");
                } catch (err) {
                    // ApiClient handles the error toast
                } finally {
                    e.target.disabled = false;
                }
            });
        });
    }

    // Manual Entry Form
    document.getElementById('manualEntryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('manualEmail').value;
        const password = document.getElementById('manualPassword').value;
        const btn = document.getElementById('manualBtn');
        btn.disabled = true;

        try {
            await ApiClient.post('/users', { email, password, role: 'STUDENT' });
            Toast.success("Student added successfully!");
            document.getElementById('manualEntryForm').reset();
            loadCandidates();
        } catch (err) {
            // ApiClient handles error toast
        } finally {
            btn.disabled = false;
        }
    });

    // Bulk Import Form (CSV)
    document.getElementById('bulkImportForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('csvFile');
        if (!fileInput.files.length) return;

        const btn = document.getElementById('bulkBtn');
        btn.disabled = true;
        btn.textContent = 'Importing...';

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async function(event) {
            const text = event.target.result;
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            
            // Assuming first line is header: email,password
            // If they didn't include header, we might accidentally skip the first student.
            // Let's do a simple check.
            const firstLine = lines[0].toLowerCase();
            let startIndex = 0;
            if (firstLine.includes('email') || firstLine.includes('password')) {
                startIndex = 1; // skip header
            }

            const requests = [];
            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length >= 2) {
                    requests.push({
                        email: parts[0].trim(),
                        password: parts[1].trim(),
                        role: 'STUDENT'
                    });
                }
            }

            if (requests.length === 0) {
                alert("No valid students found in CSV.");
                btn.disabled = false;
                btn.textContent = 'Import Students';
                return;
            }

            try {
                await ApiClient.post('/users/students/bulk', requests);
                Toast.success(`${requests.length} students imported successfully!`);
                document.getElementById('bulkImportForm').reset();
                loadCandidates();
            } catch (err) {
                // error handled by ApiClient
            } finally {
                btn.disabled = false;
                btn.textContent = 'Import Students';
            }
        };

        reader.readAsText(file);
    });

    loadCandidates();
});
