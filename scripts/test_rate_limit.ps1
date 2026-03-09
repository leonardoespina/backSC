### Script PowerShell para Probar Rate Limiting
### Ejecutar: .\test_rate_limit.ps1

Write-Host "`n=== PRUEBA DE RATE LIMITING - LOGIN ===" -ForegroundColor Cyan
Write-Host "Límite: 5 intentos cada 15 minutos`n" -ForegroundColor Yellow

$url = "http://localhost:3000/api/usuarios/login"
$body = @{
    cedula = "12345678"
    password = "wrongpassword"
} | ConvertTo-Json

for ($i = 1; $i -le 7; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        Write-Host "✅ Intento $i : $($response.StatusCode) - OK" -ForegroundColor Green
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 429) {
            Write-Host "🚫 Intento $i : 429 - BLOQUEADO POR RATE LIMIT" -ForegroundColor Red
            
            # Obtener headers
            $headers = $_.Exception.Response.Headers
            Write-Host "   📊 RateLimit activo" -ForegroundColor Yellow
            
        } elseif ($statusCode -eq 400 -or $statusCode -eq 401) {
            Write-Host "⚠️  Intento $i : $statusCode - Credenciales incorrectas (esperado)" -ForegroundColor DarkYellow
        } else {
            Write-Host "❌ Intento $i : $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`n✅ Prueba completada" -ForegroundColor Green
Write-Host "Resultado esperado: Primeros 5 intentos pasan, intentos 6 y 7 bloqueados (429)`n" -ForegroundColor Cyan
