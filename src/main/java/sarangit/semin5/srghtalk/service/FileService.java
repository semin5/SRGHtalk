package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import sarangit.semin5.srghtalk.api.ApiDtos.MessageDto;
import sarangit.semin5.srghtalk.api.ApiException;
import sarangit.semin5.srghtalk.domain.*;
import sarangit.semin5.srghtalk.repository.*;

import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {
    private final FileAttachmentRepository files;
    private final ChatMessageRepository messages;
    private final ChatService chat;
    private final DtoMapper mapper;
    private final MinioStorageService storage;
    private final MinioObjectKeyFactory objectKeys;

    @Value("${app.storage.legacy-directory:uploads}")
    private String legacyDirectory;
    @Value("${app.storage.max-size-bytes}")
    private long maxSize;

    @Transactional
    public MessageDto upload(Employee employee, Long roomId, MultipartFile file) {
        if (file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "빈 파일은 업로드할 수 없습니다.");
        if (file.getSize() > maxSize) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "파일 크기 제한을 초과했습니다.");
        String original = Paths.get(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename())
                .getFileName().toString();
        String contentType = resolveContentType(original, file.getContentType());
        String stored = objectKeys.create(original, contentType);
        try {
            storage.put(stored, file.getInputStream(), file.getSize(), contentType);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "파일 저장소에 연결할 수 없습니다.");
        }
        ChatMessage.Type type = contentType.startsWith("image/")
                ? ChatMessage.Type.IMAGE : ChatMessage.Type.FILE;
        MessageDto sent = chat.send(employee, roomId, original, type, false);
        ChatMessage message = messages.findById(sent.id()).orElseThrow();
        try {
            files.saveAndFlush(FileAttachment.builder().message(message).originalName(original).storedName(stored)
                    .contentType(contentType).sizeBytes(file.getSize()).uploadedAt(LocalDateTime.now()).build());
            MessageDto completed = mapper.message(message);
            chat.publishMessage(roomId, completed);
            return completed;
        } catch (RuntimeException exception) {
            storage.remove(stored);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public Download download(Employee employee, Long fileId) {
        FileAttachment file = files.findById(fileId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다."));
        chat.membership(file.getMessage().getRoom().getId(), employee.getId());
        try {
            migrateLegacyFileIfNecessary(file);
            return new Download(storage.get(file.getStoredName()), file.getOriginalName(), file.getContentType(),
                    file.getSizeBytes());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 불러오지 못했습니다.");
        }
    }

    private void migrateLegacyFileIfNecessary(FileAttachment file) throws Exception {
        if (storage.exists(file.getStoredName())) return;
        Path root = Paths.get(legacyDirectory).toAbsolutePath().normalize();
        Path legacyFile = root.resolve(file.getStoredName()).normalize();
        if (!legacyFile.startsWith(root) || !Files.isRegularFile(legacyFile)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "저장된 파일이 없습니다.");
        }
        try (var stream = Files.newInputStream(legacyFile)) {
            storage.put(file.getStoredName(), stream, Files.size(legacyFile), file.getContentType());
        }
    }

    private String resolveContentType(String originalName, String suppliedType) {
        String extension = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0 && dot < originalName.length() - 1) {
            extension = originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
        }
        String detected = switch (extension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "bmp" -> "image/bmp";
            case "svg" -> "image/svg+xml";
            case "heic" -> "image/heic";
            case "heif" -> "image/heif";
            case "mp4", "m4v" -> "video/mp4";
            case "mov" -> "video/quicktime";
            case "avi" -> "video/x-msvideo";
            case "mkv" -> "video/x-matroska";
            case "webm" -> "video/webm";
            case "wmv" -> "video/x-ms-wmv";
            case "flv" -> "video/x-flv";
            case "mpg", "mpeg" -> "video/mpeg";
            case "3gp" -> "video/3gpp";
            case "3g2" -> "video/3gpp2";
            case "ts", "mts", "m2ts" -> "video/mp2t";
            case "ogv" -> "video/ogg";
            default -> null;
        };
        if (detected != null) return detected;
        return suppliedType == null || suppliedType.isBlank() ? "application/octet-stream" : suppliedType;
    }

    public record Download(Resource resource, String originalName, String contentType, long sizeBytes) {}
}
