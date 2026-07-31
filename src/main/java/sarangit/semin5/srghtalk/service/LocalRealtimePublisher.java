package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "false")
public class LocalRealtimePublisher implements RealtimePublisher {
    private final SimpMessagingTemplate messaging;

    @Override
    public void publish(String destination, Object payload) {
        messaging.convertAndSend(destination, payload);
    }
}
