package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;
import sarangit.semin5.srghtalk.service.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AuthService auth;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final ChatRoomRepository rooms;
    private final ChatMessageRepository messages;
    private final PresenceService presence;
    private final DtoMapper mapper;

    public record EmployeeRequest(@NotBlank String employeeNumber, String password, @NotBlank String name,
                                  String position, String phone, String email, String extensionNumber, Long departmentId,
                                  Employee.Role role, Employee.Status status) {}
    public record DepartmentRequest(@NotBlank String name, String extensionNumber, Boolean active) {}

    @GetMapping("/stats")
    public Map<String, Object> stats(HttpServletRequest request) {
        auth.requireAdmin(auth.authenticate(request));
        return Map.of("employees", employees.count(), "departments", departments.count(),
                "rooms", rooms.count(), "messages", messages.count(), "online", presence.onlineIds().size());
    }

    @GetMapping("/employees")
    public List<EmployeeDto> employees(HttpServletRequest request) {
        auth.requireAdmin(auth.authenticate(request));
        return employees.findAll().stream().map(mapper::employee).toList();
    }

    @PostMapping("/employees")
    public EmployeeDto createEmployee(HttpServletRequest request, @Valid @RequestBody EmployeeRequest body) {
        auth.requireAdmin(auth.authenticate(request));
        if (employees.findByEmployeeNumber(body.employeeNumber()).isPresent())
            throw new ApiException(HttpStatus.CONFLICT, "이미 사용 중인 사번입니다.");
        Department department = body.departmentId() == null ? null : departments.findById(body.departmentId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "부서를 찾을 수 없습니다."));
        Employee employee = Employee.builder().employeeNumber(body.employeeNumber()).name(body.name())
                .passwordHash(auth.encodePassword(body.password() == null ? "1234" : body.password()))
                .position(body.position()).phone(body.phone()).email(body.email()).department(department)
                .extensionNumber(body.extensionNumber())
                .role(body.role() == null ? Employee.Role.USER : body.role())
                .status(body.status() == null ? Employee.Status.ACTIVE : body.status()).build();
        return mapper.employee(employees.save(employee));
    }

    @PutMapping("/employees/{id}")
    public EmployeeDto updateEmployee(HttpServletRequest request, @PathVariable Long id,
                                      @Valid @RequestBody EmployeeRequest body) {
        auth.requireAdmin(auth.authenticate(request));
        Employee employee = employees.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "직원을 찾을 수 없습니다."));
        employee.setName(body.name());
        employee.setPosition(body.position());
        employee.setPhone(body.phone());
        employee.setEmail(body.email());
        employee.setExtensionNumber(body.extensionNumber());
        employee.setRole(body.role() == null ? employee.getRole() : body.role());
        employee.setStatus(body.status() == null ? employee.getStatus() : body.status());
        employee.setDepartment(body.departmentId() == null ? null : departments.findById(body.departmentId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "부서를 찾을 수 없습니다.")));
        if (body.password() != null && !body.password().isBlank()) employee.setPasswordHash(auth.encodePassword(body.password()));
        return mapper.employee(employees.save(employee));
    }

    @DeleteMapping("/employees/{id}")
    public void deleteEmployee(HttpServletRequest request, @PathVariable Long id) {
        Employee current = auth.authenticate(request);
        auth.requireAdmin(current);
        if (current.getId().equals(id)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "현재 로그인한 관리자 계정은 삭제할 수 없습니다.");
        }
        Employee employee = employees.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "직원을 찾을 수 없습니다."));
        employee.setStatus(Employee.Status.RETIRED);
        presence.setOnline(employee.getId(), false);
        employees.save(employee);
    }

    @PostMapping("/departments")
    public DepartmentDto createDepartment(HttpServletRequest request, @Valid @RequestBody DepartmentRequest body) {
        auth.requireAdmin(auth.authenticate(request));
        return mapper.department(departments.save(Department.builder().name(body.name())
                .extensionNumber(body.extensionNumber()).active(body.active() == null || body.active()).build()));
    }
}
