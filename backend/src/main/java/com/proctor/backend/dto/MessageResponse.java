package com.proctor.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private UUID id;
    private UUID threadId;
    
    private UUID senderId;
    private String senderEmail;
    private String senderRole;
    
    private UUID recipientId;
    private String recipientEmail; // Can be null if sent to an inbox
    
    private String organizationName;
    
    private String subject;
    private String content;
    private boolean isRead;
    private OffsetDateTime createdAt;
}
