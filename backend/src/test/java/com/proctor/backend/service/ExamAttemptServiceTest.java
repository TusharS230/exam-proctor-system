package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.AnswerDto;
import com.proctor.backend.dto.SubmitExamRequest;
import com.proctor.backend.model.AttemptStatus;
import com.proctor.backend.model.Exam;
import com.proctor.backend.model.ExamAttempt;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.ProctorLog;
import com.proctor.backend.model.Question;
import com.proctor.backend.model.QuestionType;
import com.proctor.backend.model.User;
import com.proctor.backend.model.UserRole;
import com.proctor.backend.repository.AnswerRepository;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ProctorLogRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for submitting and grading an exam attempt.
 * Repositories are mocked, so no database is needed.
 */
@ExtendWith(MockitoExtension.class)
class ExamAttemptServiceTest {

    private static final String TENANT = "kletech";
    private static final String STUDENT_EMAIL = "student@kletech.edu";

    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private AnswerRepository answerRepository;
    @Mock private ProctorLogRepository proctorLogRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ExamAttemptService service;

    private User student;
    private Organization organization;

    @BeforeEach
    void setUp() {
        organization = Organization.builder().id(UUID.randomUUID()).name("KLE Tech").tenantSlug(TENANT).build();
        student = User.builder()
                .id(UUID.randomUUID())
                .email(STUDENT_EMAIL)
                .role(UserRole.STUDENT)
                .organization(organization)
                .build();

        TenantContext.setCurrentTenant(TENANT);
        loginAs(STUDENT_EMAIL);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void mcqExam_isAutoGradedAsPercentage() {
        Question q1 = mcq("Private Cloud", 2);
        Question q2 = mcq("Network", 2);
        ExamAttempt attempt = attemptFor(examWith(q1, q2), OffsetDateTime.now());
        mockRepositories(attempt);

        // one right (ignoring case and spaces), one wrong
        SubmitExamRequest request = new SubmitExamRequest(List.of(
                new AnswerDto(q1.getId(), "  private cloud "),
                new AnswerDto(q2.getId(), "Transport")
        ));

        ExamAttempt result = service.submitExam(attempt.getId(), request);

        assertThat(result.getStatus()).isEqualTo(AttemptStatus.GRADED);
        assertThat(result.getTotalScore()).isEqualTo(50);
        assertThat(result.getCompletedAt()).isNotNull();
    }

    @Test
    void examWithTextQuestion_waitsForManualGrading() {
        Question q1 = mcq("Private Cloud", 2);
        Question q2 = Question.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.TEXT_RESPONSE)
                .marks(5)
                .build();
        ExamAttempt attempt = attemptFor(examWith(q1, q2), OffsetDateTime.now());
        mockRepositories(attempt);

        SubmitExamRequest request = new SubmitExamRequest(List.of(
                new AnswerDto(q1.getId(), "Private Cloud"),
                new AnswerDto(q2.getId(), "Consistency, availability and partition tolerance")
        ));

        ExamAttempt result = service.submitExam(attempt.getId(), request);

        assertThat(result.getStatus()).isEqualTo(AttemptStatus.SUBMITTED);
        assertThat(result.getTotalScore()).isNull(); // hidden until the admin grades it
    }

    @Test
    void studentCannotSubmitSomeoneElsesAttempt() {
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), OffsetDateTime.now());
        when(attemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));

        loginAs("other.student@kletech.edu");

        assertThatThrownBy(() -> service.submitExam(attempt.getId(), new SubmitExamRequest(List.of())))
                .isInstanceOf(AccessDeniedException.class);
        verify(answerRepository, never()).saveAll(anyList());
    }

    @Test
    void finishedAttemptCannotBeSubmittedTwice() {
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), OffsetDateTime.now());
        attempt.setStatus(AttemptStatus.GRADED);
        when(attemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> service.submitExam(attempt.getId(), new SubmitExamRequest(List.of())))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void lateSubmission_isSavedButFlagged() {
        // started 90 minutes ago, but the exam is only 60 minutes long
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), OffsetDateTime.now().minusMinutes(90));
        mockRepositories(attempt);

        ExamAttempt result = service.submitExam(attempt.getId(), new SubmitExamRequest(List.of()));

        assertThat(result.getStatus()).isEqualTo(AttemptStatus.GRADED);
        verify(proctorLogRepository).save(any(ProctorLog.class));
    }

    @Test
    void isLate_allowsTwoMinutesOfGrace() {
        OffsetDateTime start = OffsetDateTime.now();
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), start);

        assertThat(service.isLate(attempt, start.plusMinutes(61))).isFalse();
        assertThat(service.isLate(attempt, start.plusMinutes(63))).isTrue();
    }

    @Test
    void deadline_isTheExamClosingTime_whenThatComesFirst() {
        OffsetDateTime start = OffsetDateTime.now();
        Exam exam = examWith(mcq("A", 1));
        exam.setScheduledEndTime(start.plusMinutes(20)); // closes before the 60 minute limit
        ExamAttempt attempt = attemptFor(exam, start);

        assertThat(service.deadlineFor(attempt)).isEqualTo(start.plusMinutes(20));
        assertThat(service.isLate(attempt, start.plusMinutes(25))).isTrue();
    }

    @Test
    void abandonedAttempt_isClosedAutomatically() {
        // started 2 hours ago, the exam is only 60 minutes long
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), OffsetDateTime.now().minusHours(2));
        when(attemptRepository.findByStatus(AttemptStatus.IN_PROGRESS)).thenReturn(List.of(attempt));
        when(attemptRepository.save(any(ExamAttempt.class))).thenAnswer(call -> call.getArgument(0));

        int closed = service.closeExpiredAttempts(OffsetDateTime.now());

        assertThat(closed).isEqualTo(1);
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.GRADED);
        assertThat(attempt.getTotalScore()).isZero();
        verify(proctorLogRepository).save(any(ProctorLog.class));
    }

    @Test
    void runningAttempt_isLeftAlone() {
        ExamAttempt attempt = attemptFor(examWith(mcq("A", 1)), OffsetDateTime.now().minusMinutes(10));
        when(attemptRepository.findByStatus(AttemptStatus.IN_PROGRESS)).thenReturn(List.of(attempt));

        assertThat(service.closeExpiredAttempts(OffsetDateTime.now())).isZero();
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    // ---------- helpers ----------

    private void loginAs(String email) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(email, null));
    }

    private Question mcq(String correctAnswer, int marks) {
        return Question.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .marks(marks)
                .correctAnswer(correctAnswer)
                .build();
    }

    private Exam examWith(Question... questions) {
        return Exam.builder()
                .id(UUID.randomUUID())
                .title("Midterm")
                .durationMinutes(60)
                .organization(organization)
                .questions(List.of(questions))
                .build();
    }

    private ExamAttempt attemptFor(Exam exam, OffsetDateTime startedAt) {
        return ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .student(student)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(startedAt)
                .build();
    }

    private void mockRepositories(ExamAttempt attempt) {
        when(attemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(attemptRepository.save(any(ExamAttempt.class))).thenAnswer(call -> call.getArgument(0));
    }
}
