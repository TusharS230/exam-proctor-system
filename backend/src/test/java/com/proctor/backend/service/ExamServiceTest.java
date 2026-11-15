package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.CreateExamRequest;
import com.proctor.backend.dto.QuestionDto;
import com.proctor.backend.model.Exam;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.QuestionType;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for creating an exam: a broken exam must never be saved.
 */
@ExtendWith(MockitoExtension.class)
class ExamServiceTest {

    @Mock private ExamRepository examRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private ExamAttemptRepository attemptRepository;

    @InjectMocks
    private ExamService examService;

    @BeforeEach
    void setUp() {
        TenantContext.setCurrentTenant("kletech");
        Organization organization = Organization.builder().id(UUID.randomUUID()).name("KLE Tech").tenantSlug("kletech").build();
        when(organizationRepository.findByTenantSlug("kletech")).thenReturn(Optional.of(organization));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void validExam_isSaved() {
        when(examRepository.save(any(Exam.class))).thenAnswer(call -> call.getArgument(0));

        Exam saved = examService.createExam(request(mcq("Network", "Data Link", "Network")));

        assertThat(saved.getQuestions()).hasSize(1);
        assertThat(saved.getTitle()).isEqualTo("Midterm");
    }

    @Test
    void mcqWithoutCorrectAnswer_isRejected() {
        assertThatThrownBy(() -> examService.createExam(request(mcq("", "Data Link", "Network"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("correct answer");
        verify(examRepository, never()).save(any());
    }

    @Test
    void mcqWithOneOption_isRejected() {
        assertThatThrownBy(() -> examService.createExam(request(mcq("Network", "Network"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("two options");
    }

    @Test
    void examWithoutQuestions_isRejected() {
        CreateExamRequest request = request();
        assertThatThrownBy(() -> examService.createExam(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one question");
    }

    @Test
    void endTimeBeforeStartTime_isRejected() {
        CreateExamRequest request = request(mcq("Network", "Data Link", "Network"));
        request.setScheduledStartTime("2026-12-01T10:00:00Z");
        request.setScheduledEndTime("2026-12-01T09:00:00Z");

        assertThatThrownBy(() -> examService.createExam(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("end time");
    }

    // ---------- helpers ----------

    private CreateExamRequest request(QuestionDto... questions) {
        return CreateExamRequest.builder()
                .title("Midterm")
                .description("Unit 1 to 3")
                .durationMinutes(60)
                .questions(List.of(questions))
                .build();
    }

    private QuestionDto mcq(String correctAnswer, String... options) {
        return QuestionDto.builder()
                .questionText("Which OSI layer handles routing?")
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .marks(2)
                .correctAnswer(correctAnswer)
                .options(List.of(options))
                .build();
    }
}
