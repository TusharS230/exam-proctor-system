package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.CreateExamRequest;
import com.proctor.backend.dto.QuestionDto;
import com.proctor.backend.model.Exam;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.Question;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.OrganizationRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final OrganizationRepository organizationRepository;

    @Transactional
    public Exam createExam(CreateExamRequest request) {

        // lockdown the tenant security boundary
        String tenantSlug = TenantContext.getCurrentTenant();
        log.info("Creating new exam tenant: {}", tenantSlug);

        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new RuntimeException("Organization not found for tenant: " + tenantSlug));

        // initialize the parent exam entity
        Exam exam = Exam.builder()
                .title(request.getTitle())
                .description((request.getDescription()))
                .durationMinutes((request.getDurationMinutes()))
                .organization(organization)
                .build();

        // process the nested question safely
        List<Question> mappedQuestions = new ArrayList<>();

        if(request.getQuestions() != null) {
            for(QuestionDto qDto : request.getQuestions()) {
                Question question = Question.builder()
                        .questionText((qDto.getQuestionText()))
                        .questionType(qDto.getQuestionType())
                        .marks(qDto.getMarks())
                        .exam(exam)
                        .build();

                mappedQuestions.add(question);
            }
        }

        // attach question list to the exam
        exam.setQuestions(mappedQuestions);

        // fire the transaction
        // because of cascadeType.ALL, saving the exam automatically saves all attached questions into the database
        return examRepository.save(exam);
    }
}
