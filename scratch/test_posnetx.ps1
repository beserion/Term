[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
try {
    Write-Host "Calling https://arkship.posnetx.com/api/terminal/Packing/ActiveOrders ..."
    $res = Invoke-RestMethod -Uri 'https://arkship.posnetx.com/api/terminal/Packing/ActiveOrders'
    Write-Host "ACTIVE ORDERS:"
    Write-Host ($res | ConvertTo-Json -Depth 6)

    Write-Host "`nCalling https://arkship.posnetx.com/api/terminal/Packing/BoardData/1 ..."
    $board = Invoke-RestMethod -Uri 'https://arkship.posnetx.com/api/terminal/Packing/BoardData/1'
    Write-Host "BOARD DATA FOR 1:"
    Write-Host ($board | ConvertTo-Json -Depth 6)
} catch {
    Write-Host "Error: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Body: "$reader.ReadToEnd()
    }
}
