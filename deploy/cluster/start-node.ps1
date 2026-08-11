param(
    [Parameter(Mandatory = $true)] [string] $JarPath,
    [Parameter(Mandatory = $true)] [string] $EnvironmentFile
)

$ErrorActionPreference = "Stop"
$resolvedJar = (Resolve-Path -LiteralPath $JarPath).Path
$resolvedEnvironment = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$clusterConfig = Join-Path $PSScriptRoot "application-cluster.yaml"

Get-Content -LiteralPath $resolvedEnvironment -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (!$line -or $line.StartsWith("#")) { return }
    $separator = $line.IndexOf("=")
    if ($separator -lt 1) { throw "잘못된 환경설정 줄: $line" }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

Write-Host "SRGHtalk node starting: $resolvedJar"
Write-Host "Port: $env:SERVER_PORT / DB: 192.168.205.119 / Redis: $env:REDIS_HOST / MinIO: $env:MINIO_ENDPOINT"
& java -Xms512m -Xmx2g -XX:+UseG1GC -jar $resolvedJar "--spring.config.additional-location=file:$clusterConfig"
exit $LASTEXITCODE
