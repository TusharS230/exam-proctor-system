package com.proctor.backend.controller;

import com.proctor.backend.dto.ProctorEventDto;
import com.proctor.backend.model.ProctorLog;
import com.proctor.backend.repository.ProctorLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ProctorWebSocketController {

    private final ProctorLogRepository proctorLogRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // listens for messages sent to "/app/proctor/event"
    public void handleProctorEvent(ProctorEventDto eventDto) {
        log.warn("Live violation detected // attempt id: {} // event: {} // details: {}",
                eventDto.getExamAttemptId(), eventDto.getEventType(), eventDto.getDetails());

        // save the infraction to the database
        ProctorLog proctorLog = new ProctorLog();
        proctorLog.setExamAttemptId(eventDto.getExamAttemptId());
        proctorLog.setEventType(eventDto.getEventType());
        proctorLog.setDetails(eventDto.getDetails());
        proctorLogRepository.save(proctorLog);

        // broadcast the event live to the proctor dashboard
        String destination = "/topic/proctor/alerts/" + eventDto.getExamAttemptId();
        messagingTemplate.convertAndSend(destination, eventDto);
    }
}
