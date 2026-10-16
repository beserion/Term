[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$loginBody = @{
    email = "admin@bluehub.com"
    userName = "Admin"
    password = "BlueHub1!"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "1. Testing GET /api/Inventory/warehouses..."
try {
    $res1 = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Inventory/warehouses" -Method Get -Headers $headers
    Write-Host "   SUCCESS /api/Inventory/warehouses:"
    $res1 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "   FAILED /api/Inventory/warehouses: $_"
}

Write-Host "`n2. Testing GET /api/Inventory/stocks..."
try {
    $res2 = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Inventory/stocks" -Method Get -Headers $headers
    Write-Host "   SUCCESS /api/Inventory/stocks count:" ($res2 | Measure-Object).Count
} catch {
    Write-Host "   FAILED /api/Inventory/stocks: $_"
}
