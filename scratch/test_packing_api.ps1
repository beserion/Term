[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
try {
    Write-Host "Fetching ActiveOrders..."
    $resp = Invoke-RestMethod -Uri 'https://localhost:44301/AppApi/api/terminal/Packing/ActiveOrders'
    Write-Host "=== ACTIVE ORDERS RESPONSE ==="
    $resp | ConvertTo-Json -Depth 6

    $orderList = $resp
    if ($resp.data) { $orderList = $resp.data }

    if ($orderList.Count -gt 0) {
        $item = $orderList[0]
        $id = $item.id
        if (-not $id) { $id = $item.requestId }
        if (-not $id) { $id = $item.Id }

        Write-Host "`nFetching BoardData for ID: $id ..."
        $boardResp = Invoke-RestMethod -Uri "https://localhost:44301/AppApi/api/terminal/Packing/BoardData/$id"
        Write-Host "=== BOARD DATA RESPONSE ==="
        $boardResp | ConvertTo-Json -Depth 8
    }
} catch {
    Write-Host "Error: $_"
}
