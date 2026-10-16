$json = Get-Content "scratch/blackskyqore_swagger.json" -Raw | ConvertFrom-Json
Write-Host "=== ENDPOINTS ==="
$json.paths.PSObject.Properties | ForEach-Object {
    Write-Host $_.Name
}
