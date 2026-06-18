package com.proctor.backend.config;

import com.proctor.backend.model.*;
import com.proctor.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Only run if the database is completely empty
        if (organizationRepository.count() > 0) {
            log.info("Database is already populated. Skipping seeder.");
            return;
        }

        log.info("Starting database seeding process...");

        // 1. Create Organization
        Organization kletech = Organization.builder()
                .name("KLE Technological University")
                .tenantSlug("kletech")
                .build();
        organizationRepository.save(kletech);
        log.info("Created Organization: {}", kletech.getName());

        // 2. Create Super Admin, Org Admin and Student Users
        User superAdmin = User.builder()
                .email("super@proctor.com")
                .passwordHash(passwordEncoder.encode("password"))
                .role(UserRole.SUPER_ADMIN)
                .build();

        User admin = User.builder()
                .organization(kletech)
                .email("admin@kletech.edu")
                .passwordHash(passwordEncoder.encode("password"))
                .role(UserRole.ORG_ADMIN)
                .build();

        User student = User.builder()
                .organization(kletech)
                .email("student@kletech.edu")
                .passwordHash(passwordEncoder.encode("password"))
                .role(UserRole.STUDENT)
                .build();

        userRepository.saveAll(List.of(superAdmin, admin, student));
        log.info("Created Users: super@proctor.com, admin@kletech.edu, student@kletech.edu (password: password)");

        // 3. Create an Exam
        Exam exam = Exam.builder()
                .organization(kletech)
                .title("Midterm Examination - Advanced Architecture")
                .description("Comprehensive test covering cloud computing and advanced system architectures.")
                .durationMinutes(60)
                .build();
        examRepository.save(exam);
        log.info("Created Exam: {}", exam.getTitle());

        // 4. Create Questions for the Exam
        Question q1 = Question.builder()
                .exam(exam)
                .questionText("Which of the following cloud computing deployment models is characterized by infrastructure that is provisioned for exclusive use by a single organization comprising multiple consumers?")
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .marks(5)
                .correctAnswer("Private Cloud")
                .build();

        Question q2 = Question.builder()
                .exam(exam)
                .questionText("Explain the CAP theorem in the context of distributed databases.")
                .questionType(QuestionType.TEXT_RESPONSE)
                .marks(10)
                .correctAnswer("Consistency, Availability, Partition Tolerance.")
                .build();

        questionRepository.saveAll(List.of(q1, q2));
        log.info("Created Dummy Questions for Exam.");

        log.info("Database seeding completed successfully!");
    }
}
