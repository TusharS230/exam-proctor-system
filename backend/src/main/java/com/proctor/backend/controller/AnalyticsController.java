package com.proctor.backend.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import com.proctor.backend.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @PreAuthorize("hasRole('ORG_ADMIN')")
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardStats(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "today") String timeframe) {
        return ResponseEntity.ok(analyticsService.getDashboardStats(timeframe));
    }
}
