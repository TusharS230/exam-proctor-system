package com.proctor.backend;

import com.proctor.backend.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

	// This block runs once during startup to force-fix your password in the database
	@Bean
	public CommandLineRunner fixDatabasePassword(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		return args -> {
			userRepository.findByEmail("tushar@kletech.edu").ifPresent(user -> {
				System.out.println("====== AUTO-FIXING PASSWORD IN DATABASE ======");

				// Let Spring generate the perfect 60-character hash directly
				String perfectHash = passwordEncoder.encode("SecurePassword123!");
				user.setPasswordHash(perfectHash);

				// Save it safely
				userRepository.save(user);

				System.out.println("====== PASSWORD SUCCESSFULLY FIXED! ======");
			});
		};
	}
}