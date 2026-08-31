[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
try {
    Write-Host "Testing https://arkship.posnetx.com/api/terminal/Packing/BoardData/389..."
    $res = Invoke-RestMethod -Uri "https://arkship.posnetx.com/api/terminal/Packing/BoardData/389" -Method Get
    Write-Host "Status: SUCCESS"
    $res | ConvertTo-Json -Depth 5 | Out-File -FilePath "$PSScriptRoot/api_out.json" -Encoding utf8
    Write-Host "Saved output to api_out.json"
} catch {
    Write-Host "ERROR: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response Body: " $reader.ReadToEnd()
    }
}
