package com.proctor.backend.repository;

import com.proctor.backend.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {
    // custom query to fetch all questions belonging to a specific exam id
    List<Question> findByExamId(UUID examId);
}
