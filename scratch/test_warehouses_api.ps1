[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

Write-Host "1. Logging in to api.blackskyqore.com..."
$loginBody = @{
    email = "admin@bluehub.com"
    userName = "Admin"
    password = "BlueHub1!"
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.token
    Write-Host "   Login SUCCESS! Token: $($token.Substring(0, 25))..."

    Write-Host "`n2. Calling GET /api/terminal/Inventory/Warehouses..."
    $headers = @{ Authorization = "Bearer $token" }
    $whRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/terminal/Inventory/Warehouses" -Method Get -Headers $headers
    Write-Host "   Warehouses Response:"
    $whRes | ConvertTo-Json -Depth 5 | Write-Host

    Write-Host "`n3. Calling GET /api/terminal/Settings/Printers..."
    $prnRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/terminal/Settings/Printers" -Method Get -Headers $headers
    Write-Host "   Printers Response:"
    $prnRes | ConvertTo-Json -Depth 5 | Write-Host

} catch {
    Write-Host "   Error: $_"
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "   Response Body: $($sr.ReadToEnd())"
    }
}
