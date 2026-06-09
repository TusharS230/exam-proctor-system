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
                .passwordHash(request.getPassword())
                .role(request.getRole())
                .organization(organization)
                .build();

        // commit to postgresql
        return userRepository.save(user);
    }
}
