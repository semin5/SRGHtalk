package sarangit.semin5.srghtalk.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Department {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "parent_id")
    private Department parent;

    @Column(name = "hierarchy_level")
    private Integer hierarchyLevel;

    @Column(name = "full_path", unique = true, length = 400)
    private String fullPath;

    @Column(length = 30)
    private String extensionNumber;

    @Builder.Default
    private boolean active = true;
}
