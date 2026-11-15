package com.proctor.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;

/**
 * Background job that runs once a minute:
 * 1. finishes attempts whose time is over (for example the student closed the tab),
 * 2. marks exams as PAST once their closing time has passed.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamClosingJob {

    private final ExamAttemptService examAttemptService;
    private final ExamService examService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void closeFinishedExams() {
        OffsetDateTime now = OffsetDateTime.now();
        try {
            // attempts first, so nothing is left running inside an exam we are about to close
            int attempts = examAttemptService.closeExpiredAttempts(now);
            int exams = examService.closeEndedExams(now);
            if (attempts > 0 || exams > 0) {
                log.info("Closing job: {} attempt(s) submitted automatically, {} exam(s) closed", attempts, exams);
            }
        } catch (Exception e) {
            // never let one failure stop the job from running next minute
            log.error("Closing job failed", e);
        }
    }
}
