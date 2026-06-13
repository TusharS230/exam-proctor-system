package com.proctor.backend.dto;

import lombok.Data;

import java.util.List;

@Data
public class ExamSubmissionDto {
    private String examAttempt;
    private List<AnswerSubmissionDto> answers;
}
