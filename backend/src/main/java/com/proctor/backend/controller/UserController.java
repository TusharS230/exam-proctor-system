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
}
