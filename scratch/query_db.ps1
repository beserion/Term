$conn = New-Object System.Data.SqlClient.SqlConnection("Server=149.34.201.53;Database=GEMINI;User Id=sa;Password=Password1!;TrustServerCertificate=True;Connect Timeout=5;")
try {
    $conn.Open()
    Write-Output "Connected!"
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Employee%' OR TABLE_NAME LIKE '%User%' OR TABLE_NAME LIKE '%Person%'"
    $r = $cmd.ExecuteReader()
    while ($r.Read()) {
        Write-Output $r[0]
    }
    $r.Close()
} catch {
    Write-Output "Error: $_"
} finally {
    $conn.Close()
}
