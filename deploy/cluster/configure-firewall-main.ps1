# 관리자 PowerShell에서 본 서버(192.168.205.119)에 실행합니다.
$ErrorActionPreference = "Stop"
New-NetFirewallRule -DisplayName "SRGHtalk Nginx 3021" -Direction Inbound -Protocol TCP -LocalPort 3021 -Action Allow -Profile Private -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk Node 3022 from LAN" -Direction Inbound -Protocol TCP -LocalPort 3022 -RemoteAddress 192.168.205.0/24 -Action Allow -Profile Private -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk MySQL from app nodes" -Direction Inbound -Protocol TCP -LocalPort 3306 -RemoteAddress 192.168.1.77,192.168.1.78 -Action Allow -Profile Any -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk Redis from app nodes" -Direction Inbound -Protocol TCP -LocalPort 6379 -RemoteAddress 192.168.1.77,192.168.1.78 -Action Allow -Profile Any -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk MinIO from app nodes" -Direction Inbound -Protocol TCP -LocalPort 9000 -RemoteAddress 192.168.1.77,192.168.1.78 -Action Allow -Profile Any -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk Grafana 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SRGHtalk Prometheus 9090" -Direction Inbound -Protocol TCP -LocalPort 9090 -Action Allow -Profile Private -ErrorAction SilentlyContinue
