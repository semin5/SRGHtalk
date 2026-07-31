package sarangit.semin5.srghtalk.service;

public interface RealtimePublisher {
    void publish(String destination, Object payload);
}
