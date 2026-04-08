# ============================================
# AMBIENTE: PROD (Produção)
# ============================================

# Projeto GCP
project_id   = "meudiva-prod"
environment  = "prod"
region       = "southamerica-east1"
zone         = "southamerica-east1-b"

# URLs
frontend_url = "https://meudivaonline.com"
backend_url  = "https://api.meudivaonline.com"
domain_name  = "meudivaonline.com"

# Cloud Run (configuração robusta)
cpu_limit      = "2"
memory_limit   = "4Gi"
min_instances  = 1
max_instances  = 10

# Cloud SQL (configuração de produção)
db_tier      = "db-custom-2-7680"
db_disk_size = 100

# Memorystore (Redis)
redis_memory_gb = 5

# Secrets (referências ao Secret Manager)
secret_env_vars = {
  STRIPE_SECRET_KEY        = { secret_name = "stripe-secret-key-prod" }
  STRIPE_WEBHOOK_SECRET    = { secret_name = "stripe-webhook-secret-prod" }
  JWT_SECRET               = { secret_name = "jwt-secret-prod" }
  GOOGLE_CLIENT_ID         = { secret_name = "google-client-id-prod" }
  GOOGLE_CLIENT_SECRET     = { secret_name = "google-client-secret-prod" }
  MICROSOFT_CLIENT_ID      = { secret_name = "microsoft-client-id-prod" }
  MICROSOFT_CLIENT_SECRET  = { secret_name = "microsoft-client-secret-prod" }
  SMTP_HOST                = { secret_name = "smtp-host" }
  SMTP_USER                = { secret_name = "smtp-user" }
  SMTP_PASSWORD            = { secret_name = "smtp-password" }
  FROM_EMAIL               = { secret_name = "from-email" }
}