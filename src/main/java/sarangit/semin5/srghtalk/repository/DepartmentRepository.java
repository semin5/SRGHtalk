package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.Department;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findAllByActiveTrueOrderByName();
}
