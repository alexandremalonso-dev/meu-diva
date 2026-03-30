import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Buscar saldo da wallet
    const saldoRes = await fetch("http://localhost:8000/wallet/balance", {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Buscar transações
    const transacoesRes = await fetch("http://localhost:8000/wallet/transactions", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const saldo = await saldoRes.json();
    const transacoes = await transacoesRes.json();

    return NextResponse.json({
      balance: saldo.balance || 0,
      transactions: Array.isArray(transacoes) ? transacoes : []
    });
  } catch (error) {
    console.error("Erro wallet:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}