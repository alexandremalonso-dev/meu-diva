# ============================================
# AMBIENTE: NON-PROD (Desenvolvimento)
# ============================================

# Projeto GCP
project_id   = "meudiva-non-prod"
environment  = "non-prod"
region       = "southamerica-east1"
zone         = "southamerica-east1-b"

# URLs
frontend_url = "https://non-prod.meudivaonline.com"
backend_url  = "https://api-non-prod.meudivaonline.com"
domain_name  = "non-prod.meudivaonline.com"

# Cloud Run (configuração econômica)
cpu_limit      = "1"
memory_limit   = "2Gi"
min_instances  = 0
max_instances  = 3

# Cloud SQL (configuração leve)
db_tier      = "db-custom-1-3840"
db_disk_size = 50

# Memorystore (Redis)
redis_memory_gb = 2

# Secrets (referências ao Secret Manager)
secret_env_vars = {
  STRIPE_SECRET_KEY        = { secret_name = "stripe-secret-key-non-prod" }
  STRIPE_WEBHOOK_SECRET    = { secret_name = "stripe-webhook-secret-non-prod" }
  JWT_SECRET               = { secret_name = "jwt-secret-non-prod" }
  GOOGLE_CLIENT_ID         = { secret_name = "google-client-id-non-prod" }
  GOOGLE_CLIENT_SECRET     = { secret_name = "google-client-secret-non-prod" }
  MICROSOFT_CLIENT_ID      = { secret_name = "microsoft-client-id-non-prod" }
  MICROSOFT_CLIENT_SECRET  = { secret_name = "microsoft-client-secret-non-prod" }
  SMTP_HOST                = { secret_name = "smtp-host" }
  SMTP_USER                = { secret_name = "smtp-user" }
  SMTP_PASSWORD            = { secret_name = "smtp-password" }
  FROM_EMAIL               = { secret_name = "from-email" }
}