package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import sarangit.semin5.srghtalk.config.RedisRealtimeConfig.RealtimeEnvelope;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisRealtimePublisher implements RealtimePublisher {
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Value("${app.redis.event-channel:srghtalk:realtime}")
    private String channel;

    @Override
    public void publish(String destination, Object payload) {
        try {
            RealtimeEnvelope envelope = new RealtimeEnvelope(destination, objectMapper.valueToTree(payload));
            redis.convertAndSend(channel, objectMapper.writeValueAsString(envelope));
        } catch (Exception error) {
            throw new IllegalStateException("Redis 실시간 이벤트 발행에 실패했습니다.", error);
        }
    }
}
