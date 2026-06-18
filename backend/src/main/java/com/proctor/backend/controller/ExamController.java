package com.proctor.backend.controller;

import com.proctor.backend.dto.CreateExamRequest;
import com.proctor.backend.model.Exam;
import com.proctor.backend.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;

    // POST Endpoint: Create an exam with all its nested questions
    @PostMapping
    public ResponseEntity<Exam> createExam(@RequestBody CreateExamRequest request) {
        Exam savedExam = examService.createExam(request);
        return new ResponseEntity<>(savedExam, HttpStatus.CREATED);
    }

    // GET Endpoint: Fetch a specific exam by its ID (Securely!)
    @GetMapping("/{examId}")
    public ResponseEntity<Exam> getExam(@PathVariable UUID examId) {
        Exam exam = examService.getExamById(examId);
        return ResponseEntity.ok(exam);
    }

    // GET Endpoint: Fetch all exams for the current organization
    @GetMapping
    public ResponseEntity<java.util.List<Exam>> getAllExams() {
        return ResponseEntity.ok(examService.getAllExams());
    }

    // GET Endpoint: Fetch missed exams for the current student
    @GetMapping("/missed")
    public ResponseEntity<java.util.List<Exam>> getMissedExams() {
        return ResponseEntity.ok(examService.getMissedExams());
    }

    @PostMapping("/{examId}/assign")
    public ResponseEntity<Exam> assignExam(@PathVariable UUID examId, @RequestBody java.util.List<UUID> studentIds) {
        Exam updatedExam = examService.assignExam(examId, studentIds);
        return ResponseEntity.ok(updatedExam);
    }

    @PutMapping("/{examId}/status")
    public ResponseEntity<Exam> updateExamStatus(@PathVariable UUID examId, @RequestParam String status) {
        Exam updatedExam = examService.updateExamStatus(examId, status);
        return ResponseEntity.ok(updatedExam);
    }
}