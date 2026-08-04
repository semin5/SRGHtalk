package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
    private final RealtimePublisher realtime;

    @Transactional(readOnly = true)
    public List<RoomDto> roomsFor(Employee employee) {
        return rooms.findAllForEmployee(employee.getId()).stream().map(room -> {
            RoomMember self = membership(room.getId(), employee.getId());
            MessageDto last = messages.findTopByRoomIdOrderByIdDesc(room.getId()).map(mapper::message).orElse(null);
            long unread = last == null ? 0 : messages.countByRoomIdAndIdGreaterThan(
                    room.getId(), Optional.ofNullable(self.getLastReadMessageId()).orElse(0L));
            List<RoomMember> memberships = members.findAllByRoomId(room.getId());
            List<EmployeeDto> roomMembers = memberships.stream()
                    .map(RoomMember::getEmployee).map(mapper::employee).toList();
            String generatedName = memberships.stream()
                    .map(RoomMember::getEmployee)
                    .filter(member -> !member.getId().equals(employee.getId()))
                    .map(Employee::getName)
                    .collect(java.util.stream.Collectors.joining(", "));
            if (generatedName.isBlank()) generatedName = "나와의 채팅";
            String displayName = self.getCustomName() == null || self.getCustomName().isBlank()
                    ? generatedName : self.getCustomName();
            return new RoomDto(room.getId(), displayName, room.getType().name(), roomMembers.size(),
                    unread, last, roomMembers, self.isPinned(), self.isMuted());
        }).toList();
    }

    @Transactional
    public RoomDto create(Employee creator, String name, ChatRoom.Type type, List<Long> employeeIds) {
        Set<Long> ids = new LinkedHashSet<>(employeeIds);
        ids.add(creator.getId());
        List<Employee> selected = employees.findAllById(ids);
        if (selected.size() != ids.size()) throw new ApiException(HttpStatus.BAD_REQUEST, "존재하지 않는 직원이 포함되어 있습니다.");
        if (ids.size() <= 2) {
            Optional<ChatRoom> existingRoom = rooms.findAllForEmployee(creator.getId()).stream()
                    .filter(candidate -> members.findAllByRoomId(candidate.getId()).stream()
                            .map(member -> member.getEmployee().getId())
                            .collect(java.util.stream.Collectors.toSet())
                            .equals(ids))
                    .findFirst();
            if (existingRoom.isPresent()) {
                Long existingRoomId = existingRoom.get().getId();
                return roomsFor(creator).stream()
                        .filter(room -> room.id().equals(existingRoomId))
                        .findFirst()
                        .orElseThrow();
            }
        }
        String roomName = name == null || name.isBlank()
                ? selected.stream().filter(e -> !e.getId().equals(creator.getId())).map(Employee::getName).reduce((a,b) -> a + ", " + b).orElse("새 대화")
                : name.trim();
        LocalDateTime now = LocalDateTime.now();
        ChatRoom room = rooms.save(ChatRoom.builder().name(roomName).type(type).createdBy(creator)
                .createdAt(now).updatedAt(now).build());
        members.saveAll(selected.stream().map(e -> {
            String memberName = selected.stream().filter(other -> !other.getId().equals(e.getId()))
                    .map(Employee::getName).collect(java.util.stream.Collectors.joining(", "));
            if (memberName.isBlank()) memberName = "나와의 채팅";
            return RoomMember.builder().room(room).employee(e).joinedAt(now).customName(memberName).build();
        }).toList());
        Map<String, Object> roomCreated = Map.of("type", "ROOM_CREATED", "roomId", room.getId());
        publishAfterCommit("/topic/rooms", roomCreated);
        selected.forEach(target -> publishAfterCommit("/topic/employees/" + target.getId() + "/rooms", roomCreated));
        return roomsFor(creator).stream().filter(r -> r.id().equals(room.getId())).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> history(Employee employee, Long roomId, int limit) {
        return history(employee, roomId, limit, null);
    }

    @Transactional(readOnly = true)
    public List<MessageDto> history(Employee employee, Long roomId, int limit, Long beforeId) {
        membership(roomId, employee.getId());
        var page = PageRequest.of(0, Math.min(Math.max(limit, 1), 100));
        List<ChatMessage> result = beforeId == null
                ? messages.findAllByRoomIdOrderByIdDesc(roomId, page)
                : messages.findAllByRoomIdAndIdLessThanOrderByIdDesc(roomId, beforeId, page);
        Collections.reverse(result);
        return result.stream().map(mapper::message).toList();
    }

    @Transactional
    public MessageDto send(Employee sender, Long roomId, String content, ChatMessage.Type type) {
        return send(sender, roomId, content, type, true);
    }

    @Transactional
    public MessageDto send(Employee sender, Long roomId, String content, ChatMessage.Type type, boolean publish) {
        membership(roomId, sender.getId());
        if (content == null || content.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "메시지를 입력해 주세요.");
        ChatRoom room = rooms.findById(roomId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "대화방을 찾을 수 없습니다."));
        ChatMessage saved = messages.save(ChatMessage.builder().room(room).sender(sender).type(type)
                .content(content.trim()).sentAt(LocalDateTime.now()).build());
        room.setUpdatedAt(saved.getSentAt());
        markRead(sender, roomId, saved.getId());
        MessageDto dto = mapper.message(saved);
        if (publish) realtime.publish("/topic/rooms/" + roomId, dto);
        return dto;
    }

    public void publishMessage(Long roomId, MessageDto dto) {
        realtime.publish("/topic/rooms/" + roomId, dto);
    }

    @Transactional
    public void markRead(Employee employee, Long roomId, Long messageId) {
        RoomMember member = membership(roomId, employee.getId());
        if (member.getLastReadMessageId() == null || member.getLastReadMessageId() < messageId) {
            member.setLastReadMessageId(messageId);
            members.saveAndFlush(member);
            Map<String, Long> event = Map.of(
                    "roomId", roomId,
                    "employeeId", employee.getId(),
                    "messageId", messageId);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        realtime.publish("/topic/rooms/" + roomId + "/read", event);
                    }
                });
            } else {
                realtime.publish("/topic/rooms/" + roomId + "/read", event);
            }
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
        realtime.publish("/topic/rooms/" + message.getRoom().getId(),
                Map.of("type", "MESSAGE_DELETED", "messageId", messageId));
    }

    @Transactional
    public void leave(Employee employee, Long roomId) {
        RoomMember member = membership(roomId, employee.getId());
        ChatRoom room = member.getRoom();
        List<RoomMember> currentMembers = members.findAllByRoomId(roomId);
        for (RoomMember currentMember : currentMembers) {
            if (currentMember.getCustomName() == null || currentMember.getCustomName().isBlank()) {
                String stableName = currentMembers.stream()
                        .map(RoomMember::getEmployee)
                        .filter(other -> !other.getId().equals(currentMember.getEmployee().getId()))
                        .map(Employee::getName)
                        .collect(java.util.stream.Collectors.joining(", "));
                currentMember.setCustomName(stableName.isBlank() ? "나와의 채팅" : stableName);
            }
        }
        members.saveAll(currentMembers);
        ChatMessage systemMessage = messages.save(ChatMessage.builder().room(room).sender(employee)
                .type(ChatMessage.Type.SYSTEM).content(employee.getName() + "님이 대화방을 나갔습니다.")
                .sentAt(LocalDateTime.now()).build());
        room.setUpdatedAt(systemMessage.getSentAt());
        members.delete(member);
        publishAfterCommit("/topic/rooms/" + roomId, mapper.message(systemMessage));
        publishAfterCommit("/topic/rooms", Map.of(
                "type", "ROOM_MEMBER_LEFT",
                "roomId", roomId,
                "employeeId", employee.getId()));
    }

    @Transactional
    public RoomDto updatePreferences(Employee employee, Long roomId, String customName, Boolean pinned, Boolean muted) {
        RoomMember member = membership(roomId, employee.getId());
        if (customName != null) {
            String cleaned = customName.trim();
            if (cleaned.isEmpty() || cleaned.length() > 120)
                throw new ApiException(HttpStatus.BAD_REQUEST, "대화방 이름은 1~120자로 입력해 주세요.");
            member.setCustomName(cleaned);
        }
        if (pinned != null) member.setPinned(pinned);
        if (muted != null) member.setMuted(muted);
        members.save(member);
        return roomsFor(employee).stream().filter(room -> room.id().equals(roomId)).findFirst().orElseThrow();
    }

    private void publishAfterCommit(String destination, Object payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { realtime.publish(destination, payload); }
            });
        } else {
            realtime.publish(destination, payload);
        }
    }

    public RoomMember membership(Long roomId, Long employeeId) {
        return members.findByRoomIdAndEmployeeId(roomId, employeeId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "대화방에 참여하고 있지 않습니다."));
    }
}
