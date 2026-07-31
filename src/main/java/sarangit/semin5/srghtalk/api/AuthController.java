package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import sarangit.semin5.srghtalk.api.ApiDtos.EmployeeDto;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.DtoMapper;
import sarangit.semin5.srghtalk.service.PresenceService;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;
    private final DtoMapper mapper;
    private final PresenceService presence;

    public record LoginRequest(@NotBlank String employeeNumber, @NotBlank String password) {}
    public record ProfileRequest(
            @NotBlank @Size(max = 50) String name,
            @Size(max = 20) String extensionNumber,
            @Size(max = 120) String statusMessage,
            String availability,
            String avatarColor,
            @Size(max = 500000) String avatarImage,
            String currentPassword,
            @Size(min = 4, max = 100) String newPassword) {}

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        var result = auth.login(request.employeeNumber(), request.password());
        return Map.of("token", result.token(), "employee", mapper.employee(result.employee()));
    }

    @GetMapping("/me")
    public EmployeeDto me(HttpServletRequest request) {
        return mapper.employee(auth.authenticate(request));
    }

    @PutMapping("/me")
    @Transactional
    public EmployeeDto updateMe(HttpServletRequest request, @Valid @RequestBody ProfileRequest body) {
        var employee = auth.authenticate(request);
        employee.setName(body.name().trim());
        employee.setExtensionNumber(clean(body.extensionNumber()));
        employee.setStatusMessage(clean(body.statusMessage()));
        if (body.availability() != null && java.util.Set.of("ONLINE", "BUSY", "AWAY", "OFFLINE").contains(body.availability())) {
            employee.setAvailability(body.availability());
        }
        if (body.avatarColor() != null && body.avatarColor().matches("^#[0-9a-fA-F]{6}$")) {
            employee.setAvatarColor(body.avatarColor());
        }
        if (body.avatarImage() == null || body.avatarImage().isBlank()) {
            employee.setAvatarImage(null);
        } else if (body.avatarImage().matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")) {
            employee.setAvatarImage(body.avatarImage());
        } else {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "지원하지 않는 프로필 사진 형식입니다.");
        }
        if (body.newPassword() != null && !body.newPassword().isBlank()) {
            if (body.currentPassword() == null || !auth.matchesPassword(body.currentPassword(), employee.getPasswordHash())) {
                throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
            }
            employee.setPasswordHash(auth.encodePassword(body.newPassword()));
        }
        presence.profileChanged(employee.getId(), employee.getAvailability());
        return mapper.employee(employee);
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest request) {
        auth.logout(request);
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
