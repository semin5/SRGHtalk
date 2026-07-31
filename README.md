# 사랑톡 (SRGH Talk)

사랑의병원 직원용 실시간 업무 메신저입니다. React 웹 클라이언트로 UX를 먼저 검증하고,
동일한 프런트엔드를 Electron으로 패키징할 수 있도록 프런트와 서버를 분리했습니다.

## 구현 기능

- 사번/비밀번호 로그인, 만료 가능한 Bearer 토큰, 로그아웃
- 직원·부서 검색 및 온라인 상태 표시
- 1:1/그룹/공지 대화방 모델과 대화방 생성
- REST 이력 조회 + STOMP/SockJS 실시간 메시지 수신
- Redis Pub/Sub 기반 다중 서버 실시간 이벤트, Redis 로그인 세션 캐시, TTL 접속 상태
- MySQL/JPA 메시지 영구 저장 및 읽음 위치/미확인 인원
- 최대 50MB 파일·이미지 업로드와 권한 확인 다운로드
- 관리자 통계, 직원 계정/권한/상태 및 부서 관리 API
- 데모용 H2 파일 DB와 운영용 MySQL 환경설정

## 로컬 실행

### 서버

```powershell
docker compose -f docker-compose.redis.yml up -d
.\mvnw.cmd spring-boot:run
```

Maven wrapper가 로컬 환경에서 동작하지 않으면 설치된 Maven으로 `mvn spring-boot:run`을 실행합니다.
개발 환경 기본 주소는 `http://localhost:3021`입니다. 배포용 Electron 0.3.0부터는 병원 내부망 서버
`http://192.168.205.119:3021`에 접속합니다.

### 웹 클라이언트

```powershell
cd frontend
npm install
npm run dev
```

기본 주소는 `http://localhost:5173`입니다.

데모 관리자 계정:

- 사번: `1001`
- 비밀번호: `1234`

## MySQL 연결

`.env.example`을 `.env`로 복사한 후 `SPRING_PROFILES_ACTIVE=mysql`, `DB_URL`,
`DB_USERNAME`, `DB_PASSWORD`를 설정합니다. IntelliJ 실행 구성에서는 Active profiles에
`mysql`을 지정해도 됩니다. `mysql` 프로필 없이 실행하면 로컬 H2 DB가 사용됩니다.
운영 환경에서는 `ddl-auto`를 migration 기반으로 전환하고 초기 데모 데이터 로더를 비활성화하는 것을 권장합니다.

## Redis 연결

Redis는 기본적으로 `localhost:6379`를 사용합니다. 로컬에서는 아래 명령으로 영속화가 활성화된
Redis 7을 실행합니다.

```powershell
docker compose -f docker-compose.redis.yml up -d
docker exec srghtalk-redis redis-cli ping
```

운영 서버에서는 `.env`의 `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`를 지정합니다. Redis는
로그인 세션 조회, 90초 TTL 기반 접속 상태, 여러 Spring Boot 서버 사이의 채팅·읽음·접속 이벤트
전파를 담당합니다. 클라이언트는 45초마다 접속 상태를 갱신하므로 비정상 종료된 사용자는 자동으로
오프라인 처리됩니다. Redis 없이 테스트할 때만 `REDIS_ENABLED=false`를 사용합니다.

## 실시간 통신

- SockJS endpoint: `/ws`
- 클라이언트 발행: `/app/chat.send`
- 방별 메시지: `/topic/rooms/{roomId}`
- 읽음 이벤트: `/topic/rooms/{roomId}/read`
- 접속 상태: `/topic/presence`

## Electron 전환

Windows 설치 EXE와 포터블 EXE를 만들 수 있습니다.

```powershell
cd frontend
npm run electron:build
```

결과물은 `frontend/release-network-0.3.0`에 생성됩니다.

다른 PC에서 접속하려면 서버 PC에서 백엔드를 실행하고, 관리자 권한 PowerShell로
`setup-server-firewall.ps1`을 한 번 실행해 TCP 3021 포트를 허용합니다.

서버 주소가 변경되면 실행 파일과 같은 폴더에 `srghtalk-server.json`을 만들 수 있습니다.

```json
{
  "serverUrl": "http://새로운-서버-IP:3021"
}
```
중앙 운영 서버를 사용할 때는 실행 전에 `SRGHTALK_SERVER_URL` 환경변수를 지정합니다.

```powershell
$env:SRGHTALK_SERVER_URL = "https://messenger.saranghospital.kr"
.\사랑톡.exe
```
