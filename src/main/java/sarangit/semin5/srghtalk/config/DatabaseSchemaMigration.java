package sarangit.semin5.srghtalk.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@RequiredArgsConstructor
public class DatabaseSchemaMigration implements ApplicationRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String database;
        try (var connection = dataSource.getConnection()) {
            database = connection.getMetaData().getDatabaseProductName();
        }
        if (database.toLowerCase().contains("mysql")) {
            jdbc.execute("ALTER TABLE employee MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'USER'");
            Integer batchColumn = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns " +
                    "WHERE table_schema = DATABASE() AND table_name = 'file_attachment' AND column_name = 'batch_id'", Integer.class);
            if (batchColumn != null && batchColumn == 0) {
                jdbc.execute("ALTER TABLE file_attachment ADD COLUMN batch_id VARCHAR(64) NULL");
            }
            Integer clearedColumn = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns " +
                    "WHERE table_schema = DATABASE() AND table_name = 'room_member' AND column_name = 'cleared_message_id'", Integer.class);
            if (clearedColumn != null && clearedColumn == 0) {
                jdbc.execute("ALTER TABLE room_member ADD COLUMN cleared_message_id BIGINT NULL");
            }
        }
    }
}
