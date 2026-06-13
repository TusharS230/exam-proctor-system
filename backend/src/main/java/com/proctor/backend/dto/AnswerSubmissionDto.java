package com.proctor.backend.dto;

import lombok.Data;

@Data
public class AnswerSubmissionDto {
    private Long questionId;
    private String providedAnswer;
}
