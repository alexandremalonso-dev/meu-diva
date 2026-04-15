# Script para adicionar tipos a parâmetros any implícitos

$filesToFix = @(
    "app\(app)\admin\dashboard\page.tsx",
    "app\(app)\admin\invites\page.tsx",
    "app\(app)\admin\permissions\page.tsx",
    "app\(app)\admin\reports\assinaturas\page.tsx",
    "app\(app)\patient\sessions\completed\page.tsx",
    "app\(app)\patient\sessions\upcoming\page.tsx"
)

foreach ($file in $filesToFix) {
    $fullPath = "C:\meu-diva\front\$file"
    if (Test-Path $fullPath) {
        Write-Host "Corrigindo: $file" -ForegroundColor Green
        $content = Get-Content $fullPath -Raw
        
        # Substituir .filter(apt => por .filter((apt: Appointment) =>
        $content = $content -replace '\.filter\(apt =>', '.filter((apt: Appointment) =>'
        $content = $content -replace '\.filter\(a =>', '.filter((a: any) =>'
        
        # Substituir .map(apt => por .map((apt: Appointment) =>
        $content = $content -replace '\.map\(apt =>', '.map((apt: Appointment) =>'
        $content = $content -replace '\.map\(a =>', '.map((a: any) =>'
        
        # Substituir .reduce((sum, apt) => por .reduce((sum: number, apt: Appointment) =>
        $content = $content -replace '\.reduce\(\(sum, apt\) =>', '.reduce((sum: number, apt: Appointment) =>'
        $content = $content -replace '\.reduce\(\(acc, curr\) =>', '.reduce((acc: any, curr: any) =>'
        
        # Substituir .sort((a, b) => por .sort((a: any, b: any) =>
        $content = $content -replace '\.sort\(\(a, b\) =>', '.sort((a: any, b: any) =>'
        
        Set-Content $fullPath -Value $content -NoNewline
        Write-Host "  OK" -ForegroundColor Green
    } else {
        Write-Host "Arquivo não encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nCorreção concluída!" -ForegroundColor Green