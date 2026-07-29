package sarangit.semin5.srghtalk.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;
import java.time.LocalDateTime;
import java.util.List;

@Configuration
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true")
public class DemoDataInitializer {
    @Bean
    CommandLineRunner demoData(DepartmentRepository departments, EmployeeRepository employees,
                               ChatRoomRepository rooms, RoomMemberRepository members,
                               ChatMessageRepository messages) {
        return args -> {
            if (employees.count() > 0) return;
            Department it = departments.save(Department.builder().name("IT팀").extensionNumber("7001").build());
            Department nursing = departments.save(Department.builder().name("간호부").extensionNumber("6100").build());
            Department admin = departments.save(Department.builder().name("원무팀").extensionNumber("5001").build());
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
            Employee minho = employees.save(Employee.builder().employeeNumber("1001").passwordHash(encoder.encode("1234"))
                    .name("서민호").position("사원").email("minho@saranghospital.kr").department(it).role(Employee.Role.ADMIN).build());
            Employee doyoon = employees.save(Employee.builder().employeeNumber("1002").passwordHash(encoder.encode("1234"))
                    .name("이도윤").position("팀장").department(it).build());
            Employee yujin = employees.save(Employee.builder().employeeNumber("1003").passwordHash(encoder.encode("1234"))
                    .name("정유진").position("대리").department(it).build());
            Employee jihyun = employees.save(Employee.builder().employeeNumber("2001").passwordHash(encoder.encode("1234"))
                    .name("박지현").position("간호사").department(nursing).build());
            Employee sunwoo = employees.save(Employee.builder().employeeNumber("3001").passwordHash(encoder.encode("1234"))
                    .name("김선우").position("원장").department(admin).build());
            LocalDateTime now = LocalDateTime.now();
            ChatRoom room = rooms.save(ChatRoom.builder().name("IT팀 업무방").type(ChatRoom.Type.GROUP)
                    .createdBy(minho).createdAt(now.minusDays(7)).updatedAt(now).build());
            members.saveAll(List.of(minho, doyoon, yujin).stream()
                    .map(e -> RoomMember.builder().room(room).employee(e).joinedAt(now.minusDays(7)).build()).toList());
            messages.save(ChatMessage.builder().room(room).sender(doyoon).type(ChatMessage.Type.TEXT)
                    .content("회의실 PC 네트워크 점검 완료했습니다. 현재 정상적으로 사용 가능합니다.")
                    .sentAt(now.minusMinutes(20)).build());
            ChatMessage last = messages.save(ChatMessage.builder().room(room).sender(minho).type(ChatMessage.Type.TEXT)
                    .content("수고하셨습니다! 3층 외래 쪽도 오후에 확인 부탁드려요.")
                    .sentAt(now.minusMinutes(15)).build());
            members.findByRoomIdAndEmployeeId(room.getId(), minho.getId()).ifPresent(m -> {
                m.setLastReadMessageId(last.getId());
                members.save(m);
            });
        };
    }
}
