package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.AnswerDto;
import com.proctor.backend.dto.ProctorEventDto;
import com.proctor.backend.dto.SubmitExamRequest;
import com.proctor.backend.exception.ResourceNotFoundException;
import com.proctor.backend.model.*;
import com.proctor.backend.repository.AnswerRepository;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.ProctorLogRepository;
import com.proctor.backend.repository.UserRepository;
import com.proctor.backend.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamAttemptService {

    private final ExamAttemptRepository attemptRepository;
    private final AnswerRepository answerRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final ProctorLogRepository proctorLogRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // start the exam
    @Transactional
    public ExamAttempt startExam(UUID examId) {
        String tenantSlug  = TenantContext.getCurrentTenant();
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        
        User student = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("student not found"));

        log.info("Student {} is starting exam {} from tenant {}", student.getId(), examId, tenantSlug);

        // verify exam exists and belongs to this tenant
        Exam exam = examRepository.findById(examId)
                .filter(e -> e.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("exam not found"));

        // anti cheat, prevent multiple attempts
        if(attemptRepository.findByStudentIdAndExamId(student.getId(), examId).isPresent()) {
            throw new IllegalStateException("you have already started or completed this exam");
        }

        // create the attempt
        ExamAttempt attempt = ExamAttempt.builder()
                .exam(exam)
                .student(student)
                .status(AttemptStatus.IN_PROGRESS)
                .build();

        ExamAttempt savedAttempt = attemptRepository.save(attempt);

        // Broadcast EXAM_STARTED event
        ProctorEventDto eventDto = new ProctorEventDto();
        eventDto.setExamAttemptId(savedAttempt.getId().toString());
        eventDto.setStudentEmail(savedAttempt.getStudent().getEmail());
        eventDto.setExamTitle(exam.getTitle());
        eventDto.setEventType("EXAM_STARTED");
        eventDto.setDetails("Student has started the exam.");
        eventDto.setTimestamp(OffsetDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/proctor/tenant/" + tenantSlug, eventDto);

        return savedAttempt;
    }

    // get active attempts for the dashboard
    @Transactional(readOnly = true)
    public List<ExamAttempt> getActiveAttempts() {
        String tenantSlug = TenantContext.getCurrentTenant();
        log.info("Fetching active attempts for tenant {}", tenantSlug);

        return attemptRepository.findByStatus(AttemptStatus.IN_PROGRESS).stream()
                .filter(a -> a.getExam().getOrganization().getTenantSlug().equals(tenantSlug))
                .collect(Collectors.toList());
    }

    // get my active attempt (for the student frontend)
    @Transactional(readOnly = true)
    public ExamAttempt getMyActiveAttempt() {
        String tenantSlug = TenantContext.getCurrentTenant();
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();

        User student = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        return attemptRepository.findByStatus(AttemptStatus.IN_PROGRESS).stream()
                .filter(a -> a.getStudent().getId().equals(student.getId()) && a.getExam().getOrganization().getTenantSlug().equals(tenantSlug))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No active exam found for this student"));
    }

    // submit the exam
    @Transactional
    public ExamAttempt submitExam(UUID attemptId, SubmitExamRequest request) {
        String tenantSlug = TenantContext.getCurrentTenant();

        // find the attempt and securely verify tenant ownership
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(a -> a.getExam().getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("exam attempt not found"));

        // check: you can't submit exam that is already finished
        if(attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new IllegalStateException("this exam is no longer in progress");
        }

        // map, evaluate, and score the student's answers in memory
        List<Answer> answersToSave = mapStudentAnswersToQuestions(request, attempt);

        // batch save all answers to postgresql
        answerRepository.saveAll(answersToSave);

        // count auto-graded marks from our processed list
        int totalPossibleMarks = attempt.getExam().getQuestions().stream().mapToInt(com.proctor.backend.model.Question::getMarks).sum();
        
        int autoScoredMarks = answersToSave.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                .mapToInt(a -> a.getQuestion().getMarks())
                .sum();

        boolean hasTextQuestions = attempt.getExam().getQuestions().stream()
                .anyMatch(q -> q.getQuestionType() == com.proctor.backend.model.QuestionType.TEXT_RESPONSE);

        if (hasTextQuestions) {
            // Need manual grading
            attempt.setStatus(AttemptStatus.SUBMITTED);
            attempt.setTotalScore(null); // hide it until GRADED
        } else {
            // Fully auto-graded
            int finalPercentageScore = totalPossibleMarks > 0 ? (int) Math.round(((double) autoScoredMarks / totalPossibleMarks) * 100.0) : 0;
            attempt.setStatus(AttemptStatus.GRADED);
            attempt.setTotalScore(finalPercentageScore);
        }

        attempt.setCompletedAt(OffsetDateTime.now());

        log.info("exam submission complete for attempt {}. status: {}", attemptId, attempt.getStatus());

        ExamAttempt savedAttempt = attemptRepository.save(attempt);

        // Broadcast EXAM_COMPLETED event
        ProctorEventDto eventDto = new ProctorEventDto();
        eventDto.setExamAttemptId(savedAttempt.getId().toString());
        eventDto.setStudentEmail(savedAttempt.getStudent().getEmail());
        eventDto.setExamTitle(savedAttempt.getExam().getTitle());
        eventDto.setEventType("EXAM_COMPLETED");
        eventDto.setDetails("Student has completed and submitted the exam.");
        eventDto.setTimestamp(OffsetDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/proctor/tenant/" + tenantSlug, eventDto);

        return savedAttempt;
    }

    // Private helper methods
    private List<Answer> mapStudentAnswersToQuestions(SubmitExamRequest request, ExamAttempt attempt) {
        // map the exam's official questions into memory for ultra-fast lookups
        Map<UUID, Question> officialQuestions = attempt.getExam().getQuestions().stream()
                .collect(Collectors.toMap(Question::getId, q -> q));

        List<Answer> answersToSave = new ArrayList<>();

        if(request.getAnswers() != null) {
            for(AnswerDto dto : request.getAnswers()) {
                Question question = officialQuestions.get(dto.getQuestionId());
                if(question != null) {

                    // evaluation algorithm: strip spaces and ignore casing
                    Boolean isCorrect = null;
                    Integer marksAwarded = null;
                    
                    if (question.getQuestionType() == com.proctor.backend.model.QuestionType.MULTIPLE_CHOICE) {
                        isCorrect = false;
                        marksAwarded = 0;
                        if(dto.getProvidedAnswer() != null && question.getCorrectAnswer() != null) {
                            isCorrect = question.getCorrectAnswer().trim()
                                    .equalsIgnoreCase(dto.getProvidedAnswer().trim());
                        }
                        marksAwarded = Boolean.TRUE.equals(isCorrect) ? question.getMarks() : 0;
                    }

                    answersToSave.add(Answer.builder()
                            .examAttempt(attempt)
                            .question(question)
                            .providedAnswer(dto.getProvidedAnswer())
                            .isCorrect(isCorrect)
                            .marksAwarded(marksAwarded)
                            .build());
                }
            }
        }
        return answersToSave;
    }

    @Transactional(readOnly = true)
    public List<ExamAttempt> getHistory() {
        String tenantSlug = TenantContext.getCurrentTenant();
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        
        User user = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        if (user.getRole() == com.proctor.backend.model.UserRole.STUDENT) {
            return attemptRepository.findByStudentId(user.getId());
        } else {
            return attemptRepository.findByExamOrganizationId(user.getOrganization().getId());
        }
    }

    @Transactional(readOnly = true)
    public List<com.proctor.backend.model.ProctorLog> getLogsForAttempt(UUID attemptId) {
        // Find the attempt
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("attempt not found"));

        // Authorize user (ensure they are org admin for this attempt's exam or the student)
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        boolean isStudent = user.getRole() == com.proctor.backend.model.UserRole.STUDENT && attempt.getStudent().getId().equals(user.getId());
        boolean isOrgAdmin = user.getRole() == com.proctor.backend.model.UserRole.ORG_ADMIN && attempt.getExam().getOrganization().getId().equals(user.getOrganization().getId());

        if (!isStudent && !isOrgAdmin) {
            throw new RuntimeException("Unauthorized to view logs for this attempt");
        }

        return proctorLogRepository.findByExamAttemptId(attemptId.toString());
    }

    @Transactional
    public ExamAttempt gradeAttempt(UUID attemptId, com.proctor.backend.dto.GradeSubmissionRequest request) {
        String tenantSlug = TenantContext.getCurrentTenant();
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(a -> a.getExam().getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("attempt not found"));

        if (attempt.getStatus() != AttemptStatus.SUBMITTED && attempt.getStatus() != AttemptStatus.GRADED) {
            throw new IllegalStateException("Attempt must be SUBMITTED or GRADED to be manually graded.");
        }

        // fetch answers for this attempt
        List<Answer> answers = answerRepository.findByExamAttemptId(attemptId);
        java.util.Map<UUID, Answer> answerMap = answers.stream().collect(Collectors.toMap(Answer::getId, a -> a));

        // apply manual grades
        if (request.getGrades() != null) {
            for (com.proctor.backend.dto.GradeSubmissionRequest.GradeItem item : request.getGrades()) {
                Answer answer = answerMap.get(item.getAnswerId());
                if (answer != null) {
                    Integer awarded = item.getMarksAwarded();
                    Integer maxMarks = answer.getQuestion().getMarks();
                    if (awarded != null && maxMarks != null) {
                        if (awarded > maxMarks) awarded = maxMarks;
                        if (awarded < 0) awarded = 0;
                    }
                    answer.setMarksAwarded(awarded);
                    answer.setIsCorrect(awarded != null && awarded > 0);
                }
            }
        }
        answerRepository.saveAll(answers);

        // recalculate final total score
        int totalPossibleMarks = attempt.getExam().getQuestions().stream().mapToInt(com.proctor.backend.model.Question::getMarks).sum();
        int totalAwardedMarks = answers.stream()
                .filter(a -> a.getMarksAwarded() != null)
                .mapToInt(Answer::getMarksAwarded)
                .sum();

        int finalPercentageScore = totalPossibleMarks > 0 ? (int) Math.round(((double) totalAwardedMarks / totalPossibleMarks) * 100.0) : 0;
        attempt.setStatus(AttemptStatus.GRADED);
        attempt.setTotalScore(finalPercentageScore);

        return attemptRepository.save(attempt);
    }

    @Transactional(readOnly = true)
    public List<com.proctor.backend.dto.AnswerResponseDto> getAnswersForAttempt(UUID attemptId) {
        String tenantSlug = TenantContext.getCurrentTenant();
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(a -> a.getExam().getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("attempt not found"));

        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        boolean isOwner = currentUser.getId().equals(attempt.getStudent().getId());
        boolean isOrgAdmin = currentUser.getRole() == com.proctor.backend.model.UserRole.ORG_ADMIN 
                            && currentUser.getOrganization().getId().equals(attempt.getExam().getOrganization().getId());

        if (!isOwner && !isOrgAdmin) {
            throw new RuntimeException("Unauthorized to view answers");
        }

        List<Answer> answers = answerRepository.findByExamAttemptId(attemptId);
        
        return answers.stream().map(ans -> {
            com.proctor.backend.dto.AnswerResponseDto.QuestionDto questionDto = com.proctor.backend.dto.AnswerResponseDto.QuestionDto.builder()
                    .id(ans.getQuestion().getId())
                    .questionText(ans.getQuestion().getQuestionText())
                    .questionType(ans.getQuestion().getQuestionType())
                    .marks(ans.getQuestion().getMarks())
                    .build();
            
            return com.proctor.backend.dto.AnswerResponseDto.builder()
                    .id(ans.getId())
                    .providedAnswer(ans.getProvidedAnswer())
                    .isCorrect(ans.getIsCorrect())
                    .marksAwarded(ans.getMarksAwarded())
                    .question(questionDto)
                    .build();
        }).collect(Collectors.toList());
    }
}
