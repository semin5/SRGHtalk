package sarangit.semin5.srghtalk.api;

import sarangit.semin5.srghtalk.domain.*;
import java.time.LocalDateTime;
import java.util.List;

public final class ApiDtos {
    private ApiDtos() {}

    public record DepartmentDto(Long id, String name, String extensionNumber, long memberCount, boolean active) {}
    public record EmployeeDto(Long id, String employeeNumber, String name, String position, String phone,
                              String email, Long departmentId, String departmentName, String role,
                              String status, boolean online) {}
    public record MessageDto(Long id, Long roomId, Long senderId, String senderName, String type,
                             String content, LocalDateTime sentAt, long unreadCount, FileDto file) {}
    public record FileDto(Long id, String originalName, String contentType, long sizeBytes, String downloadUrl) {}
    public record RoomDto(Long id, String name, String type, int memberCount, long unreadCount,
                          MessageDto lastMessage, List<EmployeeDto> members) {}
}
