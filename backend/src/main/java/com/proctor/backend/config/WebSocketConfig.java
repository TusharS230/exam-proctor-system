package com.proctor.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // a simple memory based message broker to carry message back to the client
        config.enableSimpleBroker("/topic");

        // prefix for messages bound for methods annotated with @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // the url where the frontend will initiate the persistent connection
        registry.addEndpoint("/ws-proctor")
                .setAllowedOriginPatterns("*")  // let our frontend connect with CORS blocking
                .withSockJS();  // fallback mechanism if websockets aren't supported by the browser
    }
}
