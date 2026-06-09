package com.proctor.backend.filter;

import com.proctor.backend.context.TenantContext;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(1)
public class TenantFilter implements Filter {

    // Hardcoding the exact header name with zero spaces
    private static final String TENANT_HEADER = "X-Tenant-ID";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Bypass public endpoints immediately
        String requestURI = httpRequest.getRequestURI();
        if (requestURI.startsWith("/api/v1/organizations")) {
            chain.doFilter(request, response);
            return;
        }

        // Grab the header directly
        String tenantSlug = httpRequest.getHeader(TENANT_HEADER);

        // Ultimate Sanity Check Log
        System.out.println("====== FILTER CHECK ======");
        System.out.println("Extracted Variable: '" + tenantSlug + "'");
        System.out.println("==========================");

        if (tenantSlug == null || tenantSlug.trim().isEmpty()) {
            httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write("{\"error\": \"Missing or invalid X-Tenant-ID header metadata instruction.\"}");
            return;
        }

        try {
            TenantContext.setCurrentTenant(tenantSlug);
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}