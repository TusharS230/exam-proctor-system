document.addEventListener('DOMContentLoaded', () => {
    // Set tenant in sidebar
    const tenantId = sessionStorage.getItem('tenant_id');
    document.getElementById('sidebarTenant').textContent = tenantId || 'Unknown';

    const questionsList = document.getElementById('questionsList');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const createExamForm = document.getElementById('createExamForm');

    let questionCount = 0;

    // Load students for assignment
    const token = sessionStorage.getItem('jwt_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    async function loadStudents() {
        try {
            const students = await ApiClient.get('/users/students');
            const container = document.getElementById('studentListContainer');
            container.innerHTML = '';
            if (students && students.length === 0) {
                container.innerHTML = '<div class="muted">No students found.</div>';
            }
            if (students) {
                students.forEach(student => {
                    // Only show active students
                    if(!student.active) return;
                    const div = document.createElement('div');
                    div.className = 'mb-1';
                    div.innerHTML = `
                        <label class="flex align-center gap-1">
                            <input type="checkbox" class="student-checkbox" value="${student.id}" checked>
                            <span>${student.email}</span>
                        </label>
                    `;
                    container.appendChild(div);
                });
            }
        } catch(e) {
            document.getElementById('studentListContainer').innerHTML = '<div class="text-red">Connection error.</div>';
        }
    }
    loadStudents();

    function updateTotalMarks() {
        let total = 0;
        document.querySelectorAll('.q-marks').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        const display = document.getElementById('totalMarksDisplay');
        if (display) display.textContent = total;
    }

    questionsList.addEventListener('input', (e) => {
        if(e.target.classList.contains('q-marks')) {
            updateTotalMarks();
        }
    });

    function addQuestion() {
        questionCount++;
        const qDiv = document.createElement('div');
        qDiv.className = 'question-block';
        qDiv.dataset.questionId = questionCount;

        qDiv.innerHTML = `
            <div class="flex space-between align-center mb-2">
                <h4 class="m-0">Question ${questionCount}</h4>
                <button type="button" class="remove-btn btn-danger small">Remove</button>
            </div>
            <div class="mb-2">
                <label class="block mb-1">Question Text</label>
                <textarea class="form-input q-text" required rows="2" placeholder="Enter the question"></textarea>
            </div>
            <div class="flex gap-2 mb-2">
                <div class="grow">
                    <label class="block mb-1">Type</label>
                    <select class="form-input q-type" required>
                        <option value="TEXT_RESPONSE">Text Response</option>
                        <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    </select>
                </div>
                <div class="grow">
                    <label class="block mb-1">Marks</label>
                    <input type="number" class="form-input q-marks" value="5" required min="1">
                </div>
            </div>
            <div class="answer-section hidden">
                <label class="block mb-1">Correct Answer (Required for evaluation)</label>
                <input type="text" class="form-input q-answer" placeholder="Enter the expected answer">
            </div>
            <div class="mc-options-section hidden mb-2">
                <label class="block mb-1 bold">Options (Select the radio button next to the correct answer)</label>
                <div class="options-container"></div>
                <button type="button" class="add-option-btn btn-secondary mt-1 small">+ Add Option</button>
            </div>
        `;

        const typeSelect = qDiv.querySelector('.q-type');
        const answerSection = qDiv.querySelector('.answer-section');
        const answerInput = qDiv.querySelector('.q-answer');
        const mcSection = qDiv.querySelector('.mc-options-section');
        const optionsContainer = qDiv.querySelector('.options-container');
        const addOptionBtn = qDiv.querySelector('.add-option-btn');

        typeSelect.addEventListener('change', (e) => {
            if(e.target.value === 'MULTIPLE_CHOICE') {
                answerSection.style.display = 'none';
                answerInput.required = false;
                mcSection.style.display = 'block';

                if(optionsContainer.children.length === 0) {
                    addOptionBtn.click();
                    addOptionBtn.click();
                }
            } else {
                answerSection.style.display = 'none';
                answerInput.required = false;
                mcSection.style.display = 'none';
            }
        });

        addOptionBtn.addEventListener('click', () => {
            const optDiv = document.createElement('div');
            optDiv.className = 'mc-option';

            optDiv.innerHTML = `
                <input type="radio" name="correct_mc_${questionCount}" class="mc-correct-radio" required title="Select as correct answer">
                <input type="text" class="form-input mc-option-text grow" placeholder="Enter option" required>
                <button type="button" class="remove-opt-btn text-red no-border large">&times;</button>
            `;

            optDiv.querySelector('.remove-opt-btn').addEventListener('click', () => {
                optDiv.remove();
            });
            optionsContainer.appendChild(optDiv);
        });

        qDiv.querySelector('.remove-btn').addEventListener('click', () => {
            qDiv.remove();
            updateTotalMarks();
        });

        questionsList.appendChild(qDiv);
        updateTotalMarks();
    }

    // Add one question by default
    addQuestion();

    addQuestionBtn.addEventListener('click', addQuestion);

    createExamForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('examTitle').value;
        const description = document.getElementById('examDesc').value;
        const durationMinutes = document.getElementById('examDuration').value;
        const startTimeVal = document.getElementById('examStartTime').value;
        const endTimeVal = document.getElementById('examEndTime').value;

        const scheduledStartTime = startTimeVal ? new Date(startTimeVal).toISOString() : null;
        const scheduledEndTime = endTimeVal ? new Date(endTimeVal).toISOString() : null;

        const questionBlocks = document.querySelectorAll('.question-block');
        const questions = [];

        questionBlocks.forEach(block => {
            const qType = block.querySelector('.q-type').value;
            let correctAnswer = '';
            let options = [];

            if (qType === 'TEXT_RESPONSE') {
                correctAnswer = block.querySelector('.q-answer').value;
            } else if (qType === 'MULTIPLE_CHOICE') {
                const optionElems = block.querySelectorAll('.mc-option');
                optionElems.forEach(opt => {
                    const text = opt.querySelector('.mc-option-text').value;
                    options.push(text);
                    if (opt.querySelector('.mc-correct-radio').checked) {
                        correctAnswer = text;
                    }
                });
            }

            questions.push({
                questionText: block.querySelector('.q-text').value,
                questionType: qType,
                marks: parseInt(block.querySelector('.q-marks').value),
                correctAnswer: correctAnswer,
                options: options
            });
        });

        const payload = {
            title,
            description,
            durationMinutes: parseInt(durationMinutes),
            scheduledStartTime,
            scheduledEndTime,
            questions
        };

        try {
            const btn = document.getElementById('saveExamBtn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            // 1. Create Exam
            const createdExam = await ApiClient.post('/exams', payload);

            // 2. Assign Students
            const checkedStudents = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
            if(checkedStudents.length > 0) {
                await ApiClient.post(`/exams/${createdExam.id}/assign`, checkedStudents);
            }

            Toast.success('Exam created and assigned successfully!');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } catch (error) {
            console.error(error);
            document.getElementById('saveExamBtn').disabled = false;
            document.getElementById('saveExamBtn').textContent = 'Save Exam';
        }
    });
});
