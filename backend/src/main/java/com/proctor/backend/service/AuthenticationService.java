package com.proctor.backend.service;

import com.proctor.backend.config.JwtService;
import com.proctor.backend.dto.AuthenticationRequest;
import com.proctor.backend.dto.AuthenticationResponse;
import com.proctor.backend.exception.ResourceNotFoundException;
import com.proctor.backend.model.User;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    public static final String SYSTEM_TENANT = "SYSTEM";

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // this method calls security to verify the email and password against the BCrypt hash
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(), request.getPassword()
                )
        );

        // if we reach this line, the password is correct, now fetch the user
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("user not found"));

        // the super admin does not belong to any organization
        String tenantSlug = user.getOrganization() != null ? user.getOrganization().getTenantSlug() : SYSTEM_TENANT;

        // the tenant goes inside the signed token, so the client cannot change it
        String jwtToken = jwtService.generateToken(Map.of(JwtService.TENANT_CLAIM, tenantSlug), user);

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole().name())
                .tenantSlug(tenantSlug)
                .build();
    }
}
