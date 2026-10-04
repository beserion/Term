[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

Write-Host "1. Testing DNS resolution for api.blackskyqore.com..."
try {
    $dns = [System.Net.Dns]::GetHostAddresses("api.blackskyqore.com")
    foreach ($ip in $dns) {
        Write-Host "   IP: $($ip.IPAddressToString)"
    }
} catch {
    Write-Host "   DNS Error: $_"
}

Write-Host "`n2. Testing HTTP/HTTPS Endpoint Reachability..."
$endpoints = @(
    "https://api.blackskyqore.com/",
    "https://api.blackskyqore.com/swagger/index.html",
    "https://api.blackskyqore.com/swagger/v1/swagger.json"
)

foreach ($ep in $endpoints) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($ep)
        $req.Method = "GET"
        $req.Timeout = 5000
        $req.AllowAutoRedirect = $true
        $resp = $req.GetResponse()
        $status = [int]$resp.StatusCode
        Write-Host "   GET $ep -> Status: $status ($($resp.StatusCode))"
        $resp.Close()
    } catch [System.Net.WebException] {
        if ($_.Response) {
            $status = [int]$_.Response.StatusCode
            Write-Host "   GET $ep -> Status: $status ($($_.Response.StatusCode))"
        } else {
            Write-Host "   GET $ep -> Exception: $($_.Message)"
        }
    } catch {
        Write-Host "   GET $ep -> Error: $_"
    }
}

Write-Host "`n3. Testing Auth Login Endpoint (https://api.blackskyqore.com/api/Auth/login)..."
try {
    $body = @{
        userName = "Admin"
        password = "BlueHub1!"
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "https://api.blackskyqore.com/api/Auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "   Login SUCCESS!"
    Write-Host "   Response: $($res | ConvertTo-Json -Compress)"
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd()
        Write-Host "   Login FAILED with status code: $($_.Exception.Response.StatusCode)"
        Write-Host "   Response Body: $respBody"
    } else {
        Write-Host "   Login Error: $($_.Exception.Message)"
    }
}
