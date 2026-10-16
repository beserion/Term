[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$loginBody = @{
    email = "admin@bluehub.com"
    userName = "Admin"
    password = "BlueHub1!"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "1. Testing /terminal/Settings/Printers..."
try {
    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/terminal/Settings/Printers" -Method Get -Headers $headers
    Write-Host "   Printers SUCCESS:" ($res | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "   Printers FAILED: $_"
}

Write-Host "2. Testing /terminal/Inventory/Stocks vs /api/Inventory/stocks..."
try {
    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/terminal/Inventory/Stocks" -Method Get -Headers $headers
    Write-Host "   /terminal/Inventory/Stocks FAILED or SUCCESS?"
} catch {
    Write-Host "   /terminal/Inventory/Stocks FAILED: $_"
}
