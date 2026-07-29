package sarangit.semin5.srghtalk.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import sarangit.semin5.srghtalk.api.ApiDtos.MessageDto;
import sarangit.semin5.srghtalk.domain.ChatMessage;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.ChatService;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {
    private final AuthService auth;
    private final ChatService chat;

    public record SendMessage(@NotNull Long roomId, @NotBlank String content, ChatMessage.Type type) {}

    @MessageMapping("/chat.send")
    public MessageDto send(@Header("token") String token, @Valid SendMessage body) {
        return chat.send(auth.authenticateRaw(token), body.roomId(), body.content(),
                body.type() == null ? ChatMessage.Type.TEXT : body.type());
    }
}
