$ErrorActionPreference = 'Stop'
$collector = Join-Path $PSScriptRoot 'collect-beta-metrics.ps1'
$planJson = & $collector -PlanOnly -Since '2026-10-10T12:00:00-04:00' -Until '2026-10-11T12:00:00-04:00' | Out-String
$plan = $planJson | ConvertFrom-Json
if (-not $planJson.Contains('"2026-10-10T16:00:00Z"') -or -not $planJson.Contains('"2026-10-11T16:00:00Z"')) {
    throw 'Collection windows must normalize to UTC.'
}
if ($plan.environmentId -ne 'b576f9f6-34f1-43b2-b06d-9919d6870caf' -or $plan.arguments -contains '--http') {
    throw 'Collector must stay beta-scoped and exclude HTTP request data.'
}
if ($plan.arguments -contains '--all' -or $plan.services.psobject.Properties.Name.Count -ne 4) {
    throw 'Raw captures require four separate service requests; --all conflicts with --raw.'
}
foreach ($range in @(
    @('2026-10-11T16:00:00Z', '2026-10-10T16:00:00Z'),
    @('2026-10-11T16:00:00Z', '2026-10-11T16:00:00Z'),
    @('2026-10-01T16:00:00Z', '2026-10-10T16:00:00Z'),
    @([DateTimeOffset]::UtcNow.ToString('o'), [DateTimeOffset]::UtcNow.AddDays(1).ToString('o'))
)) {
    $rejected = $false
    try { & $collector -PlanOnly -Since $range[0] -Until $range[1] | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Invalid collection window was accepted.' }
}
Write-Output 'Collector checks passed: UTC windows, beta scope, resource-only selection, invalid-window rejection.'
