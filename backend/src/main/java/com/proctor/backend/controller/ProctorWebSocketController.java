package com.proctor.backend.controller;

import com.proctor.backend.dto.ProctorEventDto;
import com.proctor.backend.model.AttemptStatus;
import com.proctor.backend.model.ExamAttempt;
import com.proctor.backend.model.ProctorLog;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ProctorLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ProctorWebSocketController {

    private final ProctorLogRepository proctorLogRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // the student's browser sends violations to "/app/proctor/violation"
    @MessageMapping("/proctor/violation")
    @Transactional
    public void handleProctorEvent(ProctorEventDto eventDto, Principal principal) {
        Optional<ExamAttempt> found = findAttempt(eventDto.getExamAttemptId());
        if (found.isEmpty()) {
            log.warn("Ignored proctor event for unknown attempt id {}", eventDto.getExamAttemptId());
            return;
        }
        ExamAttempt attempt = found.get();

        // a student can only report events for their own, running attempt
        if (principal == null || !attempt.getStudent().getEmail().equals(principal.getName())) {
            log.warn("Ignored proctor event for attempt {} sent by another user", attempt.getId());
            return;
        }
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return;
        }

        log.info("Proctor event {} for attempt {}", eventDto.getEventType(), attempt.getId());

        ProctorLog proctorLog = new ProctorLog();
        proctorLog.setExamAttemptId(attempt.getId().toString());
        proctorLog.setEventType(eventDto.getEventType());
        proctorLog.setDetails(eventDto.getDetails());
        proctorLogRepository.save(proctorLog);

        // add student and exam details, then push the alert to that organization's live dashboard
        eventDto.setStudentEmail(attempt.getStudent().getEmail());
        eventDto.setExamTitle(attempt.getExam().getTitle());
        String tenantSlug = attempt.getExam().getOrganization().getTenantSlug();
        messagingTemplate.convertAndSend("/topic/proctor/tenant/" + tenantSlug, eventDto);
    }

    private Optional<ExamAttempt> findAttempt(String attemptId) {
        try {
            return examAttemptRepository.findByIdWithDetails(UUID.fromString(attemptId));
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
