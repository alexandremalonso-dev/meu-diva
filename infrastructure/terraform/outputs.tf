# ============================================
# OUTPUTS DO TERRAFORM
# ============================================

# ============================================
# CLOUD RUN
# ============================================
output "cloud_run_url" {
  description = "URL do serviço Cloud Run"
  value       = google_cloud_run_v2_service.meudiva_api.uri
}

output "cloud_run_service_name" {
  description = "Nome do serviço Cloud Run"
  value       = google_cloud_run_v2_service.meudiva_api.name
}

# ============================================
# ARTIFACT REGISTRY
# ============================================
output "artifact_registry_repository" {
  description = "Nome do repositório no Artifact Registry"
  value       = google_artifact_registry_repository.meudiva_api.id
}

# ============================================
# CLOUD SQL
# ============================================
output "cloud_sql_instance_name" {
  description = "Nome da instância Cloud SQL"
  value       = google_sql_database_instance.meudiva_db.name
}

output "cloud_sql_database_name" {
  description = "Nome do banco de dados"
  value       = google_sql_database.meudiva_db.name
}

output "cloud_sql_connection_name" {
  description = "Nome da conexão do Cloud SQL (para Cloud Run)"
  value       = google_sql_database_instance.meudiva_db.connection_name
  sensitive   = true
}

output "database_password" {
  description = "Senha do banco de dados (para referência)"
  value       = random_password.db_password.result
  sensitive   = true
}

# ============================================
# CLOUD STORAGE
# ============================================
output "uploads_bucket_name" {
  description = "Nome do bucket de uploads"
  value       = google_storage_bucket.uploads.name
}

output "documents_bucket_name" {
  description = "Nome do bucket de documentos"
  value       = google_storage_bucket.documents.name
}

# ============================================
# MEMORYSTORE (REDIS)
# ============================================
output "redis_instance_name" {
  description = "Nome da instância Redis"
  value       = google_redis_instance.meudiva_redis.name
}

output "redis_host" {
  description = "Host do Redis"
  value       = google_redis_instance.meudiva_redis.host
}

output "redis_port" {
  description = "Porta do Redis"
  value       = google_redis_instance.meudiva_redis.port
}

# ============================================
# SERVICE ACCOUNT
# ============================================
output "cloud_run_service_account_email" {
  description = "E-mail da service account do Cloud Run"
  value       = google_service_account.cloud_run_sa.email
}

# ============================================
# DNS (se configurado)
# ============================================
output "dns_zone_name" {
  description = "Nome da zona DNS"
  value       = var.environment == "prod" && var.domain_name != "" ? google_dns_managed_zone.meudiva_zone[0].name : null
}

output "dns_zone_dns_name" {
  description = "Nome DNS da zona"
  value       = var.environment == "prod" && var.domain_name != "" ? google_dns_managed_zone.meudiva_zone[0].dns_name : null
}

# ============================================
# SECRET MANAGER
# ============================================
output "jwt_secret_name" {
  description = "Nome do secret JWT"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}

# ============================================
# INFORMAÇÕES DO AMBIENTE
# ============================================
output "environment" {
  description = "Ambiente atual"
  value       = var.environment
}

output "project_id" {
  description = "ID do projeto GCP"
  value       = var.project_id
}

output "region" {
  description = "Região configurada"
  value       = var.region
}