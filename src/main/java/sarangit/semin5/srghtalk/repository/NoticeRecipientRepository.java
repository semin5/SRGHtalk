package sarangit.semin5.srghtalk.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sarangit.semin5.srghtalk.domain.NoticeRecipient;
import java.util.List;
import java.util.Optional;

public interface NoticeRecipientRepository extends JpaRepository<NoticeRecipient, Long> {
    List<NoticeRecipient> findAllByRecipientIdOrderByNoticeSentAtDesc(Long recipientId);
    List<NoticeRecipient> findAllByNoticeSenderIdOrderByNoticeSentAtDesc(Long senderId);
    Optional<NoticeRecipient> findByNoticeIdAndRecipientId(Long noticeId, Long recipientId);
    boolean existsByNoticeIdAndRecipientId(Long noticeId, Long recipientId);
    List<NoticeRecipient> findAllByNoticeId(Long noticeId);
}
