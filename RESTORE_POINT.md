# PONTO DE RESTAURAÇÃO - Meu Divã

## 📅 Data
25/03/2026 11:23:41

## ✅ Estado Funcional Confirmado

### Autenticação
- Login funcionando com localStorage (access_token)
- Refresh token via cookie httpOnly
- Redirecionamento correto por role (patient, therapist, admin)
- Logout funcional

### Layouts
- Cabeçalho rosa (#E03673) com altura 128px
- Rodapé azul (#2F80D3)
- Sem duplicidade de cabeçalho/rodapé
- Título dinâmico no cabeçalho
- Ícone de casa para voltar ao dashboard

### Dashboards
- Dashboard do paciente (/patient/dashboard) - funcional
- Dashboard do terapeuta (/therapist/dashboard) - funcional
- Cards estatísticos
- Calendário com eventos
- Lista de sessões

### APIs Proxy
- /api/auth/login - retorna token e user
- /api/users/me - autentica via header Authorization
- Interceptor 401 com refresh token

## 🔄 Como Restaurar

### Restaurar para este ponto:
```bash
git reset --hard HEAD

