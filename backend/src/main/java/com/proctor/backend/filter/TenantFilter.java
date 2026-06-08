package com.proctor.backend.filter;

import com.proctor.backend.context.TenantContext;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(1)   // enforces that this filter runs first when an HTTP packet hits our server ports
public class TenantFilter implements Filter {

    final String TENANT_HEADER = "X-Tenant_ID";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest)  request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // extract our tenant identity handle from the HTTP header metadata array
        String tenantSlug = httpRequest.getHeader(TENANT_HEADER);

        // bypass checks for public core management endpoints (like registering a new organization)
        String requestURI = httpRequest.getRequestURI();
        if(requestURI.startsWith("/api/v1/organizations")) {
            chain.doFilter(request, response);
            return;
        }

        if(tenantSlug == null || tenantSlug.trim().isEmpty()) {
            httpResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST);;
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write("{\"error\": \"Missing or invalid X-Tenant-ID header metadata instruction.\"}");
            return;
        }

        try {
            // bind the extracted tenant slug context directly to thi execution thread memory pool
            TenantContext.setCurrentTenant(tenantSlug);

            // hand the request payload off the next component down the routing pipeline
            chain.doFilter(request, response);
        } finally {
            // always clean up memory leak vectors when the worker thread returns to the thread pool
            TenantContext.clear();
        }
    }
}
