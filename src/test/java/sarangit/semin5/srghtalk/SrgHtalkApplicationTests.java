package sarangit.semin5.srghtalk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:srghtalk-test;MODE=MySQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.defer-datasource-initialization=false",
        "app.redis.enabled=false",
        "app.demo-data.enabled=false",
        "app.schema-migration.enabled=false"
})
class SrgHtalkApplicationTests {

    @Test
    void contextLoads() {
    }

}
