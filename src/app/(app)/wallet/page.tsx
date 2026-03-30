"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Transaction = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
  appointment_id?: number;
};

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWallet() {
      try {
        const data = await api("/api/wallet");
        setBalance(data.balance);
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error("Erro ao carregar wallet:", error);
      } finally {
        setLoading(false);
      }
    }
    loadWallet();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Minha Carteira</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <p className="text-gray-600 text-sm">Saldo atual</p>
        <p className="text-3xl font-bold text-green-600">{formatCurrency(balance)}</p>
      </div>

      <h2 className="text-xl font-semibold mb-4">Histórico de Transações</h2>

      {transactions.length === 0 ? (
        <p className="text-gray-500">Nenhuma transação encontrada.</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <p className="font-medium">{tx.reason}</p>
                <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                {tx.appointment_id && (
                  <p className="text-xs text-gray-400">Sessão #{tx.appointment_id}</p>
                )}
              </div>
              <p className={tx.amount > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}