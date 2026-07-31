package sarangit.semin5.srghtalk.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"notice_id", "recipient_id"}))
public class NoticeRecipient {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Notice notice;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Employee recipient;
    private LocalDateTime readAt;
}
