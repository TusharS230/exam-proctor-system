package com.proctor.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleResourceNotFound(
            ResourceNotFoundException ex,
            HttpServletRequest request) {

        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("timestamp", OffsetDateTime.now());
        errorBody.put("status", HttpStatus.NOT_FOUND.value());
        errorBody.put("error", "Not Found");
        errorBody.put("message", ex.getMessage());
        errorBody.put("path", request.getRequestURI());

        return  new ResponseEntity<>(errorBody, HttpStatus.NOT_FOUND);
    }

    // a fallback for any other generic crash to prevent leaking stack traces
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(
            Exception ex,
            HttpServletRequest request) {

        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("timestamp", OffsetDateTime.now());
        errorBody.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorBody.put("error", "Internal Server Error");
        errorBody.put("message", "An unexpected error occurred");
        errorBody.put("path", request.getRequestURI());

        return new ResponseEntity<>(errorBody, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
