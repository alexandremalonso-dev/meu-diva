# ============================================
# PROVIDER CONFIGURATION
# ============================================
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "gcs" {
    # Bucket será criado separadamente ou via script
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ============================================
# RANDOM ID PARA RECURSOS ÚNICOS
# ============================================
resource "random_id" "suffix" {
  byte_length = 4
}

# ============================================
# ARTIFACT REGISTRY (Armazenamento de imagens Docker)
# ============================================
resource "google_artifact_registry_repository" "meudiva_api" {
  location      = var.region
  repository_id = "meudiva-api"
  description   = "Repositório de imagens Docker do Meu Divã"
  format        = "DOCKER"
  
  docker_config {
    immutable_tags = false
  }
  
  cleanup_policies {
    id     = "keep-last-10"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "30d"
    }
  }
}

# ============================================
# CLOUD RUN SERVICE
# ============================================
resource "google_cloud_run_v2_service" "meudiva_api" {
  name     = "meudiva-api-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  
  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/meudiva-api/meudiva-api-${var.environment}:latest"
      
      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
      }
      
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      
      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url
      }
      
      env {
        name  = "BACKEND_URL"
        value = var.backend_url
      }
      
      # Variáveis de ambiente via Secret Manager
      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_name
              version = "latest"
            }
          }
        }
      }
      
      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 10
        period_seconds        = 15
        failure_threshold     = 10
        tcp_socket {
          port = 8080
        }
      }
      
      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
      }
    }
    
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
    
    timeout = "3600s"
    
    service_account = google_service_account.cloud_run_sa.email
  }
  
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
  
  depends_on = [google_artifact_registry_repository.meudiva_api]
}

# ============================================
# SERVICE ACCOUNT PARA CLOUD RUN
# ============================================
resource "google_service_account" "cloud_run_sa" {
  account_id   = "meudiva-cloudrun-sa-${var.environment}"
  display_name = "Service Account for Cloud Run - ${var.environment}"
}

resource "google_project_iam_member" "cloud_run_sa_secret_access" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_sa_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ============================================
# CLOUD SQL POSTGRESQL
# ============================================
resource "google_sql_database_instance" "meudiva_db" {
  name             = "meudiva-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier              = var.db_tier
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
      }
    }
    
    ip_configuration {
      ipv4_enabled    = true
      private_network = var.environment == "prod" ? google_compute_network.vpc[0].id : null
      
      authorized_networks {
        name  = "cloud-run"
        value = "0.0.0.0/0"
      }
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
    
    database_flags {
      name  = "shared_buffers"
      value = "262144"
    }
  }
  
  deletion_protection = var.environment == "prod" ? true : false
}

resource "google_sql_database" "meudiva_db" {
  name     = "meudiva"
  instance = google_sql_database_instance.meudiva_db.name
}

resource "google_sql_user" "meudiva_user" {
  name     = "meudiva_user"
  instance = google_sql_database_instance.meudiva_db.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

# ============================================
# CLOUD STORAGE BUCKETS
# ============================================
resource "google_storage_bucket" "uploads" {
  name          = "meudiva-uploads-${random_id.suffix.hex}"
  location      = var.region
  force_destroy = var.environment != "prod"
  uniform_bucket_level_access = true
  
  cors {
    origin          = [var.frontend_url]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "documents" {
  name          = "meudiva-documents-${random_id.suffix.hex}"
  location      = var.region
  force_destroy = var.environment != "prod"
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 2555 # 7 anos
    }
    action {
      type = "Delete"
    }
  }
}

# ============================================
# MEMORYSTORE (REDIS) - PARA WEBSOCKET
# ============================================
resource "google_redis_instance" "meudiva_redis" {
  name           = "meudiva-redis-${var.environment}"
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.redis_memory_gb
  region         = var.region
  
  redis_version     = "REDIS_7_2"
  display_name      = "Redis para WebSocket - ${var.environment}"
  reserved_ip_range = "10.0.0.0/29"
  
  auth_enabled = true
  
  maintenance_policy {
    day {
      day  = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }
}

# ============================================
# VPC NETWORK (apenas para produção)
# ============================================
resource "google_compute_network" "vpc" {
  count = var.environment == "prod" ? 1 : 0
  
  name                    = "meudiva-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "subnet" {
  count = var.environment == "prod" ? 1 : 0
  
  name          = "meudiva-subnet-${var.region}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc[0].id
  
  private_ip_google_access = true
}

# ============================================
# CLOUD DNS (após configurar domínio)
# ============================================
resource "google_dns_managed_zone" "meudiva_zone" {
  count = var.environment == "prod" && var.domain_name != "" ? 1 : 0
  
  name        = "meudiva-zone"
  dns_name    = "${var.domain_name}."
  description = "Zona DNS do Meu Divã"
}

# ============================================
# SECRET MANAGER (secrets iniciais)
# ============================================
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret-${var.environment}"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_version" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}