package com.proctor.backend.repository;

import com.proctor.backend.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    // Custom query method: Spring parses this name to auto-generate: SELECT * FROM organizations WHERE tenant_slug = ?
    Optional<Organization> findByTenantSlug(String tenantSlug);
}
