$filesToFix = @(
    "app/(app)/admin/dashboard/page.tsx",
    "app/(app)/admin/reports/assinaturas/page.tsx",
    "app/(app)/admin/reports/geral/page.tsx",
    "app/(app)/admin/reports/plataforma/page.tsx",
    "app/(app)/admin/reports/terapeutas/page.tsx",
    "app/(app)/therapist/dashboard/page.tsx",
    "app/(app)/therapist/financial-report/page.tsx"
)

foreach ($file in $filesToFix) {
    $fullPath = "C:\meu-diva\front\$file"
    if (Test-Path $fullPath) {
        Write-Host "Corrigindo: $file" -ForegroundColor Green
        $content = Get-Content $fullPath -Raw
        
        # Adicionar import do ChartTooltip se não existir
        if ($content -notmatch "import.*ChartTooltip") {
            $content = $content -replace '(import .+ from "react";)', '$1' + "`nimport { ChartTooltip } from '@/components/ui/ChartTooltip';"
        }
        
        # Substituir Tooltip com formatter por content
        $content = $content -replace '<Tooltip\s+formatter=\{\(v: number\) => formatCurrency\(v\)\}\s+contentStyle=\{[^}]+\}\s*/>', '<Tooltip content={<ChartTooltip formatter={formatCurrency} />} />'
        $content = $content -replace '<Tooltip\s+formatter=\{\(v: number\) => formatCurrency\(v\) as any\}\s+contentStyle=\{[^}]+\}\s*/>', '<Tooltip content={<ChartTooltip formatter={formatCurrency} />} />'
        $content = $content -replace '<Tooltip\s+formatter=\{\(v: number, name: string\) => \{\s+if \(name === "mrr"\) return formatCurrency\(v\) as any;\s+return `\$\{v\} assinantes` as any;\s+\}\}\s+contentStyle=\{[^}]+\}\s*/>', '<Tooltip content={<ChartTooltip formatter={formatCurrency} />} />'
        
        Set-Content $fullPath -Value $content -NoNewline
        Write-Host "  OK" -ForegroundColor Green
    } else {
        Write-Host "Arquivo não encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nCorreção concluída!" -ForegroundColor Green