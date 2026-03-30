Write-Host "🚀 Corrigindo rotas..." -ForegroundColor Cyan

$basePath = "C:\meu-diva\front\src\app"

# Remover /login
$loginPath = "$basePath\login"
if (Test-Path $loginPath) {
    Remove-Item -Recurse -Force $loginPath
    Write-Host "🧹 /login removido"
}

# Criar /auth/login
$authLoginPath = "$basePath\auth\login"
New-Item -ItemType Directory -Path $authLoginPath -Force | Out-Null

# Criar página login
$pageFile = "$authLoginPath\page.tsx"

@"
"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

export default function LoginPage() {
  const { login } = useAuth()

  const [email, setEmail] = useState("patient92@test.com")
  const [password, setPassword] = useState("123456")

  const handleSubmit = async (e) => {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit}>
        <input value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Entrar</button>
      </form>
    </div>
  )
}
"@ | Out-File -Encoding utf8 $pageFile

# Ajustar redirects
(Get-Content "$basePath\(app)\layout.tsx") -replace '"/login"', '"/auth/login"' | Set-Content "$basePath\(app)\layout.tsx"
(Get-Content "C:\meu-diva\front\src\contexts\AuthContext.tsx") -replace '"/login"', '"/auth/login"' | Set-Content "C:\meu-diva\front\src\contexts\AuthContext.tsx"

# Limpar .next
Remove-Item -Recurse -Force "C:\meu-diva\front\.next" -ErrorAction SilentlyContinue

Write-Host "✅ Pronto! Rode npm run dev" -ForegroundColor Green