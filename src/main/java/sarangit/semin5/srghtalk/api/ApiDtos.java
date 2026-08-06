package sarangit.semin5.srghtalk.api;

import sarangit.semin5.srghtalk.domain.*;
import java.time.LocalDateTime;
import java.util.List;

public final class ApiDtos {
    private ApiDtos() {}

    public record DepartmentDto(Long id, String name, String extensionNumber, long memberCount, boolean active) {}
    public record EmployeeDto(Long id, String employeeNumber, String name, String position, String phone,
                              String email, String extensionNumber, Long departmentId, String departmentName, String role,
                              String status, boolean online, String statusMessage, String availability,
                              String avatarColor, String avatarImage) {}
    public record MessageDto(Long id, Long roomId, Long senderId, String senderName, String type,
                             String content, LocalDateTime sentAt, long unreadCount, FileDto file) {}
    public record FileDto(Long id, String originalName, String contentType, long sizeBytes, String downloadUrl,
                          String batchId) {}
    public record RoomDto(Long id, String name, String type, int memberCount, long unreadCount,
                          MessageDto lastMessage, List<EmployeeDto> members, boolean pinned, boolean muted) {}
    public record NoticeDto(Long id, Long senderId, String senderName, String senderPosition,
                            String senderDepartment, String title, String content, List<String> recipients,
                            LocalDateTime sentAt, boolean read, FileDto file) {}
}
