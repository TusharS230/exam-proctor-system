package com.proctor.backend.dto;

import com.proctor.backend.model.QuestionType;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AnswerResponseDto {
    private UUID id;
    private String providedAnswer;
    private Boolean isCorrect;
    private Integer marksAwarded;
    
    private QuestionDto question;

    @Data
    @Builder
    public static class QuestionDto {
        private UUID id;
        private String questionText;
        private QuestionType questionType;
        private Integer marks;
    }
}
