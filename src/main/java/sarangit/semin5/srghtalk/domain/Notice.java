package sarangit.semin5.srghtalk.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Employee sender;
    @Column(length = 200)
    private String title;
    @Column(length = 4000)
    private String content;
    @Column(nullable = false)
    private LocalDateTime sentAt;
    private String originalName;
    private String storedName;
    private String contentType;
    private Long sizeBytes;
}
