# 사랑톡 서버 PC에서 PowerShell을 관리자 권한으로 열고 이 파일을 실행하세요.
$ruleName = "사랑톡 서버 3021"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Enable-NetFirewallRule -DisplayName $ruleName
    Write-Host "기존 사랑톡 방화벽 규칙을 활성화했습니다."
} else {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Description "병원 내부망 사랑톡 REST API 및 WebSocket 접속 허용" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 3021 `
        -Profile Domain,Private
    Write-Host "사랑톡 TCP 3021 인바운드 규칙을 추가했습니다."
}

Write-Host "서버 주소: http://192.168.205.119:3021"
