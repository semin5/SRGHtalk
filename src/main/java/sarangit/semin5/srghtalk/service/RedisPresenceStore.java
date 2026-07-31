package sarangit.semin5.srghtalk.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisPresenceStore implements PresenceStore {
    private static final String ONLINE_KEY = "srghtalk:presence:online";
    private final StringRedisTemplate redis;
    private final long timeoutSeconds;

    public RedisPresenceStore(StringRedisTemplate redis,
                              @Value("${app.redis.presence-timeout-seconds:90}") long timeoutSeconds) {
        this.redis = redis;
        this.timeoutSeconds = timeoutSeconds;
    }

    @Override
    public boolean isOnline(Long employeeId) {
        Double lastSeen = redis.opsForZSet().score(ONLINE_KEY, employeeId.toString());
        return lastSeen != null && lastSeen >= cutoff();
    }

    @Override
    public Set<Long> onlineIds() {
        redis.opsForZSet().removeRangeByScore(ONLINE_KEY, 0, cutoff());
        Set<String> values = redis.opsForZSet().rangeByScore(ONLINE_KEY, cutoff(), Double.MAX_VALUE);
        if (values == null) return Set.of();
        return values.stream().map(Long::valueOf).collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public void setOnline(Long employeeId, boolean online) {
        if (online) {
            redis.opsForZSet().add(ONLINE_KEY, employeeId.toString(), Instant.now().getEpochSecond());
        } else {
            redis.opsForZSet().remove(ONLINE_KEY, employeeId.toString());
        }
    }

    private double cutoff() {
        return Instant.now().minusSeconds(timeoutSeconds).getEpochSecond();
    }
}
