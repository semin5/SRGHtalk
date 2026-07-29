package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.api.ApiException;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatRoomRepository rooms;
    private final RoomMemberRepository members;
    private final ChatMessageRepository messages;
    private final EmployeeRepository employees;
    private final DtoMapper mapper;
    private final SimpMessagingTemplate messaging;

    @Transactional(readOnly = true)
    public List<RoomDto> roomsFor(Employee employee) {
        return rooms.findAllForEmployee(employee.getId()).stream().map(room -> {
            RoomMember self = membership(room.getId(), employee.getId());
            MessageDto last = messages.findTopByRoomIdOrderByIdDesc(room.getId()).map(mapper::message).orElse(null);
            long unread = last == null ? 0 : messages.countByRoomIdAndIdGreaterThan(
                    room.getId(), Optional.ofNullable(self.getLastReadMessageId()).orElse(0L));
            List<EmployeeDto> roomMembers = members.findAllByRoomId(room.getId()).stream()
                    .map(RoomMember::getEmployee).map(mapper::employee).toList();
            return new RoomDto(room.getId(), room.getName(), room.getType().name(), roomMembers.size(),
                    unread, last, roomMembers);
        }).toList();
    }

    @Transactional
    public RoomDto create(Employee creator, String name, ChatRoom.Type type, List<Long> employeeIds) {
        Set<Long> ids = new LinkedHashSet<>(employeeIds);
        ids.add(creator.getId());
        if (ids.size() < 2) throw new ApiException(HttpStatus.BAD_REQUEST, "대화 상대를 선택해 주세요.");
        List<Employee> selected = employees.findAllById(ids);
        if (selected.size() != ids.size()) throw new ApiException(HttpStatus.BAD_REQUEST, "존재하지 않는 직원이 포함되어 있습니다.");
        String roomName = name == null || name.isBlank()
                ? selected.stream().filter(e -> !e.getId().equals(creator.getId())).map(Employee::getName).reduce((a,b) -> a + ", " + b).orElse("새 대화")
                : name.trim();
        LocalDateTime now = LocalDateTime.now();
        ChatRoom room = rooms.save(ChatRoom.builder().name(roomName).type(type).createdBy(creator)
                .createdAt(now).updatedAt(now).build());
        members.saveAll(selected.stream().map(e -> RoomMember.builder().room(room).employee(e).joinedAt(now).build()).toList());
        messaging.convertAndSend("/topic/rooms", (Object) Map.of("type", "ROOM_CREATED", "roomId", room.getId()));
        return roomsFor(creator).stream().filter(r -> r.id().equals(room.getId())).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> history(Employee employee, Long roomId, int limit) {
        membership(roomId, employee.getId());
        List<ChatMessage> result = messages.findAllByRoomIdOrderByIdDesc(roomId, PageRequest.of(0, Math.min(limit, 100)));
        Collections.reverse(result);
        return result.stream().map(mapper::message).toList();
    }

    @Transactional
    public MessageDto send(Employee sender, Long roomId, String content, ChatMessage.Type type) {
        membership(roomId, sender.getId());
        if (content == null || content.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "메시지를 입력해 주세요.");
        ChatRoom room = rooms.findById(roomId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "대화방을 찾을 수 없습니다."));
        ChatMessage saved = messages.save(ChatMessage.builder().room(room).sender(sender).type(type)
                .content(content.trim()).sentAt(LocalDateTime.now()).build());
        room.setUpdatedAt(saved.getSentAt());
        markRead(sender, roomId, saved.getId());
        MessageDto dto = mapper.message(saved);
        messaging.convertAndSend("/topic/rooms/" + roomId, dto);
        return dto;
    }

    @Transactional
    public void markRead(Employee employee, Long roomId, Long messageId) {
        RoomMember member = membership(roomId, employee.getId());
        if (member.getLastReadMessageId() == null || member.getLastReadMessageId() < messageId) {
            member.setLastReadMessageId(messageId);
            messaging.convertAndSend("/topic/rooms/" + roomId + "/read",
                    (Object) Map.of("roomId", roomId, "employeeId", employee.getId(), "messageId", messageId));
        }
    }

    @Transactional
    public void deleteMessage(Employee employee, Long messageId) {
        ChatMessage message = messages.findById(messageId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "메시지를 찾을 수 없습니다."));
        if (!message.getSender().getId().equals(employee.getId()) && employee.getRole() != Employee.Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "메시지를 삭제할 권한이 없습니다.");
        }
        message.setDeleted(true);
        message.setContent(null);
        messaging.convertAndSend("/topic/rooms/" + message.getRoom().getId(),
                (Object) Map.of("type", "MESSAGE_DELETED", "messageId", messageId));
    }

    public RoomMember membership(Long roomId, Long employeeId) {
        return members.findByRoomIdAndEmployeeId(roomId, employeeId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "대화방에 참여하고 있지 않습니다."));
    }
}
