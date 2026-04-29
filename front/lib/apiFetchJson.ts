export async function apiFetchJson(
  path: string,
  options: RequestInit = {}
) {
  let token = typeof window !== "undefined" ? localStorage.getItem('access_token') : null

  console.log(`📡 apiFetchJson: ${path}`, token ? '🔑 Com token' : '❌ Sem token')

  const buildHeaders = (token?: string): HeadersInit => ({
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })

  // ✅ URL relativa — Next.js rewrites fazem o proxy para o backend correto
  const url = path

  async function doFetch(currentToken?: string) {
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: buildHeaders(currentToken),
    })
  }

  try {
    let res = await doFetch(token ?? undefined)

    console.log("📥 Status:", res.status)

    // =========================
    // 🔄 TENTAR REFRESH
    // =========================
    if (res.status === 401) {
      console.warn("🔄 Token expirado, tentando refresh...")

      const refreshRes = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      })

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()

        console.log("✅ Refresh OK")

        localStorage.setItem("access_token", refreshData.access_token)

        res = await doFetch(refreshData.access_token)
      } else {
        console.error("❌ Refresh falhou")

        localStorage.removeItem("access_token")

        window.location.href = "/login"

        throw new Error("Sessão expirada")
      }
    }

    if (!res.ok) {
      const errorText = await res.text()
      console.error("❌ Erro:", errorText)
      throw new Error(`Erro ${res.status}: ${errorText}`)
    }

    const data = await res.json()
    console.log("✅ Resposta:", data)

    return data

  } catch (error) {
    console.error("❌ Erro no fetch:", error)
    throw error
  }
}