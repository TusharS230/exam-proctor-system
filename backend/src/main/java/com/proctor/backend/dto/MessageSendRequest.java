package com.proctor.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageSendRequest {
    private String subject; // Optional if replying to a thread
    private String content;
    private UUID threadId; // Null if it's a new conversation
    private UUID organizationId; // Only required if Super Admin is initiating a new thread
    
    // The recipient is determined by the sender's role.
    // If Student -> goes to their Org Admin.
    // If Org Admin -> can either go to a specific Student (if replying to thread) or to System Admin.
    // If Super Admin -> goes to the specified organizationId (if new thread).
}
