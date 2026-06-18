package com.proctor.backend.dto;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class GradeSubmissionRequest {
    private List<GradeItem> grades;

    @Data
    public static class GradeItem {
        private UUID answerId;
        private Integer marksAwarded;
    }
}
