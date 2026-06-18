package com.proctor.backend.controller;

import com.proctor.backend.dto.SystemStatsDto;
import com.proctor.backend.repository.ExamRepository;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
@RequiredArgsConstructor
public class SystemController {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final ExamRepository examRepository;

    @GetMapping("/stats")
    public ResponseEntity<SystemStatsDto> getSystemStats() {
        long totalOrganizations = organizationRepository.count();
        long totalUsers = userRepository.count();
        long totalExams = examRepository.count();

        SystemStatsDto stats = SystemStatsDto.builder()
                .totalOrganizations(totalOrganizations)
                .totalUsers(totalUsers)
                .totalExams(totalExams)
                .build();

        return ResponseEntity.ok(stats);
    }
}
