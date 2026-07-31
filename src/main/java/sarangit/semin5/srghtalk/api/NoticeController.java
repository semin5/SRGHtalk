package sarangit.semin5.srghtalk.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import sarangit.semin5.srghtalk.api.ApiDtos.NoticeDto;
import sarangit.semin5.srghtalk.service.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {
    private final AuthService auth;
    private final NoticeService notices;

    @GetMapping
    public List<NoticeDto> list(HttpServletRequest request) {
        return notices.list(auth.authenticate(request));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public NoticeDto send(HttpServletRequest request,
                          @RequestParam String title,
                          @RequestParam(required = false) String content,
                          @RequestParam List<Long> recipientIds,
                          @RequestPart(required = false) MultipartFile file) {
        return notices.send(auth.authenticate(request), title, content, recipientIds, file);
    }

    @PostMapping("/{noticeId}/read")
    public void read(HttpServletRequest request, @PathVariable Long noticeId) {
        notices.read(auth.authenticate(request), noticeId);
    }

    @GetMapping("/{noticeId}/file")
    public ResponseEntity<Resource> file(HttpServletRequest request, @PathVariable Long noticeId) {
        NoticeService.Download download = notices.download(auth.authenticate(request), noticeId);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.originalName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(download.contentType())).contentLength(download.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString()).body(download.resource());
    }
}
