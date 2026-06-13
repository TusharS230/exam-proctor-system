package com.proctor.backend.repository;

import com.proctor.backend.model.ProctorLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProctorLogRepository extends JpaRepository<ProctorLog, Long> {
    List<ProctorLog> findByExamAttemptId(String examAttemptId);
}
