package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.Employee;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByEmployeeNumber(String employeeNumber);
    List<Employee> findAllByStatusOrderByName(Employee.Status status);
    List<Employee> findAllByDepartmentIdAndStatusOrderByName(Long departmentId, Employee.Status status);
}
