$connStr = "Server=149.34.201.53; Database=GEMINI; User ID=sa; Password=Oryx123!; TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) as Cnt FROM STN_WarehouseStocks"
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    Write-Host "STN_WarehouseStocks Total Rows: $($reader['Cnt'])"
}
$reader.Close()

$cmd.CommandText = "SELECT COUNT(*) as Cnt FROM INV_StockLocations"
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    Write-Host "INV_StockLocations Total Rows: $($reader['Cnt'])"
}
$reader.Close()

$cmd.CommandText = "SELECT COUNT(*) as WithShelf, (SELECT COUNT(*) FROM INV_Stocks) as Total FROM INV_Stocks WHERE ShelfAddress IS NOT NULL AND ShelfAddress <> ''"
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    Write-Host "INV_Stocks with ShelfAddress: $($reader['WithShelf']) / $($reader['Total'])"
}
$reader.Close()

$conn.Close()
