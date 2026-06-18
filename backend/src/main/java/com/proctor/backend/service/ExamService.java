package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.CreateExamRequest;
import com.proctor.backend.dto.QuestionDto;
import com.proctor.backend.exception.ResourceNotFoundException;
import com.proctor.backend.model.Exam;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.Question;
import com.proctor.backend.model.User;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final ExamAttemptRepository attemptRepository;

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
                .description(request.getDescription())
                .durationMinutes(request.getDurationMinutes())
                .organization(organization)
                .build();

        if (request.getScheduledStartTime() != null && !request.getScheduledStartTime().isEmpty()) {
            try {
                exam.setScheduledStartTime(java.time.OffsetDateTime.parse(request.getScheduledStartTime()));
            } catch(Exception e) {
                log.error("Failed to parse start time", e);
            }
        }
        if (request.getScheduledEndTime() != null && !request.getScheduledEndTime().isEmpty()) {
            try {
                exam.setScheduledEndTime(java.time.OffsetDateTime.parse(request.getScheduledEndTime()));
            } catch(Exception e) {
                log.error("Failed to parse end time", e);
            }
        }

        // process the nested question safely
        List<Question> mappedQuestions = new ArrayList<>();

        if(request.getQuestions() != null) {
            for(QuestionDto qDto : request.getQuestions()) {
                Question question = Question.builder()
                        .questionText(qDto.getQuestionText())
                        .questionType(qDto.getQuestionType())
                        .marks(qDto.getMarks())
                        .correctAnswer(qDto.getCorrectAnswer())
                        .options(qDto.getOptions() != null ? qDto.getOptions() : new java.util.ArrayList<>())
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

    @Transactional(readOnly = true)
    public Exam getExamById(UUID examId) {
        //identify who is asking
        String tenantSlug = TenantContext.getCurrentTenant();
        log.info("Fetching exam {} for tenant: {}", examId, tenantSlug);

        // fetch the tenant's organization record
        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found for tenant: " + tenantSlug));

        // fetch the exam and verify it belongs to this exact organization
        return examRepository.findById(examId)
                .filter(exam -> exam.getOrganization().getId().equals(organization.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found or you do not have permissionto view it"));
    }

    @Transactional(readOnly = true)
    public List<Exam> getAllExams() {
        String tenantSlug = TenantContext.getCurrentTenant();
        log.info("Fetching all exams for tenant: {}", tenantSlug);

        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found for tenant: " + tenantSlug));

        List<Exam> allExams = examRepository.findByOrganizationId(organization.getId());

        // if the current user is a STUDENT, filter to only exams they are assigned to AND haven't attempted yet
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (currentUser.getRole() == com.proctor.backend.model.UserRole.STUDENT) {
            java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
            return allExams.stream()
                    .filter(exam -> exam.getAssignedStudents() != null && exam.getAssignedStudents().stream().anyMatch(student -> student.getId().equals(currentUser.getId())))
                    .filter(exam -> attemptRepository.findByStudentIdAndExamId(currentUser.getId(), exam.getId()).isEmpty())
                    .filter(exam -> exam.getScheduledEndTime() == null || !exam.getScheduledEndTime().isBefore(now))
                    .collect(java.util.stream.Collectors.toList());
        }

        // if admin, return all
        return allExams;
    }

    @Transactional(readOnly = true)
    public List<Exam> getMissedExams() {
        String tenantSlug = TenantContext.getCurrentTenant();
        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found for tenant: " + tenantSlug));

        List<Exam> allExams = examRepository.findByOrganizationId(organization.getId());

        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (currentUser.getRole() == com.proctor.backend.model.UserRole.STUDENT) {
            java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
            return allExams.stream()
                    .filter(exam -> exam.getAssignedStudents() != null && exam.getAssignedStudents().stream().anyMatch(student -> student.getId().equals(currentUser.getId())))
                    .filter(exam -> attemptRepository.findByStudentIdAndExamId(currentUser.getId(), exam.getId()).isEmpty())
                    .filter(exam -> exam.getScheduledEndTime() != null && exam.getScheduledEndTime().isBefore(now))
                    .collect(java.util.stream.Collectors.toList());
        }

        return new ArrayList<>();
    }

    @Transactional
    public Exam assignExam(UUID examId, List<UUID> studentIds) {
        String tenantSlug = TenantContext.getCurrentTenant();
        
        Exam exam = examRepository.findById(examId)
                .filter(e -> e.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found or you do not have permission"));

        List<User> students = userRepository.findAllById(studentIds).stream()
                .filter(u -> u.getOrganization().getTenantSlug().equals(tenantSlug))
                .filter(u -> u.getRole() == com.proctor.backend.model.UserRole.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        exam.setAssignedStudents(students);
        return examRepository.save(exam);
    }

    public Exam updateExamStatus(UUID examId, String newStatus) {
        Exam exam = getExamById(examId);
        exam.setStatus(newStatus.toUpperCase());
        return examRepository.save(exam);
    }
}
