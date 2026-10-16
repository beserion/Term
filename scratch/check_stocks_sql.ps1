$connStr = "Server=149.34.201.53; Database=GEMINI; User ID=sa; Password=Oryx123!; TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, StockCode, StockName, ShelfAddress, BoxNo, Remarks FROM INV_Stocks WHERE StockCode IN ('000138', '000158', 'STK-000138', 'STK-001030', 'STK-000657')"
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    $id = $reader["Id"]
    $code = $reader["StockCode"]
    $name = $reader["StockName"]
    $shelf = $reader["ShelfAddress"]
    $box = $reader["BoxNo"]
    Write-Host "Id: $id | Code: $code | Name: $name | Shelf: '$shelf' | Box: '$box'"
}
$reader.Close()

Write-Host "`n--- Check RFQ-2026-0166 details ---"
$cmd.CommandText = @"
SELECT od.Id, od.StockCode, od.StockName, od.StockId, s.ShelfAddress, s.StockCode as S_StockCode
FROM REQ_OrderDetails od
LEFT JOIN INV_Stocks s ON od.StockId = s.Id
WHERE od.OrderId IN (SELECT Id FROM REQ_Orders WHERE RfqNo LIKE '%2026-0166%')
"@
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    Write-Host "OD Id: $($reader['Id']) | Code: $($reader['StockCode']) | StockId: $($reader['StockId']) | Shelf: '$($reader['ShelfAddress'])' | S_Code: '$($reader['S_StockCode'])'"
}
$reader.Close()

$conn.Close()
