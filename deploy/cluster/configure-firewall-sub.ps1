# 관리자 PowerShell에서 서브 서버(192.168.1.77, 192.168.1.78)에 각각 실행합니다.
$ErrorActionPreference = "Stop"
New-NetFirewallRule -DisplayName "SRGHtalk Sub Node 3022 from main" -Direction Inbound -Protocol TCP -LocalPort 3022 -RemoteAddress 192.168.205.119 -Action Allow -Profile Any -ErrorAction SilentlyContinue
