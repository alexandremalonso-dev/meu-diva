# ============================================
# SCRIPT ÚNICO DE REFATORAÇÃO useApi
# Autor: DeepSeek
# Data: 27/03/2026
# ============================================

Write-Host "🚀 Iniciando refatoração para useApi..." -ForegroundColor Cyan
Write-Host "📁 Pasta base: C:\meu-diva\front" -ForegroundColor Yellow
Write-Host ""

# LISTA DE ARQUIVOS PARA REFATORAR
$arquivos = @(
    # PACIENTE (exceto dashboard)
    "src/app/(app)/patient/profile/page.tsx",
    "src/app/(app)/patient/wallet/page.tsx",
    "src/app/(app)/patient/invites/page.tsx",
    "src/app/(app)/patient/sessions/upcoming/page.tsx",
    "src/app/(app)/patient/sessions/completed/page.tsx",
    "src/app/(app)/patient/session/[id]/page.tsx",
    
    # TERAPEUTA (exceto os já feitos)
    "src/app/(app)/therapist/wallet/page.tsx",
    "src/app/(app)/therapist/invites/page.tsx",
    "src/app/(app)/therapist/patients/page.tsx",
    "src/app/(app)/therapist/schedule/page.tsx",
    "src/app/(app)/therapist/sessions/upcoming/page.tsx",
    "src/app/(app)/therapist/sessions/completed/page.tsx",
    "src/app/(app)/therapist/session/[id]/page.tsx",
    
    # COMPONENTES REUTILIZÁVEIS
    "src/components/layout/PublicHeader.tsx",
    "src/components/wallet/BalanceCard.tsx",
    "src/components/calendar/CalendarPatient.tsx",
    "src/components/calendar/CalendarTherapist.tsx"
)

function Refatorar-Arquivo {
    param($caminho)
    
    $caminhoCompleto = Join-Path "C:\meu-diva\front" $caminho
    
    if (-not (Test-Path $caminhoCompleto)) {
        Write-Host "⚠️  Arquivo não encontrado: $caminho" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "🔧 Processando: $caminho" -ForegroundColor Cyan
    
    # Criar backup
    $backup = "$caminhoCompleto.bak"
    Copy-Item $caminhoCompleto $backup -Force
    
    # Ler conteúdo
    $conteudo = Get-Content $caminhoCompleto -Raw
    
    # 1. Substituir import da API
    $conteudo = $conteudo -replace 'import \{ api \} from ["'']@/lib/api["'']', 'import { useApi } from "@/lib/useApi"'
    $conteudo = $conteudo -replace 'import \{ api \} from ["'']\.\./\.\./lib/api["'']', 'import { useApi } from "@/lib/useApi"'
    $conteudo = $conteudo -replace 'import \{ api \} from ["'']\.\./lib/api["'']', 'import { useApi } from "@/lib/useApi"'
    
    # 2. Adicionar hook useApi após useAuth()
    if ($conteudo -match 'useAuth\(\)') {
        $conteudo = $conteudo -replace '(const \{.*?useAuth\(\);?)', "`$1`n`n  // Hook centralizado useApi`n  const { execute: apiCall } = useApi();"
    } else {
        $conteudo = $conteudo -replace '(const router = useRouter\(\);?)', "`$1`n`n  // Hook centralizado useApi`n  const { execute: apiCall } = useApi();"
    }
    
    # 3. Substituir chamadas GET simples
    $conteudo = $conteudo -replace 'await api\(([^,)]+)\)(?!\s*,\s*\{)', 'await apiCall({ url: $1, requireAuth: true })'
    
    # 4. Substituir chamadas POST/PUT/PATCH com body
    $conteudo = $conteudo -replace 'await api\(([^,]+),\s*\{\s*method:\s*"([^"]+)",\s*body:\s*JSON\.stringify\(([^)]+)\)\s*\}\)', 'await apiCall({ url: $1, method: "$2", body: $3, requireAuth: true })'
    
    # 5. Substituir chamadas DELETE/PUT sem body
    $conteudo = $conteudo -replace 'await api\(([^,]+),\s*\{\s*method:\s*"([^"]+)"\s*\}\)', 'await apiCall({ url: $1, method: "$2", requireAuth: true })'
    
    # 6. Substituir chamadas com body direto
    $conteudo = $conteudo -replace 'await api\(([^,]+),\s*\{\s*method:\s*"([^"]+)",\s*body:\s*([^}]+)\s*\}\)', 'await apiCall({ url: $1, method: "$2", body: $3, requireAuth: true })'
    
    # Salvar
    Set-Content $caminhoCompleto $conteudo -NoNewline
    
    Write-Host "  ✅ Refatorado com sucesso!" -ForegroundColor Green
    Write-Host "  📁 Backup: $backup" -ForegroundColor DarkGray
    return $true
}

Write-Host "📋 Arquivos a processar: $($arquivos.Count)" -ForegroundColor Magenta
Write-Host ""

$sucesso = 0
$falha = 0

Push-Location "C:\meu-diva\front"

foreach ($arquivo in $arquivos) {
    if (Refatorar-Arquivo -caminho $arquivo) {
        $sucesso++
    } else {
        $falha++
    }
    Write-Host ""
}

Pop-Location

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO DA REFATORAÇÃO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ Sucesso: $sucesso arquivos" -ForegroundColor Green
Write-Host "⚠️  Falha: $falha arquivos" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 DICAS:" -ForegroundColor Magenta
Write-Host "  • Backups criados com extensão .bak" -ForegroundColor White
Write-Host "  • Para restaurar um arquivo:" -ForegroundColor White
Write-Host "    Copy-Item 'caminho/arquivo.tsx.bak' 'caminho/arquivo.tsx' -Force" -ForegroundColor Gray
Write-Host ""
Write-Host "🧪 PRÓXIMOS PASSOS:" -ForegroundColor Magenta
Write-Host "  1. Execute: npm run dev (dentro da pasta front)" -ForegroundColor White
Write-Host "  2. Teste as páginas refatoradas" -ForegroundColor White
Write-Host "  3. Verifique se não há erros no console" -ForegroundColor White
Write-Host "  4. Se tudo ok, remova os .bak com: Remove-Item C:\meu-diva\front\src\*.bak -Recurse" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  COMANDO DE RESTAURAÇÃO (se algo der errado):" -ForegroundColor Red
