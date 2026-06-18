package com.proctor.backend.controller;

import com.proctor.backend.dto.ProctorEventDto;
import com.proctor.backend.model.ExamAttempt;
import com.proctor.backend.model.ProctorLog;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ProctorLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ProctorWebSocketController {

    private final ProctorLogRepository proctorLogRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // listens for messages sent to "/app/proctor/violation"
    @org.springframework.messaging.handler.annotation.MessageMapping("/proctor/violation")
    @Transactional
    public void handleProctorEvent(ProctorEventDto eventDto) {
        log.warn("Live violation detected // attempt id: {} // event: {} // details: {}",
                eventDto.getExamAttemptId(), eventDto.getEventType(), eventDto.getDetails());

        // save the infraction to the database
        ProctorLog proctorLog = new ProctorLog();
        proctorLog.setExamAttemptId(eventDto.getExamAttemptId());
        proctorLog.setEventType(eventDto.getEventType());
        proctorLog.setDetails(eventDto.getDetails());
        proctorLogRepository.save(proctorLog);

        // fetch attempt details to enrich the broadcast
        examAttemptRepository.findByIdWithDetails(java.util.UUID.fromString(eventDto.getExamAttemptId())).ifPresent(attempt -> {
            eventDto.setStudentEmail(attempt.getStudent().getEmail());
            eventDto.setExamTitle(attempt.getExam().getTitle());
            String tenantSlug = attempt.getExam().getOrganization().getTenantSlug();
            
            // broadcast the event live to the global tenant dashboard
            String destination = "/topic/proctor/tenant/" + tenantSlug;
            messagingTemplate.convertAndSend(destination, eventDto);
        });
    }
}
