package sarangit.semin5.srghtalk.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String[] origins;

    public WebConfig(@Value("${app.cors.allowed-origin-patterns:*}") String origins) {
        this.origins = origins.split(",");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition")
                .allowCredentials(false);
    }
}
