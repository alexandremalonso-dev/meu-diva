# ============================================
# VARIÁVEIS DO PROJETO
# ============================================

variable "project_id" {
  description = "ID do projeto no Google Cloud"
  type        = string
}

variable "environment" {
  description = "Ambiente (non-prod ou prod)"
  type        = string
  validation {
    condition     = var.environment == "non-prod" || var.environment == "prod"
    error_message = "Environment deve ser 'non-prod' ou 'prod'."
  }
}

variable "region" {
  description = "Região do Google Cloud"
  type        = string
  default     = "southamerica-east1"
}

variable "zone" {
  description = "Zona do Google Cloud"
  type        = string
  default     = "southamerica-east1-b"
}

# ============================================
# VARIÁVEIS DO CLOUD RUN
# ============================================

variable "cpu_limit" {
  description = "Limite de CPU para o Cloud Run (em vCPUs)"
  type        = string
  default     = "2"
}

variable "memory_limit" {
  description = "Limite de memória para o Cloud Run"
  type        = string
  default     = "4Gi"
}

variable "min_instances" {
  description = "Número mínimo de instâncias do Cloud Run"
  type        = number
  default     = null
}

variable "max_instances" {
  description = "Número máximo de instâncias do Cloud Run"
  type        = number
  default     = 10
}

# ============================================
# VARIÁVEIS DO CLOUD SQL
# ============================================

variable "db_tier" {
  description = "Tier da instância Cloud SQL"
  type        = string
  default     = "db-custom-2-7680"
}

variable "db_disk_size" {
  description = "Tamanho do disco do Cloud SQL (GB)"
  type        = number
  default     = 100
}

# ============================================
# VARIÁVEIS DO MEMORYSTORE (REDIS)
# ============================================

variable "redis_memory_gb" {
  description = "Memória do Redis em GB"
  type        = number
  default     = 5
}

# ============================================
# VARIÁVEIS DE URL
# ============================================

variable "frontend_url" {
  description = "URL do frontend (para CORS e redirects)"
  type        = string
}

variable "backend_url" {
  description = "URL do backend (API)"
  type        = string
}

variable "domain_name" {
  description = "Nome do domínio (ex: meudivaonline.com)"
  type        = string
  default     = ""
}

# ============================================
# VARIÁVEIS DE SECRETS
# ============================================

variable "secret_env_vars" {
  description = "Mapa de variáveis de ambiente que vêm do Secret Manager"
  type = map(object({
    secret_name = string
  }))
  default = {}
  
  # Exemplo de uso:
  # secret_env_vars = {
  #   STRIPE_SECRET_KEY = { secret_name = "stripe-secret-key" }
  #   JWT_SECRET        = { secret_name = "jwt-secret" }
  # }
}

# ============================================
# VARIÁVEIS PARA NON-PROD (VALORES PADRÃO)
# ============================================

variable "non_prod_defaults" {
  description = "Configurações padrão para ambiente non-prod"
  type = object({
    min_instances   = number
    max_instances   = number
    db_tier         = string
    db_disk_size    = number
    redis_memory_gb = number
  })
  default = {
    min_instances   = 0
    max_instances   = 3
    db_tier         = "db-custom-1-3840"
    db_disk_size    = 50
    redis_memory_gb = 2
  }
}

# ============================================
# VARIÁVEIS PARA PROD (VALORES PADRÃO)
# ============================================

variable "prod_defaults" {
  description = "Configurações padrão para ambiente prod"
  type = object({
    min_instances   = number
    max_instances   = number
    db_tier         = string
    db_disk_size    = number
    redis_memory_gb = number
  })
  default = {
    min_instances   = 1
    max_instances   = 10
    db_tier         = "db-custom-2-7680"
    db_disk_size    = 100
    redis_memory_gb = 5
  }
}

# ============================================
# LOCALS (VALORES COMPUTADOS POR AMBIENTE)
# ============================================

locals {
  # Valores específicos por ambiente
  effective_min_instances = var.min_instances != null ? var.min_instances : (
    var.environment == "prod" ? var.prod_defaults.min_instances : var.non_prod_defaults.min_instances
  )
  
  effective_max_instances = var.max_instances != null ? var.max_instances : (
    var.environment == "prod" ? var.prod_defaults.max_instances : var.non_prod_defaults.max_instances
  )
  
  effective_db_tier = var.db_tier != "db-custom-2-7680" ? var.db_tier : (
    var.environment == "prod" ? var.prod_defaults.db_tier : var.non_prod_defaults.db_tier
  )
  
  effective_db_disk_size = var.db_disk_size != 100 ? var.db_disk_size : (
    var.environment == "prod" ? var.prod_defaults.db_disk_size : var.non_prod_defaults.db_disk_size
  )
  
  effective_redis_memory_gb = var.redis_memory_gb != 5 ? var.redis_memory_gb : (
    var.environment == "prod" ? var.prod_defaults.redis_memory_gb : var.non_prod_defaults.redis_memory_gb
  )
}