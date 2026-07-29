package sarangit.semin5.srghtalk.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.ChatMessage;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findAllByRoomIdOrderByIdDesc(Long roomId, Pageable pageable);
    Optional<ChatMessage> findTopByRoomIdOrderByIdDesc(Long roomId);
    long countByRoomIdAndIdGreaterThan(Long roomId, Long id);
}
