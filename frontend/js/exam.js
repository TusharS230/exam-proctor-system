document.addEventListener('DOMContentLoaded', () => {

    // Automatically load exam on page load
    let examIsActive = false;
    async function initExam() {
        const token = sessionStorage.getItem('jwt_token');
        if (!token) {
            alert("No authentication token found. Please log in.");
            window.location.href = "index.html";
            return;
        }

        try {
            // 1. Fetch active attempt
            const attempt = await ApiClient.get('/attempts/my-active');
            if (!attempt) {
                document.getElementById('examQuestionsContainer').innerHTML = "<div style='padding:2rem;text-align:center'>No active exams found for you.</div>";
                return;
            }

            window.currentAttemptId = attempt.id;
            
            // 2. Fetch the actual exam questions
            const examData = await ApiClient.get(`/exams/${attempt.exam.id}`);

            // 3. Render
            document.getElementById('examTitleDisplay').textContent = examData.title;
            renderQuestions(examData.questions);
            document.getElementById('submitExamBtn').style.display = 'block';

            // 4. Securely connect the WebSocket
            window.proctorWS.connect(token);
            examIsActive = true;

            // 5. Start the timer
            startTimer(attempt.startedAt, examData.durationMinutes);

        } catch (e) {
            console.error(e);
            Toast.error("Error loading exam");
        }
    }

    let timerInterval;

    function startTimer(startedAtIso, durationMinutes) {
        const startTime = new Date(startedAtIso).getTime();
        const durationMs = durationMinutes * 60 * 1000;
        const endTime = startTime + durationMs;

        const timerDisplay = document.getElementById('examTimer');

        function updateTimer() {
            const now = Date.now();
            const remainingMs = endTime - now;

            if (remainingMs <= 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = "00:00";
                timerDisplay.style.color = "var(--danger)";
                Toast.error("Time is up! Auto-submitting your exam...");
                submitExam();
                return;
            }

            const totalSeconds = Math.floor(remainingMs / 1000);
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            
            timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            if (totalSeconds < 300) { // last 5 minutes
                timerDisplay.style.color = "var(--danger)";
            }
        }

        // initial call
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    function renderQuestions(questions) {
        const container = document.getElementById('examQuestionsContainer');
        container.innerHTML = '';
        
        questions.forEach((q, index) => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.style.marginBottom = '2rem';
            
            let answerInputHTML = '';
            if (q.questionType === 'MULTIPLE_CHOICE' && q.options && q.options.length > 0) {
                let optionsHtml = '';
                q.options.forEach((opt, idx) => {
                    optionsHtml += `
                        <label style="display:block; margin-bottom: 0.5rem; cursor:pointer;">
                            <input type="radio" name="student_mc_${q.id}" class="mc-radio-input" data-qid="${q.id}" value="${opt.replace(/"/g, '&quot;')}">
                            ${opt}
                        </label>
                    `;
                });
                answerInputHTML = `
                    <div class="options-list student-answer-mc-container" data-qid="${q.id}">
                        ${optionsHtml}
                    </div>
                `;
            } else {
                answerInputHTML = `
                    <textarea class="form-control student-answer-input" data-qid="${q.id}" rows="4" placeholder="Write your response..."></textarea>
                `;
            }

            qCard.innerHTML = `
                <span class="question-number">Question ${index + 1}</span>
                <div class="question-text">${q.questionText} [${q.marks} Marks]</div>
                ${answerInputHTML}
            `;
            container.appendChild(qCard);
        });
    }

    // Submit logic
    document.getElementById('submitExamBtn').addEventListener('click', () => {
        if(confirm("Are you sure you want to submit your exam? You cannot change your answers after submission.")) {
            submitExam();
        }
    });

    async function submitExam() {
        if (!examIsActive) return;
        
        const attemptId = window.currentAttemptId;
        const answers = [];

        // Collect text responses
        const textInputs = document.querySelectorAll('.student-answer-input');
        textInputs.forEach(input => {
            answers.push({
                questionId: input.getAttribute('data-qid'),
                providedAnswer: input.value
            });
        });

        // Collect MC responses
        const mcContainers = document.querySelectorAll('.student-answer-mc-container');
        mcContainers.forEach(container => {
            const qid = container.getAttribute('data-qid');
            const selectedRadio = container.querySelector(`input[name="student_mc_${qid}"]:checked`);
            if (selectedRadio) {
                answers.push({
                    questionId: qid,
                    providedAnswer: selectedRadio.value
                });
            }
        });

        try {
            await ApiClient.post(`/attempts/${attemptId}/submit`, { answers: answers });
            // Disconnect socket & clear timer
            window.proctorWS.disconnect();
            if (timerInterval) clearInterval(timerInterval);
            examIsActive = false;
            
            Toast.success("Exam submitted successfully!");
            setTimeout(() => {
                window.location.href = "student-dashboard.html";
            }, 1500);
        } catch (e) {
            console.error(e);
            Toast.error("Failed to submit exam.");
        }
    }

    // Boot
    initExam();



    // ==========================================
    // ANTI-CHEAT: Automated Browser Event Detection
    // ==========================================

    function sendAutomatedViolation(type, details) {
        if (examIsActive && window.proctorWS.isConnected) {
            const attemptId = window.currentAttemptId;
            if(attemptId) {
                window.proctorWS.sendViolation(attemptId, type, details);
            }
        }
    }

    // We use a small timeout to distinguish between a simple blur (clicking another monitor)
    // and a tab switch (which fires both blur and visibilitychange in quick succession).
    let blurTimeout;

    // 1. Tab Switch / Window Minimize
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearTimeout(blurTimeout); // Cancel blur alert if it was actually a tab switch
            sendAutomatedViolation("TAB_SWITCH", "User switched tabs or minimized the browser window.");
        }
    });

    // 2. Window Blur (Clicked outside the browser window, e.g., dual monitors)
    window.addEventListener("blur", () => {
        blurTimeout = setTimeout(() => {
            if (!document.hidden) {
                sendAutomatedViolation("WINDOW_BLUR", "Browser window lost focus. Possible use of another application.");
            }
        }, 150);
    });

    // 3. Right Click Prevention
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        sendAutomatedViolation("RIGHT_CLICK", "User attempted to right-click or open context menu.");
    });

    // 4. Copy/Paste/Cut Prevention
    ['copy', 'cut', 'paste'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            e.preventDefault();
            sendAutomatedViolation("CLIPBOARD_ACTION", `User attempted to ${eventName} content.`);
        });
    });

    // 5. Prevent specific keyboard shortcuts (F12, Ctrl+C, etc)
    document.addEventListener("keydown", (e) => {
        // Prevent F12 (DevTools)
        if (e.key === "F12") {
            e.preventDefault();
            sendAutomatedViolation("DEV_TOOLS", "User attempted to open developer tools (F12).");
        }
        
        // Prevent Ctrl/Cmd + C, V, X, P
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 'i', 'u'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            sendAutomatedViolation("KEYBOARD_SHORTCUT", `User attempted shortcut: Ctrl+${e.key.toUpperCase()}`);
        }
    });
});
