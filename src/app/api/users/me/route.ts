import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  console.log("📡 [Proxy User] Requisição recebida");
  
  try {
    // Pegar o token do cookie
    const accessToken = req.cookies.get("access_token")?.value;
    
    console.log("🔑 [Proxy User] Token presente:", !!accessToken);
    
    if (!accessToken) {
      console.log("❌ [Proxy User] Token não encontrado");
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    
    // Fazer requisição para o backend
    const response = await fetch(`${BACKEND_URL}/api/users/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    const data = await response.json();
    console.log("📥 [Proxy User] Resposta do backend:", response.status);
    
    if (!response.ok) {
      console.error("❌ [Proxy User] Erro backend:", data);
      return NextResponse.json(data, { status: response.status });
    }
    
    console.log("✅ [Proxy User] Usuário encontrado:", data.email);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("❌ [Proxy User] Erro interno:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    );
  }
}