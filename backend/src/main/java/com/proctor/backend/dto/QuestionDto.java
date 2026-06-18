package com.proctor.backend.dto;

import com.proctor.backend.model.QuestionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDto {
    private String questionText;
    private QuestionType questionType;
    private Integer marks;
    private String correctAnswer;
    private java.util.List<String> options;
}
