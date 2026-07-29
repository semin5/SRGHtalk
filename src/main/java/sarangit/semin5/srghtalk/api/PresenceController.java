package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.PresenceService;
import java.util.Set;

@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {
    private final AuthService auth;
    private final PresenceService presence;

    @GetMapping
    public Set<Long> online(HttpServletRequest request) {
        auth.authenticate(request);
        return presence.onlineIds();
    }

    @PostMapping("/{online}")
    public void update(HttpServletRequest request, @PathVariable boolean online) {
        presence.setOnline(auth.authenticate(request).getId(), online);
    }
}
