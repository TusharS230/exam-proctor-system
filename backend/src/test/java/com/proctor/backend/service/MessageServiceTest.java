package com.proctor.backend.service;

import com.proctor.backend.dto.MessageResponse;
import com.proctor.backend.dto.MessageSendRequest;
import com.proctor.backend.model.Message;
import com.proctor.backend.model.Organization;
import com.proctor.backend.model.User;
import com.proctor.backend.model.UserRole;
import com.proctor.backend.repository.MessageRepository;
import com.proctor.backend.repository.OrganizationRepository;
import com.proctor.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for who can read and reply to a conversation.
 */
@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock private MessageRepository messageRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private MessageService messageService;

    private Organization kle;
    private User studentA;
    private User studentB;
    private User orgAdmin;
    private User superAdmin;

    @BeforeEach
    void setUp() {
        kle = Organization.builder().id(UUID.randomUUID()).name("KLE Tech").tenantSlug("kletech").build();
        studentA = user("a@kletech.edu", UserRole.STUDENT, kle);
        studentB = user("b@kletech.edu", UserRole.STUDENT, kle);
        orgAdmin = user("admin@kletech.edu", UserRole.ORG_ADMIN, kle);
        superAdmin = user("super@proctor.com", UserRole.SUPER_ADMIN, null);
    }

    @Test
    void studentCannotReadAnotherStudentsConversation() {
        UUID thread = UUID.randomUUID();
        // student A wrote to the organization inbox
        when(messageRepository.findByThreadIdOrderByCreatedAtAsc(thread))
                .thenReturn(List.of(message(thread, studentA, null, kle)));
        when(userRepository.findById(studentB.getId())).thenReturn(Optional.of(studentB));

        assertThatThrownBy(() -> messageService.getThread(studentB, thread))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void orgAdminCanReadMessagesSentToTheirOrganization() {
        UUID thread = UUID.randomUUID();
        when(messageRepository.findByThreadIdOrderByCreatedAtAsc(thread))
                .thenReturn(List.of(message(thread, studentA, null, kle)));
        when(userRepository.findById(orgAdmin.getId())).thenReturn(Optional.of(orgAdmin));

        List<MessageResponse> result = messageService.getThread(orgAdmin, thread);

        assertThat(result).hasSize(1);
    }

    @Test
    void studentCannotReplyInsideSomeoneElsesConversation() {
        UUID thread = UUID.randomUUID();
        when(messageRepository.findByThreadIdOrderByCreatedAtAsc(thread))
                .thenReturn(List.of(message(thread, studentA, null, kle)));
        when(userRepository.findById(studentB.getId())).thenReturn(Optional.of(studentB));

        MessageSendRequest reply = MessageSendRequest.builder().threadId(thread).content("hi").build();

        assertThatThrownBy(() -> messageService.sendMessage(studentB, reply))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void superAdminReplyReachesTheOrgAdminWhoStartedTheConversation() {
        UUID thread = UUID.randomUUID();
        // the org admin started a conversation with the super admin (no organization on the message)
        when(messageRepository.findByThreadIdOrderByCreatedAtAsc(thread))
                .thenReturn(List.of(message(thread, orgAdmin, null, null)));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(messageRepository.save(any(Message.class))).thenAnswer(call -> {
            Message saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(OffsetDateTime.now());
            return saved;
        });

        MessageSendRequest reply = MessageSendRequest.builder().threadId(thread).content("Approved").build();
        messageService.sendMessage(superAdmin, reply);

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        // delivered to the KLE organization inbox, not back to the super admin
        assertThat(captor.getValue().getOrganization()).isEqualTo(kle);
    }

    // ---------- helpers ----------

    private User user(String email, UserRole role, Organization organization) {
        return User.builder().id(UUID.randomUUID()).email(email).role(role).organization(organization).build();
    }

    private Message message(UUID thread, User sender, User recipient, Organization organization) {
        return Message.builder()
                .id(UUID.randomUUID())
                .threadId(thread)
                .sender(sender)
                .recipient(recipient)
                .organization(organization)
                .subject("Doubt")
                .content("Hello")
                .createdAt(OffsetDateTime.now())
                .build();
    }
}
