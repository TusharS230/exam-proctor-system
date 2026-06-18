document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('jwt_token');
    const tenantId = sessionStorage.getItem('tenant_id');

    if (!token || !tenantId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const attempts = await ApiClient.get('/attempts/history');
        if (attempts) {
            renderDashboard(attempts);
        } else {
            document.getElementById('totalExams').textContent = 'Error';
            document.getElementById('avgScore').textContent = 'Error';
            document.getElementById('highScore').textContent = 'Error';
        }
    } catch (e) {
        console.error(e);
        document.getElementById('totalExams').textContent = 'Error';
        document.getElementById('avgScore').textContent = 'Error';
        document.getElementById('highScore').textContent = 'Error';
    }

    function renderDashboard(attempts) {
        if (!attempts || attempts.length === 0) {
            document.getElementById('totalExams').textContent = '0';
            document.getElementById('avgScore').textContent = '0%';
            document.getElementById('highScore').textContent = '0%';
            renderChart([]);
            return;
        }

        const completedAttempts = attempts.filter(a => a.completedAt && a.totalScore != null);
        
        document.getElementById('totalExams').textContent = completedAttempts.length;

        if (completedAttempts.length > 0) {
            const sumScores = completedAttempts.reduce((sum, a) => sum + a.totalScore, 0);
            const avgScore = (sumScores / completedAttempts.length).toFixed(1);
            const highScore = Math.max(...completedAttempts.map(a => a.totalScore));
            
            document.getElementById('avgScore').textContent = `${avgScore}%`;
            document.getElementById('highScore').textContent = `${highScore}%`;
            
            // Sort chronologically for chart
            completedAttempts.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
            renderChart(completedAttempts);
        } else {
            document.getElementById('avgScore').textContent = '0%';
            document.getElementById('highScore').textContent = '0%';
            renderChart([]);
        }
    }

    function renderChart(attempts) {
        const ctx = document.getElementById('marksChart').getContext('2d');
        
        const labels = attempts.map(a => {
            const date = new Date(a.completedAt);
            return `${date.getMonth()+1}/${date.getDate()} ${a.exam?.title?.substring(0, 10) || 'Exam'}`;
        });
        const data = attempts.map(a => a.totalScore);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score (%)',
                    data: data,
                    borderColor: '#238636',
                    backgroundColor: 'rgba(35, 134, 54, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#2ea043',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#8b949e',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#161b22',
                        titleColor: '#c9d1d9',
                        bodyColor: '#c9d1d9',
                        borderColor: '#30363d',
                        borderWidth: 1
                    }
                }
            }
        });
    }
});
