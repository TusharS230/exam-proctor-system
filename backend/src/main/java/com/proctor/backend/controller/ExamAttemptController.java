package com.proctor.backend.controller;

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
    // /api/v1/attempts/start?examId=___&studentId=___
    @PostMapping("/start")
    public ResponseEntity<ExamAttempt> startExam(
            @RequestParam UUID examId,
            @RequestParam UUID studentId) {

        ExamAttempt attempt = attemptService.startExam(examId, studentId);
        return new ResponseEntity<>(attempt, HttpStatus.CREATED);
    }

    // POST: submit an exam
    // /api/v1/attempts/{attemptId}/submit
    @PostMapping("/{attemptId}/submit")
    public ResponseEntity<ExamAttempt> submitExam(
            @PathVariable UUID attemptId,
            @RequestBody SubmitExamRequest request) {

        ExamAttempt completedAttempt = attemptService.submitExam(attemptId, request);
        return ResponseEntity.ok(completedAttempt);
    }
}
