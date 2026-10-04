[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$loginBody = @{
    email = "admin@bluehub.com"
    userName = "Admin"
    password = "BlueHub1!"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.token
$headers = @{ Authorization = "Bearer $token" }

$printBody = @{
    printerId = 1
    barcode = "TEST1234"
    qrCode = "TEST1234"
    quantity = 1
} | ConvertTo-Json

Write-Host "Testing PrintLabel API..."
try {
    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/terminal/Settings/PrintLabel" -Method Post -Body $printBody -Headers $headers -ContentType "application/json"
    Write-Host "PrintLabel SUCCESS:" ($res | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "PrintLabel FAILED: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response Body:" $reader.ReadToEnd()
    }
}
