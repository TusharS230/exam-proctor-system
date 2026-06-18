package com.proctor.backend.controller;

import com.proctor.backend.dto.MessageResponse;
import com.proctor.backend.dto.MessageSendRequest;
import com.proctor.backend.model.User;
import com.proctor.backend.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @PostMapping("/send")
    public ResponseEntity<MessageResponse> sendMessage(
            @AuthenticationPrincipal User currentUser,
            @RequestBody MessageSendRequest request) {
        return ResponseEntity.ok(messageService.sendMessage(currentUser, request));
    }

    @GetMapping("/inbox")
    public ResponseEntity<List<MessageResponse>> getInbox(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(messageService.getInbox(currentUser));
    }

    @GetMapping("/sent")
    public ResponseEntity<List<MessageResponse>> getSentMessages(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(messageService.getSentMessages(currentUser));
    }

    @GetMapping("/thread/{threadId}")
    public ResponseEntity<List<MessageResponse>> getThread(
            @AuthenticationPrincipal User currentUser,
            @PathVariable UUID threadId) {
        return ResponseEntity.ok(messageService.getThread(currentUser, threadId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @AuthenticationPrincipal User currentUser,
            @PathVariable UUID id) {
        messageService.markAsRead(currentUser, id);
        return ResponseEntity.ok().build();
    }
}
