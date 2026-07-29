package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.domain.Employee;
import sarangit.semin5.srghtalk.repository.DepartmentRepository;
import sarangit.semin5.srghtalk.repository.EmployeeRepository;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.DtoMapper;
import java.util.List;

@RestController
@RequestMapping("/api/directory")
@RequiredArgsConstructor
public class DirectoryController {
    private final AuthService auth;
    private final DepartmentRepository departments;
    private final EmployeeRepository employees;
    private final DtoMapper mapper;

    @GetMapping("/departments")
    public List<DepartmentDto> departments(HttpServletRequest request) {
        auth.authenticate(request);
        return departments.findAllByActiveTrueOrderByName().stream().map(mapper::department).toList();
    }

    @GetMapping("/employees")
    public List<EmployeeDto> employees(HttpServletRequest request,
                                       @RequestParam(required = false) Long departmentId,
                                       @RequestParam(defaultValue = "") String q) {
        auth.authenticate(request);
        List<Employee> list = departmentId == null
                ? employees.findAllByStatusOrderByName(Employee.Status.ACTIVE)
                : employees.findAllByDepartmentIdAndStatusOrderByName(departmentId, Employee.Status.ACTIVE);
        String query = q.trim().toLowerCase();
        return list.stream()
                .filter(e -> query.isBlank() || e.getName().toLowerCase().contains(query)
                        || e.getEmployeeNumber().toLowerCase().contains(query)
                        || (e.getPosition() != null && e.getPosition().toLowerCase().contains(query)))
                .map(mapper::employee).toList();
    }
}
