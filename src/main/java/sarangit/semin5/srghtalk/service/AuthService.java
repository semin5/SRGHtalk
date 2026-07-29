package sarangit.semin5.srghtalk.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sarangit.semin5.srghtalk.api.ApiException;
import sarangit.semin5.srghtalk.domain.AuthToken;
import sarangit.semin5.srghtalk.domain.Employee;
import sarangit.semin5.srghtalk.repository.AuthTokenRepository;
import sarangit.semin5.srghtalk.repository.EmployeeRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final EmployeeRepository employees;
    private final AuthTokenRepository tokens;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Value("${app.auth.token-hours:24}")
    private long tokenHours;

    public record LoginResult(String token, Employee employee) {}

    @Transactional
    public LoginResult login(String employeeNumber, String password) {
        Employee employee = employees.findByEmployeeNumber(employeeNumber)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "사번 또는 비밀번호가 올바르지 않습니다."));
        if (employee.getStatus() != Employee.Status.ACTIVE || !encoder.matches(password, employee.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "사번 또는 비밀번호가 올바르지 않습니다.");
        }
        String raw = UUID.randomUUID() + "." + UUID.randomUUID();
        tokens.save(AuthToken.builder()
                .tokenHash(hash(raw))
                .employee(employee)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusHours(tokenHours))
                .build());
        employee.setLastLoginAt(LocalDateTime.now());
        return new LoginResult(raw, employee);
    }

    @Transactional(readOnly = true)
    public Employee authenticate(HttpServletRequest request) {
        return authenticateRaw(extract(request));
    }

    @Transactional(readOnly = true)
    public Employee authenticateRaw(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return tokens.findByTokenHashAndExpiresAtAfter(hash(rawToken), LocalDateTime.now())
                .map(AuthToken::getEmployee)
                .filter(it -> it.getStatus() == Employee.Status.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 만료되었습니다."));
    }

    @Transactional
    public void logout(HttpServletRequest request) {
        String raw = extract(request);
        if (raw != null) tokens.deleteByTokenHash(hash(raw));
    }

    public void requireAdmin(Employee employee) {
        if (employee.getRole() != Employee.Role.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        }
    }

    public String encodePassword(String raw) {
        return encoder.encode(raw);
    }

    private String extract(HttpServletRequest request) {
        String value = request.getHeader("Authorization");
        return value != null && value.startsWith("Bearer ") ? value.substring(7) : null;
    }

    private String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
