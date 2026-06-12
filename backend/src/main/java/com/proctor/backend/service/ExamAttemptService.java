package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.AnswerDto;
import com.proctor.backend.dto.SubmitExamRequest;
import com.proctor.backend.exception.ResourceNotFoundException;
import com.proctor.backend.model.*;
import com.proctor.backend.repository.AnswerRepository;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    // start the exam
    @Transactional
    public ExamAttempt startExam(UUID examId, UUID studentId) {
        String tenantSlug  = TenantContext.getCurrentTenant();
        log.info("Student {} is starting exam {} from tenant {}", studentId, examId, tenantSlug);

        // verify exam exists and belongs to this tenant
        Exam exam = examRepository.findById(examId)
                .filter(e -> e.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("exam not found"));

        // verify student exists and belongs to this school
        User student = userRepository.findById(studentId)
                .filter(u -> u.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("student not found"));

        // anti cheat, prevent multiple attempts
        if(attemptRepository.findByStudentIdAndExamId(studentId, examId).isPresent()) {
            throw new IllegalStateException("you have already started or completed this exam");
        }

        // create the attempt
        ExamAttempt attempt = ExamAttempt.builder()
                .exam(exam)
                .student(student)
                .build();

        return attemptRepository.save(attempt);
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

        // match the student's incoming answers to the official questions
        List<Answer> answersToSave = mapStudentAnswersToQuestions(request, attempt);

        // batch save all answers to postgresql
        answerRepository.saveAll(answersToSave);

        // lock the exam state
        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setCompletedAt(OffsetDateTime.now());

        return attemptRepository.save(attempt);
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
                    answersToSave.add(Answer.builder()
                            .examAttempt(attempt)
                            .question(question)
                            .providedAnswer(dto.getProvidedAnswer())
                            .build());
                }
            }
        }
        return answersToSave;
    }
}
