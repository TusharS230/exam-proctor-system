package com.proctor.backend.repository;

import com.proctor.backend.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    // For a specific user's inbox (they are the recipient)
    List<Message> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    // For an organization's inbox (recipient is null, but organization matches)
    List<Message> findByOrganizationIdAndRecipientIsNullOrderByCreatedAtDesc(UUID organizationId);

    // For sent messages
    List<Message> findBySenderIdOrderByCreatedAtDesc(UUID senderId);

    // For System Admin inbox (where recipient is null and organization is null)
    List<Message> findByOrganizationIsNullAndRecipientIsNullOrderByCreatedAtDesc();

    // To load an entire thread
    List<Message> findByThreadIdOrderByCreatedAtAsc(UUID threadId);

    // To count unread messages for a specific user
    long countByRecipientIdAndIsReadFalse(UUID recipientId);

    // To count unread messages for an organization's shared inbox
    long countByOrganizationIdAndRecipientIsNullAndIsReadFalse(UUID organizationId);
    
    // To count unread messages for System Admin inbox
    long countByOrganizationIsNullAndRecipientIsNullAndIsReadFalse();
}
