package com.proctor.backend.controller;

import com.proctor.backend.dto.CreateOrganizationRequest;
import com.proctor.backend.dto.CreateUserRequest;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.User;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

// only the SUPER_ADMIN can reach these endpoints (see SecurityConfig)
@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationRepository organizationRepository;
    private final UserService userService;

    // create a new organization (tenant)
    @PostMapping
    public ResponseEntity<Organization> createOrganization(@RequestBody CreateOrganizationRequest request) {
        if (request.getName() == null || request.getName().isBlank()
                || request.getTenantSlug() == null || request.getTenantSlug().isBlank()) {
            throw new IllegalArgumentException("Organization name and tenant slug are required");
        }

        String slug = request.getTenantSlug().trim().toLowerCase();
        if (organizationRepository.findByTenantSlug(slug).isPresent()) {
            throw new IllegalStateException("Tenant slug '" + slug + "' is already taken");
        }

        Organization organization = Organization.builder()
                .name(request.getName().trim())
                .tenantSlug(slug)
                .build();
        return new ResponseEntity<>(organizationRepository.save(organization), HttpStatus.CREATED);
    }

    // list every organization on the platform
    @GetMapping
    public ResponseEntity<List<Organization>> getAllOrganizations() {
        return ResponseEntity.ok(organizationRepository.findAll());
    }

    // create the first admin account for an organization
    @PostMapping("/{id}/admin")
    public ResponseEntity<User> createOrgAdmin(@PathVariable UUID id, @RequestBody CreateUserRequest request) {
        User admin = userService.createOrgAdminForTenant(id, request);
        return new ResponseEntity<>(admin, HttpStatus.CREATED);
    }
}
