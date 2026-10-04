$connStr = "Server=149.34.201.53; Database=GEMINI; User ID=sa; Password=Oryx123!; TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE COLUMN_NAME LIKE '%shelf%' OR COLUMN_NAME LIKE '%raf%' OR COLUMN_NAME LIKE '%locat%' OR COLUMN_NAME LIKE '%bin%'
ORDER BY TABLE_NAME
"@
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    Write-Host "$($reader['TABLE_NAME']).$($reader['COLUMN_NAME'])"
}
$reader.Close()

Write-Host "`n--- Check any data for 000138 or HORSERADISH in INV_Stocks or other tables ---"
$cmd.CommandText = "SELECT * FROM INV_Stocks WHERE StockCode = '000138'"
$reader = $cmd.ExecuteReader()
$cols = @()
for ($i = 0; $i -lt $reader.FieldCount; $i++) { $cols += $reader.GetName($i) }
while($reader.Read()){
    foreach ($c in $cols) {
        $val = $reader[$c]
        if ($val -ne $null -and $val -ne "" -and $val -ne 0 -and $val -ne $false) {
            Write-Host "  $c = $val"
        }
    }
}
$reader.Close()

$conn.Close()
