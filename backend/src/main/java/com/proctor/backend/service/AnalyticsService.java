package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.exception.ResourceNotFoundException;
import com.proctor.backend.model.AttemptStatus;
import com.proctor.backend.model.ExamAttempt;
import com.proctor.backend.model.User;
import com.proctor.backend.repository.ExamAttemptRepository;
import com.proctor.backend.repository.ProctorLogRepository;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final ExamAttemptRepository attemptRepository;
    private final ProctorLogRepository proctorLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats(String timeframe) {
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        List<ExamAttempt> allAttempts = attemptRepository.findByExamOrganizationId(user.getOrganization().getId());

        long activeStudents = allAttempts.stream()
                .filter(a -> a.getStatus() == AttemptStatus.IN_PROGRESS)
                .count();

        OffsetDateTime boundary;
        switch (timeframe) {
            case "week": boundary = OffsetDateTime.now().minusDays(7); break;
            case "month": boundary = OffsetDateTime.now().minusDays(30); break;
            case "year": boundary = OffsetDateTime.now().minusDays(365); break;
            case "today":
            default: boundary = OffsetDateTime.now().minusHours(24); break;
        }

        long completedTimeframe = allAttempts.stream()
                .filter(a -> a.getStatus() == AttemptStatus.SUBMITTED && a.getCompletedAt() != null && a.getCompletedAt().isAfter(boundary))
                .count();

        // count total violations across all attempts for this tenant within timeframe
        List<String> attemptIds = allAttempts.stream()
                .map(a -> a.getId().toString())
                .collect(Collectors.toList());

        LocalDateTime localBoundary = boundary.toLocalDateTime();
        long totalViolations = attemptIds.stream()
                .mapToLong(id -> proctorLogRepository.findByExamAttemptId(id).stream()
                        .filter(log -> !log.getEventType().equals("EXAM_STARTED") && !log.getEventType().equals("EXAM_COMPLETED") && !log.getEventType().equals("SYSTEM"))
                        .filter(log -> {
                            try {
                                return log.getTimestamp() != null && log.getTimestamp().isAfter(localBoundary);
                            } catch (Exception e) {
                                return false;
                            }
                        })
                        .count())
                .sum();

        Map<String, Object> stats = new HashMap<>();
        stats.put("activeStudents", activeStudents);
        stats.put("completedToday", completedTimeframe);
        stats.put("totalViolations", totalViolations);

        return stats;
    }
}
