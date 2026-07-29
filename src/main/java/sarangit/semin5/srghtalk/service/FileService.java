package sarangit.semin5.srghtalk.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {
    private final FileAttachmentRepository files;
    private final ChatMessageRepository messages;
    private final ChatService chat;
    private final DtoMapper mapper;

    @Value("${app.uploads.directory}")
    private String uploadDirectory;
    @Value("${app.uploads.max-size-bytes}")
    private long maxSize;

    @Transactional
    public MessageDto upload(Employee employee, Long roomId, MultipartFile file) {
        if (file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "빈 파일은 업로드할 수 없습니다.");
        if (file.getSize() > maxSize) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "파일 크기 제한을 초과했습니다.");
        String original = Paths.get(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename())
                .getFileName().toString();
        String stored = UUID.randomUUID() + extension(original);
        try {
            Path root = Paths.get(uploadDirectory).toAbsolutePath().normalize();
            Files.createDirectories(root);
            Path target = root.resolve(stored).normalize();
            if (!target.startsWith(root)) throw new ApiException(HttpStatus.BAD_REQUEST, "올바르지 않은 파일명입니다.");
            file.transferTo(target);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일 저장에 실패했습니다.");
        }
        ChatMessage.Type type = file.getContentType() != null && file.getContentType().startsWith("image/")
                ? ChatMessage.Type.IMAGE : ChatMessage.Type.FILE;
        MessageDto sent = chat.send(employee, roomId, original, type);
        ChatMessage message = messages.findById(sent.id()).orElseThrow();
        files.save(FileAttachment.builder().message(message).originalName(original).storedName(stored)
                .contentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
                .sizeBytes(file.getSize()).uploadedAt(LocalDateTime.now()).build());
        return mapper.message(message);
    }

    @Transactional(readOnly = true)
    public Download download(Employee employee, Long fileId) {
        FileAttachment file = files.findById(fileId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다."));
        chat.membership(file.getMessage().getRoom().getId(), employee.getId());
        try {
            Resource resource = new UrlResource(Paths.get(uploadDirectory).toAbsolutePath().normalize()
                    .resolve(file.getStoredName()).toUri());
            if (!resource.exists()) throw new ApiException(HttpStatus.NOT_FOUND, "저장된 파일이 없습니다.");
            return new Download(resource, file.getOriginalName(), file.getContentType());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 불러오지 못했습니다.");
        }
    }

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 && dot > name.length() - 10 ? name.substring(dot) : "";
    }

    public record Download(Resource resource, String originalName, String contentType) {}
}
