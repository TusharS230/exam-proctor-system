package com.proctor.backend.controller;

import com.proctor.backend.dto.CreateUserRequest;
import com.proctor.backend.model.User;
import com.proctor.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest request) {
        User savedUser = userService.createUser(request);
        return new ResponseEntity<>(savedUser, HttpStatus.CREATED);
    }

    @org.springframework.web.bind.annotation.GetMapping("/students")
    public ResponseEntity<java.util.List<User>> getAllStudents() {
        return ResponseEntity.ok(userService.getAllStudents());
    }

    @PostMapping("/students/{id}/revoke")
    public ResponseEntity<Void> revokeAccess(@org.springframework.web.bind.annotation.PathVariable java.util.UUID id) {
        userService.revokeAccess(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/students/bulk")
    public ResponseEntity<java.util.List<User>> createBulkStudents(@RequestBody java.util.List<CreateUserRequest> requests) {
        java.util.List<User> savedUsers = userService.createBulkStudents(requests);
        return new ResponseEntity<>(savedUsers, HttpStatus.CREATED);
    }

    @PostMapping("/students/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(
            @org.springframework.web.bind.annotation.PathVariable java.util.UUID id,
            @RequestBody java.util.Map<String, String> payload) {
        userService.resetStudentPassword(id, payload.get("newPassword"));
        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PutMapping("/me/password")
    public ResponseEntity<Void> changeMyPassword(
            java.security.Principal principal,
            @RequestBody com.proctor.backend.dto.ChangePasswordRequest request) {
        try {
            userService.changeMyPassword(principal.getName(), request.getCurrentPassword(), request.getNewPassword());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @org.springframework.web.bind.annotation.GetMapping("/me")
    public ResponseEntity<User> getMe(java.security.Principal principal) {
        User currentUser = userService.getUserByEmail(principal.getName());
        return ResponseEntity.ok(currentUser);
    }
}
