package sarangit.semin5.srghtalk.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.LocalDateTime;
import java.util.Set;

@Service
public class PresenceService {
    private final PresenceStore store;
    private final RealtimePublisher realtime;

    public PresenceService(PresenceStore store, RealtimePublisher realtime) {
        this.store = store;
        this.realtime = realtime;
    }

    public boolean isOnline(Long employeeId) {
        return store.isOnline(employeeId);
    }

    public Set<Long> onlineIds() {
        return store.onlineIds();
    }

    public void setOnline(Long employeeId, boolean value) {
        boolean changed = store.isOnline(employeeId) != value;
        store.setOnline(employeeId, value);
        if (changed) {
            realtime.publish("/topic/presence",
                    new PresenceEvent(employeeId, value ? "ONLINE" : "OFFLINE", LocalDateTime.now()));
        }
    }

    public void profileChanged(Long employeeId, String availability) {
        PresenceEvent event = new PresenceEvent(employeeId, availability, LocalDateTime.now());
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    realtime.publish("/topic/presence", event);
                }
            });
        } else {
            realtime.publish("/topic/presence", event);
        }
    }

    public record PresenceEvent(Long employeeId, String status, LocalDateTime changedAt) {}
}
