package sarangit.semin5.srghtalk.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "false")
public class LocalPresenceStore implements PresenceStore {
    private final Set<Long> online = ConcurrentHashMap.newKeySet();

    @Override
    public boolean isOnline(Long employeeId) {
        return online.contains(employeeId);
    }

    @Override
    public Set<Long> onlineIds() {
        return Set.copyOf(online);
    }

    @Override
    public void setOnline(Long employeeId, boolean value) {
        if (value) online.add(employeeId); else online.remove(employeeId);
    }
}
