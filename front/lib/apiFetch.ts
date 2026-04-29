export async function apiFetch(
  url: string,
  options: RequestInit = {}
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  // 🔥 headers seguros (evita problemas de tipagem)
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // 🔐 INJETAR TOKEN
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  console.log(`📡 apiFetch: ${url}`);
  console.log("🔑 Token enviado:", token ? "SIM" : "NÃO");

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // =========================
  // 🔄 REFRESH TOKEN
  // =========================
  if (response.status === 401) {
    console.warn("🔄 401 detectado → tentando refresh...");

    try {
      const refresh = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (refresh.ok) {
        console.log("✅ Token renovado via refresh");

        const data = await refresh.json();

        if (data?.access_token) {
          localStorage.setItem("access_token", data.access_token);

          // 🔥 atualizar header com novo token
          headers.set("Authorization", `Bearer ${data.access_token}`);
        }

        // 🔁 retry da request original
        response = await fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      } else {
        throw new Error("Refresh falhou");
      }
    } catch (err) {
      console.error("❌ Erro no refresh:", err);

      // 🔥 limpeza completa
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      // 🔥 limpar cookies (fallback)
      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }

      window.location.href = "/login";
      throw err;
    }
  }

  // =========================
  // ❌ TRATAMENTO DE ERRO
  // =========================
  if (!response.ok) {
    let errorMessage = `Erro ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage =
        errorData?.detail ||
        errorData?.error ||
        errorData?.message ||
        errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {}
    }

    console.error("❌ API ERROR:", errorMessage);

    throw new Error(errorMessage);
  }

  // =========================
  // 📦 RETORNO PADRÃO
  // =========================
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}