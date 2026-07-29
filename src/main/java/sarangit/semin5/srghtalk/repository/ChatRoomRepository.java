package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import sarangit.semin5.srghtalk.domain.ChatRoom;
import java.util.List;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    @Query("select rm.room from RoomMember rm where rm.employee.id = :employeeId order by rm.room.updatedAt desc")
    List<ChatRoom> findAllForEmployee(Long employeeId);
}
