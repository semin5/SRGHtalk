# SRGHtalk 3대 애플리케이션 서버 실행 구성

## 고정 주소

- Nginx: `192.168.1.77:3021`
- 본 서버 Spring Boot: `192.168.205.119:3022`
- 서브 서버 1 Spring Boot: `192.168.1.77:3022`
- 서브 서버 2 Spring Boot: `192.168.1.78:3022`
- 사랑톡 전용 MySQL: `192.168.1.77:3308` (`srghtalk`)
- Redis: `192.168.1.77:6379`
- MinIO API/관리화면: `192.168.1.77:9000`, `192.168.1.77:9001`
- Grafana: `192.168.1.77:3000`
- Prometheus: `192.168.1.77:9090`
- 사용자명과 비밀번호는 각 서버의 추적되지 않는 `.env` 파일에서 설정합니다.
- 실제 운영 비밀번호를 README나 Compose 파일에 직접 기록하지 마세요.

## Ubuntu 인프라 서버

Redis, MinIO, Nginx, Prometheus, Grafana는 `192.168.1.77`의 `/opt/srghtalk/cluster`에서 Docker Compose로 실행합니다.

```bash
cd /opt/srghtalk/cluster
sudo docker compose --env-file .env -f docker-compose.cluster.yml up -d
```

`1.77`의 Spring Boot는 `srghtalk.service`로 등록되어 있으며 재부팅 후 자동 실행됩니다.

```bash
sudo systemctl status srghtalk
sudo systemctl restart srghtalk
```

Windows 본 서버에서 IntelliJ로 Spring Boot를 실행할 때도 MySQL·Redis·MinIO는 모두 `1.77`의 사랑톡 전용 인프라를 사용합니다.

## IntelliJ에서 공용 JAR 만들기

IntelliJ 오른쪽의 Maven 창에서 `Lifecycle` → `clean` → `package`를 실행합니다. 또는 IntelliJ 터미널에서 다음 명령을 실행합니다.

```powershell
.\mvnw.cmd clean package -DskipTests
```

결과 파일은 항상 프로젝트의 `target\SRGHtalk.jar`로 생성됩니다. 이 파일 하나를 본 서버와 서브 서버에서 동일하게 사용할 수 있습니다.

```powershell
java -jar SRGHtalk.jar
```

세 컴퓨터는 IP가 서로 다르므로 모두 로컬 포트 `3022`를 사용해도 충돌하지 않습니다. JAR 내부 기본 설정으로 본 서버 `192.168.205.119`의 MySQL, Redis, MinIO에 연결됩니다.

## 서브 서버

각 서버용으로 준비된 `deploy\sub-server-77\SRGHtalk.jar`, `deploy\sub-server-78\SRGHtalk.jar`를 해당 서브 컴퓨터로 복사하고 실행합니다.

```powershell
java -jar SRGHtalk.jar
```

별도 YAML, `.env`, 실행 스크립트가 필요하지 않습니다. JDK 21은 설치되어 있어야 합니다.

## 확인

```powershell
docker ps
curl.exe http://192.168.1.77:3021/ws/info
curl.exe http://192.168.205.119:3022/ws/info
curl.exe http://192.168.1.77:3022/ws/info
curl.exe http://192.168.1.78:3022/ws/info
```

클라이언트와 Electron은 `http://192.168.1.77:3021`에 접속합니다. Nginx가 세 Spring Boot 서버로 분산하고 Redis가 로그인 세션, 접속 상태, 실시간 WebSocket 이벤트를 공유합니다.

## 모니터링

Grafana는 `http://192.168.1.77:3000`에서 공통 관리자 계정으로 로그인합니다. `사랑톡` 폴더의 `사랑톡 서버 모니터링` 대시보드가 자동 생성됩니다. Prometheus는 세 서버의 `/actuator/prometheus`를 15초마다 수집하고 30일 보관합니다.

Actuator가 포함된 새 JAR로 본 서버와 서브 서버를 모두 재시작해야 메트릭 대상이 `UP`으로 표시됩니다. Nginx를 통한 외부 `/actuator/*` 접근은 차단되어 있고 Prometheus만 각 노드에 직접 접근합니다.
