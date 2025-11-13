export type PaymentMethod = 'card' | 'kakaopay' | 'bank_transfer' | 'virtual_account' | 'cash';

export type PaymentProvider = 'inicis' | 'payaction' | 'cash';

export type PaymentStatus = 'pending' | 'awaiting_deposit' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentLineItem {
  sheetId?: string | null;
  title?: string | null;
  price: number;
  quantity?: number;
}

export interface VirtualAccountInfo {
  bankName?: string | null;
  accountNumber?: string | null;
  depositor?: string | null;
  expectedDepositor?: string | null;
  amount?: number | null;
  expiresAt?: string | null;
  message?: string | null;
  [key: string]: any;
}

export interface BasePaymentIntentRequest {
  userId: string;
  amount: number;
  description: string;
  orderId?: string;
  bonusAmount?: number;
  items?: PaymentLineItem[];
  metadata?: Record<string, unknown>;
}

export interface CardPaymentIntentRequest extends BasePaymentIntentRequest {
  method: 'card' | 'kakaopay';
  returnUrl: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
}

export interface VirtualAccountIntentRequest extends BasePaymentIntentRequest {
  method: 'bank_transfer' | 'virtual_account';
  depositorName: string;
  bankName?: string;
}

export interface CashPaymentIntentRequest extends BasePaymentIntentRequest {
  method: 'cash';
}

export type PaymentIntentRequest =
  | CardPaymentIntentRequest
  | VirtualAccountIntentRequest
  | CashPaymentIntentRequest;

export interface PaymentIntentResponse {
  paymentUrl?: string;
  paymentId?: string;
  transactionId?: string;
  expiresAt?: string | null;
  requestForm?: {
    action: string;
    method: 'POST' | 'GET';
    inputs: Record<string, string>;
  };
  virtualAccountInfo?: VirtualAccountInfo | null;
  additionalData?: Record<string, unknown>;
}

export interface PaymentApprovalPayload {
  orderId: string;
  paymentProvider: PaymentProvider;
  transactionId: string;
  amount: number;
  approvedAt?: string | null;
  rawResponse?: unknown;
}

export interface PaymentCancelPayload {
  orderId: string;
  paymentProvider: PaymentProvider;
  transactionId: string;
  reason?: string;
  rawResponse?: unknown;
}

export interface PaymentTransactionLog {
  orderId: string;
  userId: string;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  amount: number;
  status: PaymentStatus;
  pgTransactionId?: string | null;
  rawRequest?: unknown;
  rawResponse?: unknown;
}

