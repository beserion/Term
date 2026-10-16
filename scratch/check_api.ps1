[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

function Test-Login ($user, $pass) {
    Write-Host "=== Testing Login with User: '$user' Pass: '$pass' ==="
    try {
        $body = @{ userName = $user; password = $pass } | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "https://arkship.posnetx.com/api/Auth/login" -Method Post -Body $body -ContentType "application/json"
        Write-Host "SUCCESS! Token Received:"
        Write-Host "Token: $($res.token.Substring(0, 30))..."
        return $res.token
    } catch {
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "FAILED ($($_.Exception.Response.StatusCode)): $($reader.ReadToEnd())"
        } else {
            Write-Host "ERROR: $_"
        }
        return $null
    }
}

$token = Test-Login "demo" "password123"
if (-not $token) { $token = Test-Login "admin" "admin" }
if (-not $token) { $token = Test-Login "admin" "123456" }
if (-not $token) { $token = Test-Login "test" "test" }

if ($token) {
    Write-Host "`n=== Testing Warehouses with Token ==="
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $warehouses = Invoke-RestMethod -Uri "https://arkship.posnetx.com/api/terminal/Inventory/Warehouses" -Method Get -Headers $headers
        Write-Host "Warehouses Result:"
        $warehouses | ConvertTo-Json -Depth 3 | Write-Host
    } catch {
        Write-Host "Warehouses Error: $_"
    }
}
