# 🔐 Secrets do GitHub Actions - Meu Divã

Este documento lista todas as secrets que precisam ser configuradas no GitHub Actions para o deploy automático.

## 📋 Non-Prod (Desenvolvimento)

| Secret Name | Descrição | Onde obter |
|-------------|-----------|------------|
| `GCP_PROJECT_ID_NON_PROD` | ID do projeto GCP non-prod | Console GCP |
| `GCP_SA_KEY_NON_PROD` | Chave JSON da Service Account | IAM → Service Accounts → Criar chave |
| `DB_URL_NON_PROD` | URL do banco de dados PostgreSQL | Cloud SQL → Connections |
| `JWT_SECRET` | Chave secreta para JWT | Gerar com: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe | Dashboard Stripe → Developers → API keys |
| `GOOGLE_CLIENT_ID` | Client ID do Google OAuth | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google OAuth | Google Cloud Console → APIs & Services → Credentials |
| `MICROSOFT_CLIENT_ID` | Client ID da Microsoft OAuth | Azure Portal → App Registrations |
| `MICROSOFT_CLIENT_SECRET` | Client Secret da Microsoft OAuth | Azure Portal → App Registrations |
| `SMTP_HOST` | Host do servidor SMTP | SendGrid/Outlook/Gmail |
| `SMTP_USER` | Usuário do SMTP | Configuração de e-mail |
| `SMTP_PASSWORD` | Senha do SMTP | Configuração de e-mail |
| `FROM_EMAIL` | E-mail remetente | contato@meudivaonline.com |

## 📋 Prod (Produção)

| Secret Name | Descrição | Onde obter |
|-------------|-----------|------------|
| `GCP_PROJECT_ID_PROD` | ID do projeto GCP prod | Console GCP |
| `GCP_SA_KEY_PROD` | Chave JSON da Service Account | IAM → Service Accounts → Criar chave |
| `DB_URL_PROD` | URL do banco de dados PostgreSQL | Cloud SQL → Connections |
| `SLACK_WEBHOOK` | Webhook do Slack para notificações | Slack Apps → Incoming Webhooks |

## 🚀 Como configurar

### 1. No GitHub:
1. Acesse: `Settings` → `Secrets and variables` → `Actions`
2. Clique em `New repository secret`
3. Adicione cada secret com o nome exato da tabela acima

### 2. Criar Service Account no GCP:

```bash
# Criar service account
gcloud iam service-accounts create meudiva-github-actions \
    --display-name="GitHub Actions - Meu Divã"

# Dar permissões
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:meudiva-github-actions@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudrun.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:meudiva-github-actions@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:meudiva-github-actions@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:meudiva-github-actions@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"

# Criar e baixar chave JSON
gcloud iam service-accounts keys create ~/sa-key.json \
    --iam-account=meudiva-github-actions@PROJECT_ID.iam.gserviceaccount.com