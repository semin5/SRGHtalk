package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;

@Component
@RequiredArgsConstructor
public class DtoMapper {
    private final EmployeeRepository employees;
    private final RoomMemberRepository members;
    private final FileAttachmentRepository files;
    private final PresenceService presence;

    public DepartmentDto department(Department d) {
        long count = employees.findAllByDepartmentIdAndStatusOrderByName(d.getId(), Employee.Status.ACTIVE).size();
        return new DepartmentDto(d.getId(), d.getName(), d.getExtensionNumber(), count, d.isActive());
    }

    public EmployeeDto employee(Employee e) {
        Department d = e.getDepartment();
        return new EmployeeDto(e.getId(), e.getEmployeeNumber(), e.getName(), e.getPosition(), e.getPhone(),
                e.getEmail(), e.getExtensionNumber(), d == null ? null : d.getId(), d == null ? null : d.getName(),
                e.getRole().name(), e.getStatus().name(), presence.isOnline(e.getId()),
                e.getStatusMessage(), e.getAvailability(), e.getAvatarColor(), e.getAvatarImage());
    }

    public MessageDto message(ChatMessage m) {
        long unread = members.findAllByRoomId(m.getRoom().getId()).stream()
                .filter(rm -> !rm.getEmployee().getId().equals(m.getSender().getId()))
                .filter(rm -> rm.getLastReadMessageId() == null || rm.getLastReadMessageId() < m.getId())
                .count();
        FileDto file = files.findAll().stream().filter(f -> f.getMessage().getId().equals(m.getId())).findFirst()
                .map(f -> new FileDto(f.getId(), f.getOriginalName(), f.getContentType(), f.getSizeBytes(),
                        "/api/files/" + f.getId(), f.getBatchId())).orElse(null);
        return new MessageDto(m.getId(), m.getRoom().getId(), m.getSender().getId(), m.getSender().getName(),
                m.getType().name(), m.isDeleted() ? "삭제된 메시지입니다." : m.getContent(), m.getSentAt(), unread, file);
    }
}
