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
        }
    }
}
