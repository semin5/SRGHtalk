package sarangit.semin5.srghtalk.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {
    private final Set<Long> online = ConcurrentHashMap.newKeySet();
    private final SimpMessagingTemplate messaging;

    public PresenceService(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public boolean isOnline(Long employeeId) {
        return online.contains(employeeId);
    }

    public Set<Long> onlineIds() {
        return Set.copyOf(online);
    }

    public void setOnline(Long employeeId, boolean value) {
        if (value) online.add(employeeId); else online.remove(employeeId);
        messaging.convertAndSend("/topic/presence",
                new PresenceEvent(employeeId, value ? "ONLINE" : "OFFLINE", LocalDateTime.now()));
    }

    public record PresenceEvent(Long employeeId, String status, LocalDateTime changedAt) {}
}
