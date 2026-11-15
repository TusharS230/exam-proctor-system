package com.proctor.backend.repository;

import com.proctor.backend.model.Exam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, UUID> {
    List<Exam> findByOrganizationId(UUID organizationId);

    // exams with this status whose closing time has already passed
    List<Exam> findByStatusAndScheduledEndTimeBefore(String status, java.time.OffsetDateTime time);
}
