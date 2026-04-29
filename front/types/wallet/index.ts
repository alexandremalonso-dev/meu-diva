export interface Wallet {
  id: number;
  patient_id: number;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  formatted: string;
}

export interface LedgerEntry {
  id: number;
  wallet_id: number;
  appointment_id?: number;
  transaction_type: 'credit_purchase' | 'session_debit' | 'refund' | 'adjustment' | 'no_show_debit' | 'cancellation_refund';
  amount: number;
  balance_after: number;
  description?: string;
  meta_data?: any;
  created_at: string;
}

export interface WalletWithTransactions {
  id: number;
  patient_id: number;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
  recent_transactions: LedgerEntry[];
}

export interface TopUpRequest {
  amount: number;
  payment_method?: string;
}

export interface TopUpResponse {
  payment_id: number;
  checkout_url?: string;
  amount: number;
  status: string;
}

// Tipos de transação para exibição
export const TransactionTypeLabels: Record<string, string> = {
  credit_purchase: 'Compra de créditos',
  session_debit: 'Sessão realizada',
  refund: 'Reembolso',
  adjustment: 'Ajuste manual',
  no_show_debit: 'Não comparecimento',
  cancellation_refund: 'Reembolso por cancelamento'
};

export const TransactionTypeIcons: Record<string, string> = {
  credit_purchase: '💰',
  session_debit: '📅',
  refund: '↩️',
  adjustment: '⚙️',
  no_show_debit: '❌',
  cancellation_refund: '🔄'
};