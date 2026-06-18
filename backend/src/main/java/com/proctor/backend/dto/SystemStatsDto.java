package com.proctor.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SystemStatsDto {
    private long totalOrganizations;
    private long totalUsers;
    private long totalExams;
}
