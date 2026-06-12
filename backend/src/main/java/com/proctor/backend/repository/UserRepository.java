package com.proctor.backend.repository;

import com.proctor.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    // Custom query method for security login lookups
    Optional<User> findByEmail(String email);
}
