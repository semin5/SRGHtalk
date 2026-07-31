package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.Notice;

public interface NoticeRepository extends JpaRepository<Notice, Long> {}
