package com.proctor.backend.repository;

import com.proctor.backend.model.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {
    Optional<ExamAttempt> findByStudentIdAndExamId(UUID studentId, UUID examId);
}
