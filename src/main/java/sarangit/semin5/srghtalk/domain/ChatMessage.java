package sarangit.semin5.srghtalk.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(indexes = @Index(name = "idx_message_room_id", columnList = "room_id,id"))
public class ChatMessage {
    public enum Type { TEXT, FILE, IMAGE, SYSTEM }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id")
    private ChatRoom room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Employee sender;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(length = 4000)
    private String content;

    @Column(name = "original_content", length = 4000)
    private String originalContent;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    private LocalDateTime editedAt;

    @Builder.Default
    private boolean deleted = false;
}
