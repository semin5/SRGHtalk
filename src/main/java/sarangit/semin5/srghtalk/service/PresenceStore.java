package sarangit.semin5.srghtalk.service;

import java.util.Set;

public interface PresenceStore {
    boolean isOnline(Long employeeId);
    Set<Long> onlineIds();
    void setOnline(Long employeeId, boolean online);
}
