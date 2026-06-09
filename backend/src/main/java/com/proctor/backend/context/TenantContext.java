package com.proctor.backend.context;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class TenantContext {

    // threadLocal allocates an isolated memory slot private to the currently executing thread
    private static final ThreadLocal<String> currentTenant = new ThreadLocal<>();

    public static void setCurrentTenant(String tenantSlug) {
        log.debug("Setting current execution tenant context to: {}", tenantSlug);
        currentTenant.set(tenantSlug);
    }

    public static String getCurrentTenant() {
        return currentTenant.get();
    }

    public static void clear() {
        log.debug("Clearing tenant context storage for execution thread");
        currentTenant.remove();
    }
}
