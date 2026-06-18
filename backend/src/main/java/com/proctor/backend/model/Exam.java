package com.proctor.backend.model;

import com.fasterxml.jackson.annotation.JsonIdentityInfo;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "exams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    // N:1 mapping - many exams belong to one organization
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Organization organization;

    // 1:N mapping - one exam has many questions
    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("exam")
    private List<Question> questions;

    // M:N mapping - exam assignments to specific students
    @ManyToMany
    @JoinTable(
        name = "exam_assignments",
        joinColumns = @JoinColumn(name = "exam_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<User> assignedStudents;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    // ACTIVE, PAST, or FUTURE
    @Column(name = "status", nullable = false, columnDefinition = "varchar(255) default 'ACTIVE'")
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "scheduled_start_time")
    private OffsetDateTime scheduledStartTime;

    @Column(name = "scheduled_end_time")
    private OffsetDateTime scheduledEndTime;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }
}
