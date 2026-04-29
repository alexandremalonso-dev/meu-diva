"use client";

interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  meta_data?: any;
}

interface TransactionListProps {
  transactions: Transaction[];
  filter: string;
  userRole: 'patient' | 'therapist';
  onFilterChange?: (filter: string) => void;
}

// 🔥 FUNÇÃO DE FORMATAÇÃO DE DATA NATIVA (SEM BIBLIOTECAS EXTERNAS)
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  
  // Formato: DD/MM/YYYY às HH:MM
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
};

// 🔥 FUNÇÃO DE FORMATAÇÃO COM 2 CASAS DECIMAIS
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const getTransactionIcon = (type: string): string => {
  switch (type) {
    case 'credit_purchase':
      return '💰';
    case 'session_debit':
      return '📅';
    case 'refund':
    case 'cancellation_refund':
      return '↩️';
    case 'no_show_debit':
      return '❌';
    default:
      return '💳';
  }
};

const getTransactionTitle = (type: string): string => {
  switch (type) {
    case 'credit_purchase':
      return 'Compra de créditos';
    case 'session_debit':
      return 'Sessão agendada';
    case 'refund':
      return 'Reembolso';
    case 'cancellation_refund':
      return 'Cancelamento';
    case 'no_show_debit':
      return 'Não comparecimento';
    default:
      return 'Transação';
  }
};

// 🔥 FUNÇÃO PARA DETERMINAR O SINAL CORRETO DA TRANSAÇÃO
const getAmountSign = (transaction: Transaction): string => {
  // Tipos que são débitos (diminuem o saldo)
  const debitTypes = ['session_debit', 'no_show_debit'];
  // Tipos que são créditos (aumentam o saldo)
  const creditTypes = ['credit_purchase', 'topup', 'cancellation_refund', 'refund'];
  
  if (debitTypes.includes(transaction.transaction_type)) {
    return '-';
  } else if (creditTypes.includes(transaction.transaction_type)) {
    return '+';
  }
  // Fallback: usar o sinal do amount
  return transaction.amount > 0 ? '+' : '-';
};

// 🔥 OPÇÕES DE FILTRO
const filterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'credit_purchase', label: 'Créditos' },
  { value: 'session_debit', label: 'Pagamentos' },
  { value: 'cancellation_refund', label: 'Reembolsos' },
];

export function TransactionList({ 
  transactions, 
  filter, 
  userRole, 
  onFilterChange 
}: TransactionListProps) {
  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.transaction_type === filter);

  if (filteredTransactions.length === 0) {
    return (
      <div>
        {/* 🔥 FILTROS MESMO QUANDO VAZIO */}
        <div className="flex gap-2 mb-4 border-b pb-3">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange?.(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === option.value
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-gray-500 text-center py-8">
          Nenhuma transação encontrada.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 🔥 FILTROS */}
      <div className="flex gap-2 mb-4 border-b pb-3">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange?.(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === option.value
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 🔥 LISTA DE TRANSAÇÕES */}
      <div className="space-y-4">
        {filteredTransactions.map((transaction) => {
          const amountSign = getAmountSign(transaction);
          const amountValue = Math.abs(transaction.amount);
          
          return (
            <div
              key={transaction.id}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="text-2xl">{getTransactionIcon(transaction.transaction_type)}</div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900">
                    {getTransactionTitle(transaction.transaction_type)}
                  </h3>
                  <span className={`font-semibold ${
                    amountSign === '+' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {amountSign}{formatCurrency(amountValue)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-1">
                  {formatDate(transaction.created_at)}
                </p>
                
                {transaction.description && (
                  <p className="text-sm text-gray-500">{transaction.description}</p>
                )}
                
                <p className="text-xs text-gray-400 mt-2">
                  Saldo: {formatCurrency(transaction.balance_after)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}