#!/bin/bash

# ============================================
# SCRIPT DE DEPLOY AUTOMATIZADO - MEU DIVÃ
# ============================================

set -e  # Para o script em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# FUNÇÕES AUXILIARES
# ============================================
print_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📍 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================
# VALIDAÇÕES INICIAIS
# ============================================
print_step "Validando ambiente..."

# Verificar se está logado no GCP
if ! gcloud auth print-access-token &>/dev/null; then
    print_error "Você não está logado no Google Cloud. Execute: gcloud auth login"
    exit 1
fi
print_success "Google Cloud autenticado"

# Verificar projeto ativo
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
print_success "Projeto ativo: $CURRENT_PROJECT"

# ============================================
# PARÂMETROS
# ============================================
ENVIRONMENT=${1:-non-prod}
ACTION=${2:-apply}

print_step "Configuração do deploy"
echo "Ambiente: $ENVIRONMENT"
echo "Ação: $ACTION"
echo ""

# Validar ambiente
if [[ "$ENVIRONMENT" != "non-prod" && "$ENVIRONMENT" != "prod" ]]; then
    print_error "Ambiente inválido. Use: non-prod ou prod"
    exit 1
fi

# Validar ação
if [[ "$ACTION" != "apply" && "$ACTION" != "plan" && "$ACTION" != "destroy" ]]; then
    print_error "Ação inválida. Use: apply, plan ou destroy"
    exit 1
fi

# ============================================
# CONFIGURAÇÕES POR AMBIENTE
# ============================================
if [[ "$ENVIRONMENT" == "non-prod" ]]; then
    BUCKET_NAME="meudiva-terraform-state-non-prod"
    TF_VARS_FILE="environments/non-prod/terraform.tfvars"
    PROJECT_ID="meudiva-non-prod"
else
    BUCKET_NAME="meudiva-terraform-state-prod"
    TF_VARS_FILE="environments/prod/terraform.tfvars"
    PROJECT_ID="meudiva-prod"
fi

# ============================================
# CONFIGURAR BACKEND DO TERRAFORM
# ============================================
print_step "Configurando backend do Terraform"

# Criar bucket se não existir
if ! gsutil ls "gs://$BUCKET_NAME" &>/dev/null; then
    print_warning "Bucket $BUCKET_NAME não encontrado. Criando..."
    gsutil mb -l southamerica-east1 "gs://$BUCKET_NAME"
    gsutil versioning set on "gs://$BUCKET_NAME"
    print_success "Bucket criado: $BUCKET_NAME"
else
    print_success "Bucket já existe: $BUCKET_NAME"
fi

# ============================================
# INICIALIZAR TERRAFORM
# ============================================
print_step "Inicializando Terraform"

cd infrastructure/terraform

cat > backend.tf << EOF
terraform {
  backend "gcs" {
    bucket = "$BUCKET_NAME"
    prefix = "terraform/state/$ENVIRONMENT"
  }
}
EOF

terraform init -reconfigure
print_success "Terraform inicializado"

# ============================================
# EXECUTAR AÇÃO
# ============================================
if [[ "$ACTION" == "plan" ]]; then
    print_step "Gerando plano de execução"
    terraform plan \
        -var-file="$TF_VARS_FILE" \
        -var="project_id=$PROJECT_ID" \
        -var="environment=$ENVIRONMENT"
    
elif [[ "$ACTION" == "apply" ]]; then
    print_step "Aplicando infraestrutura"
    terraform apply \
        -var-file="$TF_VARS_FILE" \
        -var="project_id=$PROJECT_ID" \
        -var="environment=$ENVIRONMENT" \
        -auto-approve
    
    print_success "Deploy concluído!"
    
    # Mostrar outputs
    echo ""
    print_step "Outputs do deploy"
    terraform output
    
elif [[ "$ACTION" == "destroy" ]]; then
    print_warning "DESTRUIR INFRAESTRUTURA - Ambiente: $ENVIRONMENT"
    read -p "Digite 'DESTROY' para confirmar: " CONFIRM
    
    if [[ "$CONFIRM" != "DESTROY" ]]; then
        print_error "Confirmação incorreta. Operação cancelada."
        exit 1
    fi
    
    print_step "Destruindo infraestrutura"
    terraform destroy \
        -var-file="$TF_VARS_FILE" \
        -var="project_id=$PROJECT_ID" \
        -var="environment=$ENVIRONMENT" \
        -auto-approve
    
    print_success "Infraestrutura destruída"
fi

cd ../..

print_success "Script finalizado!"