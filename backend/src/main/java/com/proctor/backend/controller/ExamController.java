package com.proctor.backend.controller;

import com.proctor.backend.dto.CreateExamRequest;
import com.proctor.backend.model.Exam;
import com.proctor.backend.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;

    // POST endpoint: create an exam with all its nested questions
    @PostMapping
    public ResponseEntity<Exam> createExam(@RequestBody CreateExamRequest request) {
        Exam savedExam = examService.createExam(request);
        return new ResponseEntity<>(savedExam, HttpStatus.CREATED);
    }
}
