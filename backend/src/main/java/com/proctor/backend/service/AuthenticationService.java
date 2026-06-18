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

@Service
@RequiredArgsConstructor
public class AuthenticationService {

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

        // generate jwt token
        String jwtToken = jwtService.generateToken(user);

        // return it to the client
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .role(user.getRole().name())
                .tenantSlug(user.getOrganization() != null ? user.getOrganization().getTenantSlug() : "SYSTEM")
                .build();
    }
}
