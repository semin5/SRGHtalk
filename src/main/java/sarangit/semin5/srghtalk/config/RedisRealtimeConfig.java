package sarangit.semin5.srghtalk.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;

@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisRealtimeConfig {
    public record RealtimeEnvelope(String destination, JsonNode payload) {}

    @Bean
    RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            SimpMessagingTemplate messaging,
            ObjectMapper objectMapper,
            @Value("${app.redis.event-channel:srghtalk:realtime}") String channel) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener((message, pattern) -> {
            try {
                String json = new String(message.getBody(), StandardCharsets.UTF_8);
                RealtimeEnvelope envelope = objectMapper.readValue(json, RealtimeEnvelope.class);
                messaging.convertAndSend(envelope.destination(), envelope.payload());
            } catch (Exception error) {
                log.error("Redis 실시간 이벤트 처리 실패", error);
            }
        }, new ChannelTopic(channel));
        return container;
    }
}
