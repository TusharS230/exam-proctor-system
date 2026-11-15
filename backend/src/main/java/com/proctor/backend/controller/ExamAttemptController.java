package com.proctor.backend.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import com.proctor.backend.dto.SubmitExamRequest;
import com.proctor.backend.model.ExamAttempt;
import com.proctor.backend.service.ExamAttemptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class ExamAttemptController {

    private final ExamAttemptService attemptService;

    // POST: start an exam
    // /api/v1/attempts/start?examId=___
    @PreAuthorize("hasRole('STUDENT')")
    @PostMapping("/start")
    public ResponseEntity<ExamAttempt> startExam(@RequestParam UUID examId) {
        ExamAttempt attempt = attemptService.startExam(examId);
        return new ResponseEntity<>(attempt, HttpStatus.CREATED);
    }

    // POST: submit an exam
    // /api/v1/attempts/{attemptId}/submit
    @PreAuthorize("hasRole('STUDENT')")
    @PostMapping("/{attemptId}/submit")
    public ResponseEntity<ExamAttempt> submitExam(
            @PathVariable UUID attemptId,
            @RequestBody SubmitExamRequest request) {

        ExamAttempt attempt = attemptService.submitExam(attemptId, request);
        return ResponseEntity.ok(attempt);
    }

    @PreAuthorize("hasAnyRole('ORG_ADMIN', 'STUDENT')")
    @GetMapping("/history")
    public ResponseEntity<java.util.List<ExamAttempt>> getHistory() {
        return ResponseEntity.ok(attemptService.getHistory());
    }

    // GET: fetch logs for an attempt
    @PreAuthorize("hasAnyRole('ORG_ADMIN', 'STUDENT')")
    @GetMapping("/{attemptId}/logs")
    public ResponseEntity<java.util.List<com.proctor.backend.model.ProctorLog>> getLogsForAttempt(@PathVariable UUID attemptId) {
        return ResponseEntity.ok(attemptService.getLogsForAttempt(attemptId));
    }

    // GET: fetch active attempts for the dashboard
    @PreAuthorize("hasRole('ORG_ADMIN')")
    @GetMapping("/active")
    public ResponseEntity<java.util.List<ExamAttempt>> getActiveAttempts() {
        return ResponseEntity.ok(attemptService.getActiveAttempts());
    }

    // GET: fetch active attempt for the logged in student
    @PreAuthorize("hasRole('STUDENT')")
    @GetMapping("/my-active")
    public ResponseEntity<ExamAttempt> getMyActiveAttempt() {
        return ResponseEntity.ok(attemptService.getMyActiveAttempt());
    }

    @PreAuthorize("hasRole('ORG_ADMIN')")
    @PostMapping("/{attemptId}/grade")
    public ResponseEntity<Void> gradeAttempt(
            @PathVariable UUID attemptId,
            @RequestBody com.proctor.backend.dto.GradeSubmissionRequest request) {
        attemptService.gradeAttempt(attemptId, request);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasAnyRole('ORG_ADMIN', 'STUDENT')")
    @GetMapping("/{attemptId}/answers")
    public ResponseEntity<java.util.List<com.proctor.backend.dto.AnswerResponseDto>> getAnswersForAttempt(@PathVariable UUID attemptId) {
        return ResponseEntity.ok(attemptService.getAnswersForAttempt(attemptId));
    }
}
