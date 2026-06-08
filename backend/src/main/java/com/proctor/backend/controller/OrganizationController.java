package com.proctor.backend.controller;

import com.proctor.backend.dto.CreateOrganizationRequest;
import com.proctor.backend.model.Organization;
import com.proctor.backend.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.beans.Transient;
import java.util.List;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationRepository organizationRepository;

    // POST endpoint: create a fresh organization tenant record
    @PostMapping
    public ResponseEntity<Organization> createOrganization(@RequestBody CreateOrganizationRequest request){
        // construct our entity object using the clean builder pattern
        Organization organization = Organization.builder()
                .name(request.getName())
                .tenantSlug((request.getTenantSlug()))
                .build();
        Organization savedOrganization = organizationRepository.save(organization);
        return new ResponseEntity<>(savedOrganization, HttpStatus.CREATED);
    }
    // GET endpoint: retrieve all organizations registered in the cluster
    @Transient
    @GetMapping
    public ResponseEntity<List<Organization>> getAllOrganizations() {
        List<Organization> organizations = organizationRepository.findAll();
        return ResponseEntity.ok(organizations);
    }
}
