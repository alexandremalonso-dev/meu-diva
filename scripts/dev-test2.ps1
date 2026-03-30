# =========================
# CONFIG
# =========================
$baseUrl = "http://127.0.0.1:8002"
$emailPatient = "paciente1@meudiva.com"
$therapistId = 2

# =========================
# CALCULAR PRÓXIMA TERÇA às 15:00
# DayOfWeek: Sunday=0, Monday=1, Tuesday=2...
# =========================
$today = Get-Date
$targetWeekday = 2
$daysAhead = ($targetWeekday - [int]$today.DayOfWeek + 7) % 7
if ($daysAhead -eq 0) { $daysAhead = 7 }
$dt = $today.AddDays($daysAhead)
$dt = Get-Date -Year $dt.Year -Month $dt.Month -Day $dt.Day -Hour 15 -Minute 0 -Second 0
$starts = $dt.ToString("yyyy-MM-ddTHH:mm:ssK")

Write-Host "BaseUrl  : $baseUrl" -ForegroundColor Cyan
Write-Host "StartsAt : $starts" -ForegroundColor Cyan

# =========================
# LOGIN (PACIENTE)
# =========================
$pwd = Read-Host "Senha paciente" -AsSecureString
$pwdPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd)
)

$loginBody = @{ email = $emailPatient; password = $pwdPlain } | ConvertTo-Json -Compress

$loginP = Invoke-RestMethod `
  -Method POST `
  -Uri "$baseUrl/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

if (-not $loginP -or -not $loginP.access_token) {
  throw "Login falhou ou não retornou access_token. Response: $($loginP | ConvertTo-Json -Depth 10)"
}

$headersP = @{ Authorization = "Bearer $($loginP.access_token)" }
Write-Host "Login OK. Token setado." -ForegroundColor Green

# =========================
# CREATE APPOINTMENT
# =========================
$apptBody = @{
  therapist_user_id = $therapistId
  starts_at = $starts
  duration_minutes = 50
} | ConvertTo-Json -Compress

try {
  $created = Invoke-RestMethod `
    -Method POST `
    -Uri "$baseUrl/appointments" `
    -Headers $headersP `
    -ContentType "application/json" `
    -Body $apptBody
} catch {
  Write-Host "Falha ao criar appointment." -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message }
  throw
}

if (-not $created -or -not $created.id) {
  throw "Create não retornou id. Response: $($created | ConvertTo-Json -Depth 10)"
}

Write-Host "`nCriado:" -ForegroundColor Green
$created | ConvertTo-Json -Depth 10

# =========================
# CANCEL APPOINTMENT
# =========================
$cancelBody = @{ status = "cancelled" } | ConvertTo-Json -Compress

try {
  $cancelled = Invoke-RestMethod `
    -Method PATCH `
    -Uri "$baseUrl/appointments/$($created.id)/status" `
    -Headers $headersP `
    -ContentType "application/json" `
    -Body $cancelBody
} catch {
  Write-Host "Falha ao cancelar appointment." -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message }
  throw
}

Write-Host "`nCancelado:" -ForegroundColor Yellow
$cancelled | ConvertTo-Json -Depth 10