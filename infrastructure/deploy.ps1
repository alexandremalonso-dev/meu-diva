# ============================================
# SCRIPT DE DEPLOY AUTOMATIZADO - MEU DIVA
# VERSAO PARA WINDOWS POWERSHELL
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("non-prod", "prod")]
    [string]$Environment = "non-prod",
    
    [Parameter(Position=1)]
    [ValidateSet("plan", "apply", "destroy")]
    [string]$Action = "apply"
)

# Configuracoes de cores
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor $Cyan
    Write-Host ">>> $Message" -ForegroundColor $Green
    Write-Host "===================================================" -ForegroundColor $Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Yellow
}

# ============================================
# VALIDACOES INICIAIS
# ============================================
Write-Step "Validando ambiente..."

# Verificar se gcloud esta instalado
$gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudPath) {
    Write-Error "Google Cloud SDK nao encontrado. Instale o gcloud CLI."
    exit 1
}
Write-Success "Google Cloud SDK encontrado"

# Verificar se esta logado no GCP
$authTest = gcloud auth print-access-token 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Voce nao esta logado no Google Cloud. Execute: gcloud auth login"
    exit 1
}
Write-Success "Google Cloud autenticado"

# Verificar projeto ativo
$currentProject = gcloud config get-value project 2>$null
Write-Success "Projeto ativo: $currentProject"

# ============================================
# CONFIGURACOES POR AMBIENTE
# ============================================
Write-Step "Configuracao do deploy"
Write-Host "Ambiente: $Environment"
Write-Host "Acao: $Action"
Write-Host ""

if ($Environment -eq "non-prod") {
    $BucketName = "meudiva-terraform-state-non-prod"
    $TfVarsFile = "environments/non-prod/terraform.tfvars"
    $ProjectId = "meudiva-non-prod"
} else {
    $BucketName = "meudiva-terraform-state-prod"
    $TfVarsFile = "environments/prod/terraform.tfvars"
    $ProjectId = "meudiva-prod"
}

# ============================================
# CONFIGURAR BACKEND DO TERRAFORM
# ============================================
Write-Step "Configurando backend do Terraform"

# Verificar se bucket existe
$bucketExists = gsutil ls "gs://$BucketName" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Bucket $BucketName nao encontrado. Criando..."
    gsutil mb -l southamerica-east1 "gs://$BucketName"
    gsutil versioning set on "gs://$BucketName"
    Write-Success "Bucket criado: $BucketName"
} else {
    Write-Success "Bucket ja existe: $BucketName"
}

# ============================================
# INICIALIZAR TERRAFORM
# ============================================
Write-Step "Inicializando Terraform"

Push-Location infrastructure/terraform

# Criar arquivo backend.tf
@"
terraform {
  backend "gcs" {
    bucket = "$BucketName"
    prefix = "terraform/state/$Environment"
  }
}
"@ | Out-File -FilePath backend.tf -Encoding utf8

terraform init -reconfigure
if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha na inicializacao do Terraform"
    Pop-Location
    exit 1
}
Write-Success "Terraform inicializado"

# ============================================
# EXECUTAR ACAO
# ============================================
if ($Action -eq "plan") {
    Write-Step "Gerando plano de execucao"
    terraform plan `
        -var-file="$TfVarsFile" `
        -var="project_id=$ProjectId" `
        -var="environment=$Environment"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao gerar plano"
        Pop-Location
        exit 1
    }
    
} elseif ($Action -eq "apply") {
    Write-Step "Aplicando infraestrutura"
    terraform apply `
        -var-file="$TfVarsFile" `
        -var="project_id=$ProjectId" `
        -var="environment=$Environment" `
        -auto-approve
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha no deploy"
        Pop-Location
        exit 1
    }
    
    Write-Success "Deploy concluido!"
    
    # Mostrar outputs
    Write-Step "Outputs do deploy"
    terraform output
    
} elseif ($Action -eq "destroy") {
    Write-Warning "DESTRUIR INFRAESTRUTURA - Ambiente: $Environment"
    $confirmation = Read-Host "Digite 'DESTROY' para confirmar"
    
    if ($confirmation -ne "DESTROY") {
        Write-Error "Confirmacao incorreta. Operacao cancelada."
        Pop-Location
        exit 1
    }
    
    Write-Step "Destruindo infraestrutura"
    terraform destroy `
        -var-file="$TfVarsFile" `
        -var="project_id=$ProjectId" `
        -var="environment=$Environment" `
        -auto-approve
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao destruir infraestrutura"
        Pop-Location
        exit 1
    }
    
    Write-Success "Infraestrutura destruida"
}

Pop-Location
Write-Success "Script finalizado!"