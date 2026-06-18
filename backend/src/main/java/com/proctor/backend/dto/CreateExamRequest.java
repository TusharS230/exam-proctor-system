package com.proctor.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateExamRequest {
    private String title;
    private String description;
    private Integer durationMinutes;

    private String scheduledStartTime;
    private String scheduledEndTime;

    private List<QuestionDto> questions;
}
