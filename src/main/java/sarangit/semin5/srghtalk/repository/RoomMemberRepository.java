package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.RoomMember;
import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {
    Optional<RoomMember> findByRoomIdAndEmployeeId(Long roomId, Long employeeId);
    List<RoomMember> findAllByRoomId(Long roomId);
    long countByRoomId(Long roomId);
}
