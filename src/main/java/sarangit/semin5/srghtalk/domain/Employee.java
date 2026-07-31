package sarangit.semin5.srghtalk.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(indexes = {
        @Index(name = "idx_employee_name", columnList = "name"),
        @Index(name = "idx_employee_department", columnList = "department_id")
})
public class Employee {
    public enum Role { USER, NOTICE_WRITER, ADMIN }
    public enum Status { ACTIVE, LOCKED, RETIRED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String employeeNumber;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 60)
    private String position;

    @Column(length = 30)
    private String phone;

    @Column(length = 120)
    private String email;

    @Column(length = 20)
    private String extensionNumber;

    @Column(length = 120)
    private String statusMessage;

    @Column(length = 20)
    @Builder.Default
    private String availability = "ONLINE";

    @Column(length = 20)
    @Builder.Default
    private String avatarColor = "#10adc8";

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String avatarImage;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Status status = Status.ACTIVE;

    private LocalDateTime lastLoginAt;
}
