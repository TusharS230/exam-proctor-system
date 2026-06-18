package com.proctor.backend.service;

import com.proctor.backend.dto.MessageResponse;
import com.proctor.backend.dto.MessageSendRequest;
import com.proctor.backend.model.Message;
import com.proctor.backend.model.User;
import com.proctor.backend.model.UserRole;
import com.proctor.backend.repository.MessageRepository;
import com.proctor.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final com.proctor.backend.repository.OrganizationRepository organizationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageResponse sendMessage(User detachedUser, MessageSendRequest request) {
        User currentUser = userRepository.findById(detachedUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        Message.MessageBuilder messageBuilder = Message.builder()
                .sender(currentUser)
                .content(request.getContent())
                .subject(request.getSubject())
                .threadId(request.getThreadId());

        if (currentUser.getRole() == UserRole.STUDENT) {
            // Student always sends to their Organization Admin inbox
            if (currentUser.getOrganization() == null) {
                throw new IllegalStateException("Student does not belong to an organization.");
            }
            messageBuilder.organization(currentUser.getOrganization());
            messageBuilder.recipient(null); // Goes to the general org inbox
        } else if (currentUser.getRole() == UserRole.ORG_ADMIN) {
            // If replying to a thread, find the original sender to reply directly
            if (request.getThreadId() != null) {
                List<Message> threadMessages = messageRepository.findByThreadIdOrderByCreatedAtAsc(request.getThreadId());
                if (threadMessages.isEmpty()) {
                    throw new IllegalArgumentException("Thread not found.");
                }
                // Find the first message in the thread to get the subject and the actual student
                Message root = threadMessages.get(0);
                messageBuilder.subject(root.getSubject()); // inherit subject
                if (root.getSender().getRole() == UserRole.STUDENT) {
                    messageBuilder.recipient(root.getSender()); // Reply directly to the student
                } else {
                    messageBuilder.recipient(null); // It's a thread between Org Admin and Sys Admin
                }
            } else {
                // If creating a brand new thread, ORG_ADMIN can only contact SUPER_ADMIN
                messageBuilder.organization(null);
                messageBuilder.recipient(null); 
            }
        } else if (currentUser.getRole() == UserRole.SUPER_ADMIN) {
            if (request.getThreadId() != null) {
                List<Message> threadMessages = messageRepository.findByThreadIdOrderByCreatedAtAsc(request.getThreadId());
                if (threadMessages.isEmpty()) {
                    throw new IllegalArgumentException("Thread not found.");
                }
                Message root = threadMessages.get(0);
                messageBuilder.subject(root.getSubject());
                
                // Reply to the org admin's inbox
                messageBuilder.organization(root.getOrganization());
                messageBuilder.recipient(null); 
            } else {
                if (request.getOrganizationId() == null) {
                    throw new IllegalArgumentException("Organization ID is required when Super Admin starts a new thread.");
                }
                com.proctor.backend.model.Organization org = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> new IllegalArgumentException("Organization not found"));
                messageBuilder.organization(org);
                messageBuilder.recipient(null);
            }
        }

        Message savedMessage = messageRepository.save(messageBuilder.build());
        MessageResponse response = mapToResponse(savedMessage);
        
        // Broadcast WebSocket notification
        if (savedMessage.getRecipient() != null) {
            // Direct message to a specific user
            messagingTemplate.convertAndSend("/topic/user/" + savedMessage.getRecipient().getId() + "/messages", response);
        } else if (savedMessage.getOrganization() != null) {
            // Message to an organization's inbox
            messagingTemplate.convertAndSend("/topic/org/" + savedMessage.getOrganization().getId() + "/messages", response);
        } else {
            // Message to Super Admin inbox
            messagingTemplate.convertAndSend("/topic/superadmin/messages", response);
        }

        return response;
    }

    public List<MessageResponse> getInbox(User currentUser) {
        List<Message> messages;
        if (currentUser.getRole() == UserRole.STUDENT) {
            // Students get messages directly sent to them
            messages = messageRepository.findByRecipientIdOrderByCreatedAtDesc(currentUser.getId());
        } else if (currentUser.getRole() == UserRole.ORG_ADMIN) {
            // Org admins get messages sent to their org inbox
            if (currentUser.getOrganization() == null) {
                throw new IllegalStateException("Org admin has no organization.");
            }
            messages = messageRepository.findByOrganizationIdAndRecipientIsNullOrderByCreatedAtDesc(currentUser.getOrganization().getId());
        } else {
            // System Admin gets messages sent to sysadmin inbox
            messages = messageRepository.findByOrganizationIsNullAndRecipientIsNullOrderByCreatedAtDesc();
        }

        return messages.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<MessageResponse> getSentMessages(User currentUser) {
        return messageRepository.findBySenderIdOrderByCreatedAtDesc(currentUser.getId())
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<MessageResponse> getThread(User currentUser, UUID threadId) {
        // Need to add security check here eventually to ensure user is part of thread
        return messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public void markAsRead(User currentUser, UUID messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        
        // Mark read
        message.setRead(true);
        messageRepository.save(message);
    }

    private MessageResponse mapToResponse(Message message) {
        String orgName = null;
        if (message.getOrganization() != null) {
            orgName = getOrganizationNameSafe(message.getOrganization());
        } else if (message.getSender().getOrganization() != null) {
            orgName = getOrganizationNameSafe(message.getSender().getOrganization());
        }

        return MessageResponse.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .senderId(message.getSender().getId())
                .senderEmail(message.getSender().getEmail())
                .senderRole(message.getSender().getRole().name())
                .recipientId(message.getRecipient() != null ? message.getRecipient().getId() : null)
                .recipientEmail(message.getRecipient() != null ? message.getRecipient().getEmail() : null)
                .organizationName(orgName)
                .subject(message.getSubject())
                .content(message.getContent())
                .isRead(message.isRead())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private String getOrganizationNameSafe(com.proctor.backend.model.Organization org) {
        try {
            return org.getName();
        } catch (org.hibernate.LazyInitializationException e) {
            return organizationRepository.findById(org.getId()).map(com.proctor.backend.model.Organization::getName).orElse(null);
        }
    }
}
