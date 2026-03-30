# =========================
# CONFIG
# =========================
$baseUrl = "http://127.0.0.1:8002"
$loginUrl = "$baseUrl/auth/login"
$appointmentsUrl = "$baseUrl/appointments"

$email = "alexandre@meudiva.com"
$password = Read-Host -AsSecureString "Senha"
$pwdPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

function Read-ErrorDetails($err) {
  $statusLine = ""
  $contentType = ""
  $body = "(vazio)"

  # 1) Muitas vezes o body já vem aqui (FastAPI costuma colocar JSON no ErrorDetails.Message)
  try {
    if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
      $msg = $err.ErrorDetails.Message.Trim()
      if (-not [string]::IsNullOrWhiteSpace($msg)) {
        $body = $msg
      }
    }
  } catch { }

  # 2) Tenta ler do response stream (às vezes vem vazio mesmo)
  try {
    $resp = $err.Exception.Response
    if ($resp -ne $null) {
      $statusLine = "$($resp.StatusCode) $($resp.StatusDescription)"
      $contentType = "$($resp.ContentType)"

      if ($body -eq "(vazio)") {
        $stream = $resp.GetResponseStream()
        if ($stream -ne $null) {
          $reader = New-Object System.IO.StreamReader($stream)
          $txt = $reader.ReadToEnd()
          if (-not [string]::IsNullOrWhiteSpace($txt)) { $body = $txt }
        }
      }
    }
  } catch { }

  return @{
    status = $statusLine
    contentType = $contentType
    body = $body
  }
}

Write-Host "Tentando login em $loginUrl ..." -ForegroundColor Cyan

# =========================
# LOGIN (JSON email/password)
# =========================
$loginBodyJson = @{
  email = $email
  password = $pwdPlain
} | ConvertTo-Json -Compress

try {
  $loginResp = Invoke-RestMethod -Method POST -Uri $loginUrl -ContentType "application/json" -Body $loginBodyJson
} catch {
  $d = Read-ErrorDetails $_
  throw "Login falhou. Status: $($d.status) | ContentType: $($d.contentType) | Body: $($d.body)"
}

$token = $loginResp.access_token
if (-not $token) {
  $loginRespJson = $loginResp | ConvertTo-Json -Depth 20
  throw "Login retornou sem access_token. Response foi: $loginRespJson"
}

$headers = @{ Authorization = "Bearer $token" }
Write-Host "Login OK. Token obtido." -ForegroundColor Green

# =========================
# CREATE APPOINTMENT
# =========================
$createBody = @{
  therapist_user_id = 3
  starts_at = "2026-03-04T14:00:00-03:00"
  duration_minutes = 50
} | ConvertTo-Json -Compress

try {
  $created = Invoke-RestMethod `
    -Method POST `
    -Uri $appointmentsUrl `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $createBody
} catch {
  $d = Read-ErrorDetails $_
  throw "Create appointment falhou. Status: $($d.status) | ContentType: $($d.contentType) | Body: $($d.body)"
}

Write-Host "`nAppointment criado:" -ForegroundColor Green
$created | ConvertTo-Json -Depth 10

# =========================
# LIST MY APPOINTMENTS
# =========================
try {
  $list = Invoke-RestMethod `
    -Method GET `
    -Uri "$appointmentsUrl/me" `
    -Headers $headers
} catch {
  $d = Read-ErrorDetails $_
  throw "List appointments falhou. Status: $($d.status) | ContentType: $($d.contentType) | Body: $($d.body)"
}

Write-Host "`nMeus appointments:" -ForegroundColor Green
$list | ConvertTo-Json -Depth 10