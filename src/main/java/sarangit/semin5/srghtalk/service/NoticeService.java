package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import sarangit.semin5.srghtalk.api.ApiDtos.*;
import sarangit.semin5.srghtalk.api.ApiException;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;

import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class NoticeService {
    private final NoticeRepository notices;
    private final NoticeRecipientRepository recipients;
    private final EmployeeRepository employees;
    private final RealtimePublisher realtime;
    private final MinioStorageService storage;
    private final MinioObjectKeyFactory objectKeys;

    @Value("${app.storage.legacy-directory:uploads}")
    private String legacyDirectory;
    @Value("${app.storage.max-size-bytes}")
    private long maxSize;

    @Transactional(readOnly = true)
    public List<NoticeDto> list(Employee employee) {
        Map<Long, NoticeDto> result = new LinkedHashMap<>();
        recipients.findAllByRecipientIdOrderByNoticeSentAtDesc(employee.getId())
                .forEach(item -> result.put(item.getNotice().getId(), dto(item.getNotice(), item.getReadAt() != null)));
        recipients.findAllByNoticeSenderIdOrderByNoticeSentAtDesc(employee.getId())
                .forEach(item -> result.putIfAbsent(item.getNotice().getId(), dto(item.getNotice(), true)));
        return result.values().stream().sorted(Comparator.comparing(NoticeDto::sentAt).reversed()).toList();
    }

    @Transactional
    public NoticeDto send(Employee sender, String title, String content, List<Long> recipientIds, MultipartFile file) {
        if (sender.getRole() == Employee.Role.USER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "공지사항 작성 권한이 없습니다.");
        }
        if (title == null || title.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "공지 제목을 입력해 주세요.");
        boolean hasText = content != null && !content.isBlank();
        boolean hasFile = file != null && !file.isEmpty();
        if (!hasText && !hasFile) throw new ApiException(HttpStatus.BAD_REQUEST, "공지 내용이나 파일을 입력해 주세요.");
        Set<Long> ids = new LinkedHashSet<>(recipientIds == null ? List.of() : recipientIds);
        ids.remove(sender.getId());
        List<Employee> targets = employees.findAllById(ids);
        if (targets.isEmpty() || targets.size() != ids.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "공지 수신자를 선택해 주세요.");
        }
        Notice notice = Notice.builder().sender(sender).title(title.trim()).content(hasText ? content.trim() : null)
                .sentAt(LocalDateTime.now()).build();
        if (hasFile) storeFile(notice, file);
        notices.save(notice);
        recipients.saveAll(targets.stream().map(target -> NoticeRecipient.builder()
                .notice(notice).recipient(target).build()).toList());
        NoticeDto dto = dto(notice, false);
        targets.forEach(target -> realtime.publish("/topic/notices/" + target.getId(), dto));
        return dto(notice, true);
    }

    @Transactional
    public void read(Employee employee, Long noticeId) {
        NoticeRecipient recipient = recipients.findByNoticeIdAndRecipientId(noticeId, employee.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "공지 수신자가 아닙니다."));
        if (recipient.getReadAt() == null) recipient.setReadAt(LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public Download download(Employee employee, Long noticeId) {
        Notice notice = notices.findById(noticeId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "공지를 찾을 수 없습니다."));
        boolean allowed = notice.getSender().getId().equals(employee.getId())
                || recipients.existsByNoticeIdAndRecipientId(noticeId, employee.getId());
        if (!allowed || notice.getStoredName() == null) throw new ApiException(HttpStatus.FORBIDDEN, "파일 접근 권한이 없습니다.");
        try {
            migrateLegacyFileIfNecessary(notice.getStoredName(), notice.getContentType());
            Resource resource = storage.get(notice.getStoredName());
            return new Download(resource, notice.getOriginalName(), notice.getContentType(), notice.getSizeBytes());
        } catch (Exception error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 불러오지 못했습니다.");
        }
    }

    private NoticeDto dto(Notice notice, boolean read) {
        FileDto file = notice.getStoredName() == null ? null : new FileDto(notice.getId(),
                notice.getOriginalName(), notice.getContentType(), notice.getSizeBytes(),
                "/api/notices/" + notice.getId() + "/file");
        Employee sender = notice.getSender();
        List<String> recipientNames = recipients.findAllByNoticeId(notice.getId()).stream()
                .map(item -> {
                    Employee recipient = item.getRecipient();
                    return recipient.getPosition() == null || recipient.getPosition().isBlank()
                            ? recipient.getName()
                            : recipient.getName() + " " + recipient.getPosition();
                }).toList();
        return new NoticeDto(notice.getId(), sender.getId(), sender.getName(), sender.getPosition(),
                sender.getDepartment() == null ? null : sender.getDepartment().getName(),
                notice.getTitle() == null ? "제목 없는 공지" : notice.getTitle(),
                notice.getContent(), recipientNames, notice.getSentAt(), read, file);
    }

    private void storeFile(Notice notice, MultipartFile file) {
        if (file.getSize() > maxSize) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "파일 크기 제한을 초과했습니다.");
        String original = Paths.get(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename()).getFileName().toString();
        String contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        String stored = objectKeys.create(original, contentType);
        try {
            storage.put(stored, file.getInputStream(), file.getSize(), contentType);
        } catch (Exception error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일 저장에 실패했습니다.");
        }
        notice.setOriginalName(original);
        notice.setStoredName(stored);
        notice.setContentType(contentType);
        notice.setSizeBytes(file.getSize());
    }

    private void migrateLegacyFileIfNecessary(String objectName, String contentType) {
        if (storage.exists(objectName)) return;
        Path root = Paths.get(legacyDirectory).toAbsolutePath().normalize();
        Path legacy = root.resolve(objectName).normalize();
        if (!legacy.startsWith(root) || !Files.isRegularFile(legacy)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다.");
        }
        try {
            storage.put(objectName, Files.newInputStream(legacy), Files.size(legacy), contentType);
        } catch (Exception error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "기존 파일을 MinIO로 이전하지 못했습니다.");
        }
    }

    public record Download(Resource resource, String originalName, String contentType, long sizeBytes) {}
}
