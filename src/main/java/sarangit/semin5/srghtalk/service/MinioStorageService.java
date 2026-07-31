package sarangit.semin5.srghtalk.service;

import io.minio.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
@RequiredArgsConstructor
public class MinioStorageService {
    private final MinioClient minio;

    @Value("${app.storage.minio.bucket}")
    private String bucket;

    @PostConstruct
    void initializeBucket() {
        try {
            boolean exists = minio.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        } catch (Exception exception) {
            throw new IllegalStateException("MinIO 버킷을 준비하지 못했습니다: " + bucket, exception);
        }
    }

    public void put(String objectName, InputStream stream, long size, String contentType) {
        try {
            minio.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                        .stream(stream, size, -1L)
                    .contentType(contentType)
                    .build());
        } catch (Exception exception) {
            throw new IllegalStateException("MinIO 파일 저장에 실패했습니다.", exception);
        }
    }

    public Resource get(String objectName) {
        try {
            return new InputStreamResource(minio.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .build()));
        } catch (Exception exception) {
            throw new IllegalStateException("MinIO 파일을 불러오지 못했습니다.", exception);
        }
    }

    public boolean exists(String objectName) {
        try {
            minio.statObject(StatObjectArgs.builder().bucket(bucket).object(objectName).build());
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    public void remove(String objectName) {
        try {
            minio.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectName).build());
        } catch (Exception ignored) {
            // A failed cleanup must not hide the original upload/database error.
        }
    }
}
