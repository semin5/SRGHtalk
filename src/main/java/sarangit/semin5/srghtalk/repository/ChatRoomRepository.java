package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import sarangit.semin5.srghtalk.domain.ChatRoom;
import java.util.List;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    @Query("select rm.room from RoomMember rm where rm.employee.id = :employeeId order by rm.room.updatedAt desc")
    List<ChatRoom> findAllForEmployee(Long employeeId);

    @Query(value = """
            select cr.* from chat_room cr
            join room_member selected_member on selected_member.room_id = cr.id
            where cr.type = 'DIRECT' and selected_member.employee_id in (:employeeIds)
            group by cr.id
            having count(distinct selected_member.employee_id) = :participantCount
               and (select count(*) from room_member all_member where all_member.room_id = cr.id) = :participantCount
            """, nativeQuery = true)
    List<ChatRoom> findDirectByExactMembers(List<Long> employeeIds, long participantCount);
}
