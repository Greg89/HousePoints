[CmdletBinding()]
param(
    [DateTimeOffset]$Until = [DateTimeOffset]::UtcNow,
    [DateTimeOffset]$Since = $Until.AddDays(-1),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../artifacts/railway-beta'),
    [switch]$PlanOnly
)

$ErrorActionPreference = 'Stop'
$projectId = '64b4f475-ad33-4f3f-addd-de527f9195bf'
$environmentId = 'b576f9f6-34f1-43b2-b06d-9919d6870caf'
$cliPackage = '@railway/cli@5.64.2'
$services = [ordered]@{
    api = '1f322401-6be5-4afa-9376-82cb1361200b'
    web = '016c5660-f6f5-4e8a-b2b4-80f5f7c8d132'
    postgres = '936bc704-5aa8-43ba-af9b-b607b24ca5f1'
    seq = '3820bbc8-d9d2-4d37-9754-bb08301b2e9f'
}

if ($Since -ge $Until) { throw 'Since must be earlier than Until.' }
if ($Until -gt [DateTimeOffset]::UtcNow.AddMinutes(1)) { throw 'Until cannot be in the future.' }
if (($Until - $Since).TotalDays -gt 7) { throw 'Collect at most seven days per snapshot.' }

$start = $Since.UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ssZ')
$end = $Until.UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ssZ')
$arguments = @(
    'exec', '--yes', "--package=$cliPackage", '--', 'railway', 'metrics',
    '--project', $projectId, '--environment', $environmentId,
    '--since', $start, '--until', $end,
    '--cpu', '--memory', '--network', '--volume', '--raw', '--json'
)

if ($PlanOnly) {
    [ordered]@{ projectId = $projectId; environmentId = $environmentId; since = $start; until = $end; services = $services; arguments = $arguments } |
        ConvertTo-Json -Depth 5
    return
}

# Only resource metrics: no logs, request paths, variables, or database contents.
$npmCommand = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
$metrics = [ordered]@{}
foreach ($service in $services.GetEnumerator()) {
    $serviceArguments = $arguments + @('--service', $service.Value)
    $raw = (& $npmCommand @serviceArguments | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "Railway metrics failed for $($service.Key); no snapshot saved. Check CLI authentication and access." }
    if ([string]::IsNullOrWhiteSpace($raw)) { throw 'Railway returned no JSON; no snapshot saved.' }
    $data = $raw | ConvertFrom-Json
    if ($null -eq $data) { throw 'Railway returned null; no snapshot saved.' }
    if ($data.environment -ne 'beta' -or $null -eq $data.measurements) {
        throw 'Railway response has unexpected environment or metric shape; no snapshot saved.'
    }
    $metrics[$service.Key] = [ordered]@{ serviceId = $service.Value; data = $data }
}

$snapshot = [ordered]@{
    schemaVersion = 1
    collectedAt = [DateTimeOffset]::UtcNow.ToString('o')
    projectId = $projectId
    environmentId = $environmentId
    environmentName = 'beta'
    cliPackage = $cliPackage
    since = $start
    until = $end
    workload = 'Ambient staging traffic; not a controlled member-capacity scenario'
    metrics = $metrics
}
$directory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$name = 'beta-{0}-{1}.json' -f $Since.UtcDateTime.ToString('yyyyMMddTHHmmssZ'), $Until.UtcDateTime.ToString('yyyyMMddTHHmmssZ')
$path = Join-Path $directory $name
# CreateNew preserves earlier evidence if the same window is collected twice.
$stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($snapshot | ConvertTo-Json -Depth 100))
    $stream.Write($bytes, 0, $bytes.Length)
} finally { $stream.Dispose() }
Write-Output "Saved beta resource snapshot: $path"
