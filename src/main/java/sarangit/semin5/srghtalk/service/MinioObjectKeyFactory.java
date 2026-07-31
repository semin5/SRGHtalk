package sarangit.semin5.srghtalk.service;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
public class MinioObjectKeyFactory {
    private static final Set<String> IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif");
    private static final Set<String> VIDEO_EXTENSIONS =
            Set.of("mp4", "mov", "avi", "mkv", "webm", "wmv", "m4v", "mpeg", "mpg");
    private static final Set<String> SIGN_EXTENSIONS =
            Set.of("p7s", "p7m", "sig");

    public String create(String originalName, String contentType) {
        String extension = extension(originalName);
        return category(originalName, contentType, extension) + "/" + UUID.randomUUID()
                + (extension.isEmpty() ? "" : "." + extension);
    }

    private String category(String originalName, String contentType, String extension) {
        String name = originalName == null ? "" : originalName.toLowerCase(Locale.ROOT);
        String mime = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);

        if (name.contains("서명") || name.contains("사인") || name.contains("signature")
                || name.contains("_sign") || SIGN_EXTENSIONS.contains(extension)
                || mime.contains("pkcs7-signature")) {
            return "signs";
        }
        if (mime.startsWith("image/") || IMAGE_EXTENSIONS.contains(extension)) return "images";
        if (mime.startsWith("video/") || VIDEO_EXTENSIONS.contains(extension)) return "videos";
        return "files";
    }

    private String extension(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        String extension = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        return extension.length() <= 10 && extension.matches("[a-z0-9]+") ? extension : "";
    }
}
