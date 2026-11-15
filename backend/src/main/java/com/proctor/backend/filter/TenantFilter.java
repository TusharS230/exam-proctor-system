package com.proctor.backend.filter;

import com.proctor.backend.config.JwtService;
import com.proctor.backend.context.TenantContext;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Reads the X-Tenant-ID header and stores it for the current request.
 *
 * Runs after Spring Security, so the user is already logged in here.
 * The header must match the tenant stored inside the user's signed JWT,
 * otherwise a user of one college could read another college's data.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class TenantFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-ID";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        // login, super admin tenant management and the WebSocket handshake are not tenant scoped
        return path.startsWith("/api/v1/auth/")
                || path.startsWith("/api/v1/organizations")
                || path.startsWith("/ws-proctor");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String tenantSlug = request.getHeader(TENANT_HEADER);
        if (tenantSlug == null || tenantSlug.isBlank()) {
            writeError(response, HttpServletResponse.SC_BAD_REQUEST, "Missing X-Tenant-ID header.");
            return;
        }
        tenantSlug = tenantSlug.trim();

        String tokenTenant = readTenantFromToken(request);
        if (tokenTenant == null) {
            // token from before tenant claims were added, or no token at all
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Session expired. Please log in again.");
            return;
        }
        if (!tokenTenant.equals(tenantSlug)) {
            log.warn("Blocked cross-tenant request to {} (token tenant: {}, header tenant: {})",
                    request.getRequestURI(), tokenTenant, tenantSlug);
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "You do not have access to this organization.");
            return;
        }

        try {
            TenantContext.setCurrentTenant(tenantSlug);
            filterChain.doFilter(request, response);
        } finally {
            // threads are reused by the server, so always clear the tenant afterwards
            TenantContext.clear();
        }
    }

    private String readTenantFromToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return null;
        }
        try {
            return jwtService.extractTenant(authHeader.substring(BEARER_PREFIX.length()));
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"status\": " + status + ", \"message\": \"" + message + "\"}");
    }
}
