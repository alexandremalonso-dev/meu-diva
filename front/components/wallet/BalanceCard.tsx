"use client";
import { useEffect, useState } from 'react';
import { Wallet, Coins, ChevronDown, ChevronUp } from 'lucide-react';

interface BalanceCardProps {
  initialBalance?: {
    balance: number;
    currency: string;
    formatted: string;
  };
  onRefresh?: () => void;
  userRole: 'patient' | 'therapist';
  onExpand?: () => void;  // 🔥 NOVO: callback para expandir
  isExpanded?: boolean;   // 🔥 NOVO: estado de expansão
}

// 🔥 FUNÇÃO QUE FORÇA 2 CASAS DECIMAIS
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export function BalanceCard({ 
  initialBalance, 
  onRefresh, 
  userRole, 
  onExpand, 
  isExpanded = false 
}: BalanceCardProps) {
  const title = userRole === 'patient' ? 'Meus créditos' : 'Saldo a receber';
  // 🔥 AMBOS OS PERFIS USAM AZUL
  const gradientFrom = 'from-[#2F80D3]';
  const gradientTo = 'to-[#2F80D3]/80';

  // 🔥 ESTADO PARA GARANTIR FORMATAÇÃO CORRETA
  const [displayValue, setDisplayValue] = useState<string>('R$ 0,00');

  useEffect(() => {
    if (initialBalance?.balance !== undefined) {
      setDisplayValue(formatCurrency(initialBalance.balance));
    } else {
      setDisplayValue(userRole === 'patient' ? 'R$ 0,00' : 'R$ 0,00');
    }
  }, [initialBalance, userRole]);

  const handleClick = () => {
    if (onExpand) {
      onExpand();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-white/80">{title}</p>
        {userRole === 'patient' ? (
          <Coins className="w-6 h-6 text-white/80" />
        ) : (
          <Wallet className="w-6 h-6 text-white/80" />
        )}
      </div>
      {/* 🔥 EXIBE COM 2 CASAS DECIMAIS */}
      <p className="text-3xl font-bold mb-4">{displayValue}</p>
      <p className="text-sm text-white/80 flex items-center gap-1">
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>Fechar</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>Clique para adicionar créditos</span>
          </>
        )}
      </p>
    </div>
  );
}