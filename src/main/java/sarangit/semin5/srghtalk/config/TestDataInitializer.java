package sarangit.semin5.srghtalk.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.test-data.enabled", havingValue = "true")
public class TestDataInitializer implements ApplicationRunner {
    private final DepartmentRepository departments;
    private final EmployeeRepository employees;
    private final ChatRoomRepository rooms;
    private final RoomMemberRepository members;
    private final ChatMessageRepository messages;
    private final NoticeRepository notices;
    private final NoticeRecipientRepository recipients;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (employees.findByEmployeeNumber("99261016").isPresent()) return;

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String userPassword = encoder.encode("1234");
        List<Department> departmentList = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            String name = List.of("진료지원팀", "간호부", "원무팀", "전산팀", "검사실", "경영지원팀").get(i);
            departmentList.add(departments.save(Department.builder().name(name).hierarchyLevel(1)
                    .fullPath("테스트병원/" + name).extensionNumber("20" + (i + 1)).active(true).build()));
        }

        Employee admin = employees.save(Employee.builder().employeeNumber("99261016")
                .passwordHash(encoder.encode("1")).name("테스트 관리자").position("관리자")
                .extensionNumber("2000").department(departmentList.get(3)).role(Employee.Role.ADMIN)
                .status(Employee.Status.ACTIVE).availability("ONLINE").statusMessage("테스트 서버 관리자").build());

        String[] surnames = {"김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"};
        String[] given = {"민준", "서연", "도윤", "지우", "현우", "수빈", "지훈", "예린"};
        String[] positions = {"사원", "주임", "대리", "과장", "팀장"};
        List<Employee> staff = new ArrayList<>();
        staff.add(admin);
        for (int i = 1; i <= 40; i++) {
            staff.add(employees.save(Employee.builder().employeeNumber(String.format("T%05d", i))
                    .passwordHash(userPassword).name(surnames[(i - 1) % surnames.length] + given[(i * 3) % given.length])
                    .position(positions[i % positions.length]).extensionNumber(String.valueOf(2100 + i))
                    .department(departmentList.get(i % departmentList.size())).role(i % 13 == 0 ? Employee.Role.NOTICE_WRITER : Employee.Role.USER)
                    .status(Employee.Status.ACTIVE).availability(i % 9 == 0 ? "BUSY" : "ONLINE")
                    .statusMessage(i % 4 == 0 ? "테스트 업무 중입니다." : null).build()));
        }

        LocalDateTime base = LocalDateTime.now().minusDays(5);
        String[] samples = {"안녕하세요. 테스트 메시지입니다.", "확인했습니다.", "자료 검토 부탁드립니다.",
                "오늘 일정 공유드립니다.", "회의 후 다시 말씀드리겠습니다.", "처리 완료했습니다.", "감사합니다."};
        for (int r = 0; r < 16; r++) {
            boolean direct = r < 10;
            ChatRoom room = rooms.save(ChatRoom.builder().name(direct ? "테스트 대화" : "테스트 그룹 " + (r - 9))
                    .type(direct ? ChatRoom.Type.DIRECT : ChatRoom.Type.GROUP).createdBy(admin)
                    .createdAt(base.plusHours(r)).updatedAt(base.plusHours(r)).build());
            List<Employee> roomUsers = new ArrayList<>();
            roomUsers.add(admin);
            int memberCount = direct ? 2 : 5 + r % 4;
            for (int m = 1; m < memberCount; m++) roomUsers.add(staff.get(1 + (r * 3 + m) % 40));
            for (Employee user : roomUsers) members.save(RoomMember.builder().room(room).employee(user)
                    .joinedAt(room.getCreatedAt()).muted(false).pinned(r < 2 && user == admin).build());
            ChatMessage last = null;
            int messageCount = 10 + r % 7;
            for (int m = 0; m < messageCount; m++) {
                LocalDateTime sentAt = room.getCreatedAt().plusMinutes(m * 17L);
                Employee sender = roomUsers.get(m % roomUsers.size());
                String content = samples[(r + m) % samples.length];
                last = messages.save(ChatMessage.builder().room(room).sender(sender).type(ChatMessage.Type.TEXT)
                        .content(content).originalContent(content).sentAt(sentAt).deleted(false).build());
                room.setUpdatedAt(sentAt);
            }
            rooms.save(room);
            if (last != null) {
                long lastId = last.getId();
                members.findAllByRoomId(room.getId()).forEach(member -> {
                    if (!member.getEmployee().getId().equals(admin.getId())) member.setLastReadMessageId(lastId);
                });
            }
        }

        for (int n = 1; n <= 20; n++) {
            Employee sender = n % 3 == 0 ? staff.get(13) : admin;
            Notice notice = notices.save(Notice.builder().sender(sender).title("테스트 쪽지 " + n)
                    .content("테스트 환경에서 생성된 업무 쪽지 내용입니다. 순번: " + n)
                    .sentAt(LocalDateTime.now().minusHours(21L - n)).build());
            for (int i = 1; i <= 8; i++) {
                Employee recipient = staff.get(1 + (n * 2 + i) % 40);
                recipients.save(NoticeRecipient.builder().notice(notice).recipient(recipient)
                        .readAt(i % 3 == 0 ? notice.getSentAt().plusMinutes(30) : null).build());
            }
        }
    }
}
