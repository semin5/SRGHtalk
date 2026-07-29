package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sarangit.semin5.srghtalk.api.ApiDtos.EmployeeDto;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.DtoMapper;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;
    private final DtoMapper mapper;

    public record LoginRequest(@NotBlank String employeeNumber, @NotBlank String password) {}

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        var result = auth.login(request.employeeNumber(), request.password());
        return Map.of("token", result.token(), "employee", mapper.employee(result.employee()));
    }

    @GetMapping("/me")
    public EmployeeDto me(HttpServletRequest request) {
        return mapper.employee(auth.authenticate(request));
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest request) {
        auth.logout(request);
    }
}
