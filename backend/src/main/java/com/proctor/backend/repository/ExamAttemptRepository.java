package com.proctor.backend.repository;

import com.proctor.backend.model.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import com.proctor.backend.model.AttemptStatus;
import java.util.List;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {
    Optional<ExamAttempt> findByStudentIdAndExamId(UUID studentId, UUID examId);
    List<ExamAttempt> findByStatus(AttemptStatus status);
    List<ExamAttempt> findByExamOrganizationId(UUID organizationId);
    List<ExamAttempt> findByStudentId(UUID studentId);

    @org.springframework.data.jpa.repository.Query("SELECT ea FROM ExamAttempt ea JOIN FETCH ea.student JOIN FETCH ea.exam e JOIN FETCH e.organization WHERE ea.id = :id")
    Optional<ExamAttempt> findByIdWithDetails(@org.springframework.data.repository.query.Param("id") UUID id);
}
