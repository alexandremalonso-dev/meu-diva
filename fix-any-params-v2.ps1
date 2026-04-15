# Script para adicionar tipos a parâmetros any em arquivos específicos

$filesToFix = @(
    "app\(app)\admin\reports\assinaturas\page.tsx",
    "app\(app)\admin\reports\geral\page.tsx",
    "app\(app)\admin\reports\pagementos\page.tsx",
    "app\(app)\admin\reports\plataforma\page.tsx",
    "app\(app)\admin\reports\terapeutas\page.tsx",
    "app\(app)\admin\dashboard\page.tsx",
    "app\(app)\admin\users\page.tsx",
    "app\(app)\therapist\dashboard\page.tsx"
)

foreach ($file in $filesToFix) {
    $fullPath = "C:\meu-diva\front\$file"
    if (Test-Path $fullPath) {
        Write-Host "Corrigindo: $file" -ForegroundColor Green
        $content = Get-Content $fullPath -Raw
        
        # Substituir .filter((apt) => por .filter((apt: Appointment) =>
        $content = $content -replace '\.filter\(\(apt\) =>', '.filter((apt: Appointment) =>'
        $content = $content -replace '\.filter\(apt =>', '.filter((apt: Appointment) =>'
        
        # Substituir .map((item) => por .map((item: any) =>
        $content = $content -replace '\.map\(\(item\) =>', '.map((item: any) =>'
        $content = $content -replace '\.map\(item =>', '.map((item: any) =>'
        
        # Substituir .reduce((acc, curr) => por .reduce((acc: number, curr: any) =>
        $content = $content -replace '\.reduce\(\(acc, curr\) =>', '.reduce((acc: number, curr: any) =>'
        
        Set-Content $fullPath -Value $content -NoNewline
        Write-Host "  OK" -ForegroundColor Green
    } else {
        Write-Host "Arquivo não encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nCorreção concluída!" -ForegroundColor Green