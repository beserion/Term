[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$loginBody = @{
    email = "admin@bluehub.com"
    userName = "Admin"
    password = "BlueHub1!"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "1. Testing GET https://api.blackskyqore.com/api/Inventory/warehouses..."
try {
    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Inventory/warehouses" -Method Get -Headers $headers
    Write-Host "   SUCCESS Count:" ($res.data | Measure-Object).Count
} catch {
    Write-Host "   ERROR:" $_.Exception.Message
}

Write-Host "2. Testing GET https://api.blackskyqore.com/Inventory/warehouses (Without /api in path)..."
try {
    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/Inventory/warehouses" -Method Get -Headers $headers
    Write-Host "   SUCCESS"
} catch {
    Write-Host "   ERROR:" $_.Exception.Message
}
