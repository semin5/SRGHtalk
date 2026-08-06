package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import sarangit.semin5.srghtalk.api.ApiDtos.MessageDto;
import sarangit.semin5.srghtalk.service.AuthService;
import sarangit.semin5.srghtalk.service.FileService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FileController {
    private final AuthService auth;
    private final FileService files;

    @PostMapping(value = "/rooms/{roomId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MessageDto upload(HttpServletRequest request, @PathVariable Long roomId,
                             @RequestPart("file") MultipartFile file,
                             @RequestPart(value = "batchId", required = false) String batchId) {
        return files.upload(auth.authenticate(request), roomId, file, batchId);
    }

    @GetMapping("/files/{fileId}")
    public ResponseEntity<?> download(HttpServletRequest request, @PathVariable Long fileId) {
        var file = files.download(auth.authenticate(request), fileId);
        String encoded = URLEncoder.encode(file.originalName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(file.resource());
    }
}
