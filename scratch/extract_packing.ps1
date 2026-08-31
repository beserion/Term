$json = Get-Content 'scratch/swagger_packing.json' -Raw | ConvertFrom-Json
$output = ""

$output += "========================================`n"
$output += "1. PACKING ENDPOINTS`n"
$output += "========================================`n"

foreach($prop in $json.paths.psobject.properties) {
    if ($prop.Name -like '*Packing*') {
        $output += "Endpoint: $($prop.Name)`n"
        $methods = $prop.Value.psobject.properties
        foreach($m in $methods) {
            $output += "  Method: $($m.Name.ToUpper())`n"
            if ($m.Value.parameters) {
                $output += "  Parameters:`n"
                foreach($p in $m.Value.parameters) {
                    $output += "    - $($p.name) (in: $($p.in), type: $($p.schema.type))`n"
                }
            }
            if ($m.Value.requestBody) {
                $ref = $m.Value.requestBody.content.'application/json'.schema.'$ref'
                $output += "  RequestBody: $ref`n"
            }
            if ($m.Value.responses) {
                foreach($resp in $m.Value.responses.psobject.properties) {
                    $ref = $resp.Value.content.'application/json'.schema.'$ref'
                    $output += "  Response $($resp.Name): $ref`n"
                }
            }
        }
        $output += "`n"
    }
}

$output += "========================================`n"
$output += "2. PACKING SCHEMAS & MODELS`n"
$output += "========================================`n"

foreach($s in $json.components.schemas.psobject.properties) {
    if ($s.Name -like '*Terminal*' -or $s.Name -like '*Packing*' -or $s.Name -like '*WMS_*' -or $s.Name -like '*Box*' -or $s.Name -like '*Pallet*') {
        $output += "Schema: $($s.Name)`n"
        $output += ($s.Value | ConvertTo-Json -Depth 6)
        $output += "`n----------------------------------------`n"
    }
}

Set-Content -Path 'scratch/packing_details.txt' -Value $output -Encoding utf8
Write-Host "Done writing to scratch/packing_details.txt"
