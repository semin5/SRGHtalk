package sarangit.semin5.srghtalk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:srghtalk-test;MODE=MySQL")
class SrgHtalkApplicationTests {

    @Test
    void contextLoads() {
    }

}
