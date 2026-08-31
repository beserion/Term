[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

function TestUrl($url) {
    try {
        Write-Host "Testing $url ..."
        $res = Invoke-RestMethod -Uri $url -Method Get
        Write-Host "SUCCESS! Response:"
        $res | ConvertTo-Json -Depth 5
        return $res
    } catch {
        Write-Host "FAILED: $_"
        return $null
    }
}

TestUrl "https://localhost:44301/api/terminal/Packing/ActiveOrders"
TestUrl "https://localhost:44301/AppApi/api/terminal/Packing/ActiveOrders"
