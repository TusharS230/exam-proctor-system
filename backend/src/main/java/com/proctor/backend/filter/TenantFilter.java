package com.proctor.backend.filter;

import com.proctor.backend.context.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@Order(1)
public class TenantFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-ID";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String path = request.getRequestURI();

        // 1. Bypass public endpoints (Login and Organization Setup)
        if (path.startsWith("/api/v1/auth/") || path.startsWith("/api/v1/organizations")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Extract the Tenant ID for protected routes
        String tenantSlug = request.getHeader(TENANT_HEADER);

        log.info("====== TENANT FILTER CHECK ======");
        log.info("Path: {}", path);
        log.info("Extracted Tenant: '{}'", tenantSlug);
        log.info("=================================");

        // 3. Block request if header is missing
        if (tenantSlug == null || tenantSlug.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Missing or invalid X-Tenant-ID header.\"}");
            return;
        }

        // 4. Set Context, Continue down the chain, and Clean Up
        try {
            TenantContext.setCurrentTenant(tenantSlug.trim());
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}