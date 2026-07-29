package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.domain.ChatMessage;
import sarangit.semin5.srghtalk.domain.ChatRoom;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.ChatService;
import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {
    private final AuthService auth;
    private final ChatService chat;

    public record CreateRoomRequest(String name, ChatRoom.Type type, @NotEmpty List<Long> employeeIds) {}
    public record SendRequest(String content, ChatMessage.Type type) {}
    public record ReadRequest(Long messageId) {}

    @GetMapping
    public List<RoomDto> rooms(HttpServletRequest request) {
        return chat.roomsFor(auth.authenticate(request));
    }

    @PostMapping
    public RoomDto create(HttpServletRequest request, @Valid @RequestBody CreateRoomRequest body) {
        return chat.create(auth.authenticate(request), body.name(),
                body.type() == null ? ChatRoom.Type.GROUP : body.type(), body.employeeIds());
    }

    @GetMapping("/{roomId}/messages")
    public List<MessageDto> messages(HttpServletRequest request, @PathVariable Long roomId,
                                     @RequestParam(defaultValue = "50") int limit) {
        return chat.history(auth.authenticate(request), roomId, limit);
    }

    @PostMapping("/{roomId}/messages")
    public MessageDto send(HttpServletRequest request, @PathVariable Long roomId, @RequestBody SendRequest body) {
        return chat.send(auth.authenticate(request), roomId, body.content(),
                body.type() == null ? ChatMessage.Type.TEXT : body.type());
    }

    @PostMapping("/{roomId}/read")
    public void read(HttpServletRequest request, @PathVariable Long roomId, @RequestBody ReadRequest body) {
        chat.markRead(auth.authenticate(request), roomId, body.messageId());
    }

    @DeleteMapping("/messages/{messageId}")
    public void delete(HttpServletRequest request, @PathVariable Long messageId) {
        chat.deleteMessage(auth.authenticate(request), messageId);
    }
}
