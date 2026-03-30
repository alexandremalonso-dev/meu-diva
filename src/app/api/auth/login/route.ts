import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: Request) {
  console.log("📡 [Proxy Login] Requisição recebida")
  
  try {
    const body = await req.json()
    console.log("📦 [Proxy Login] Body:", { email: body.email })

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log("📥 [Proxy Login] Resposta do backend:", data)

    if (!response.ok) {
      console.error("❌ [Proxy Login] Erro backend:", data)
      return NextResponse.json(data, { status: response.status })
    }

    // Verificar se tem tokens
    if (!data.access_token || !data.refresh_token) {
      console.error("❌ [Proxy Login] Tokens ausentes na resposta")
      return NextResponse.json(
        { error: "Resposta inválida do servidor" },
        { status: 500 }
      )
    }

    // RETORNAR OS TOKENS NO CORPO DA RESPOSTA
    const res = NextResponse.json({ 
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    })

    // Access Token Cookie
    res.cookies.set("access_token", data.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30, // 30 minutos
    })

    // Refresh Token Cookie
    res.cookies.set("refresh_token", data.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    })

    console.log("✅ [Proxy Login] Tokens retornados no corpo e cookies setados")
    return res

  } catch (error) {
    console.error("❌ [Proxy Login] Erro interno:", error)
    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    )
  }
}