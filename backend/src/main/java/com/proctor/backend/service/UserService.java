package com.proctor.backend.service;

import com.proctor.backend.context.TenantContext;
import com.proctor.backend.dto.CreateUserRequest;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.User;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public User createUser (CreateUserRequest request) {
        // extract the secure tenant boundary from the current execution thread
        String tenantSlug = TenantContext.getCurrentTenant();
        log.info("Attempting to onboard user {} into tenant: {}", request.getEmail(), tenantSlug);

        // fetch the parent organization or crash if someone passes a fake header
        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new RuntimeException("CRITICAL: Organization not found for tenant slug: " + tenantSlug));

        // hydrate the new user entity and link the foreign key relationships
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .organization(organization)
                .build();

        // commit to postgresql
        return userRepository.save(user);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("User not found with email: " + email));
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<User> getAllStudents() {
        String tenantSlug = TenantContext.getCurrentTenant();
        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new RuntimeException("Organization not found"));

        return userRepository.findByOrganizationIdAndRole(organization.getId(), com.proctor.backend.model.UserRole.STUDENT);
    }

    @org.springframework.transaction.annotation.Transactional
    public void revokeAccess(java.util.UUID studentId) {
        String tenantSlug = TenantContext.getCurrentTenant();
        
        User student = userRepository.findById(studentId)
                .filter(u -> u.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("Student not found"));
                
        student.setActive(false);
        userRepository.save(student);
        log.info("Revoked access for student {}", student.getEmail());
    }

    @org.springframework.transaction.annotation.Transactional
    public User createOrgAdminForTenant(java.util.UUID organizationId, CreateUserRequest request) {
        // Only SUPER_ADMIN can do this.
        String currentUserEmail = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("User not found"));
                
        if (currentUser.getRole() != com.proctor.backend.model.UserRole.SUPER_ADMIN) {
            throw new IllegalStateException("Only Super Admin can provision organization admins");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("Organization not found"));

        User admin = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(com.proctor.backend.model.UserRole.ORG_ADMIN)
                .organization(organization)
                .build();

        return userRepository.save(admin);
    }

    @org.springframework.transaction.annotation.Transactional
    public java.util.List<User> createBulkStudents(java.util.List<CreateUserRequest> requests) {
        String tenantSlug = TenantContext.getCurrentTenant();
        Organization organization = organizationRepository.findByTenantSlug(tenantSlug)
                .orElseThrow(() -> new RuntimeException("Organization not found"));

        java.util.List<User> students = new java.util.ArrayList<>();
        for (CreateUserRequest request : requests) {
            // Optional: check if email already exists to skip or fail
            if (userRepository.findByEmail(request.getEmail()).isPresent()) continue;

            User student = User.builder()
                    .email(request.getEmail())
                    .passwordHash(passwordEncoder.encode(request.getPassword()))
                    .role(com.proctor.backend.model.UserRole.STUDENT)
                    .organization(organization)
                    .build();
            students.add(student);
        }
        
        return userRepository.saveAll(students);
    }

    @org.springframework.transaction.annotation.Transactional
    public void resetStudentPassword(java.util.UUID studentId, String newPassword) {
        String tenantSlug = TenantContext.getCurrentTenant();
        
        User student = userRepository.findById(studentId)
                .filter(u -> u.getOrganization().getTenantSlug().equals(tenantSlug))
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("Student not found"));
                
        student.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(student);
        log.info("Reset password for student {}", student.getEmail());
    }

    @org.springframework.transaction.annotation.Transactional
    public void changeMyPassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new com.proctor.backend.exception.ResourceNotFoundException("User not found"));
                
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password changed successfully for user {}", email);
    }
}
