import { createPendingOrder } from './orderUtils';
import {
  createInicisPaymentIntent,
  ensureInicisSdkLoaded,
  submitInicisPaymentForm,
} from './inicis';
import type { PaymentIntentResponse, PaymentStatus, VirtualAccountInfo } from './types';
import { createPayactionVirtualAccount } from './payaction';

type SupportedChargeMethod = 'card' | 'bank_transfer';

interface StartCashChargeParams {
  userId: string;
  amount: number;
  bonusAmount?: number;
  paymentMethod: SupportedChargeMethod;
  description: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerTel?: string | null;
  depositorName?: string;
  returnUrl?: string;
}

interface StartCashChargeResult {
  orderId: string;
  orderNumber: string | null;
  amount: number;
  paymentMethod: SupportedChargeMethod;
  paymentIntent?: PaymentIntentResponse;
  virtualAccountInfo?: VirtualAccountInfo | null;
}

const mapToPaymentStatus = (method: SupportedChargeMethod): PaymentStatus =>
  method === 'bank_transfer' ? 'awaiting_deposit' : 'pending';

export const startCashCharge = async ({
  userId,
  amount,
  bonusAmount = 0,
  paymentMethod,
  description,
  buyerName,
  buyerEmail,
  buyerTel,
  depositorName,
  returnUrl,
}: StartCashChargeParams): Promise<StartCashChargeResult> => {
  const { orderId, orderNumber } = await createPendingOrder({
    userId,
    amount,
    paymentMethod,
    description,
    paymentStatus: mapToPaymentStatus(paymentMethod),
    metadata: {
      type: 'cash_charge',
      bonusAmount,
    },
  });

  if (paymentMethod === 'bank_transfer') {
    const resolvedDepositor =
      depositorName ??
      (orderNumber ? `CD${orderNumber.slice(-6)}` : undefined);

    const intent = await createPayactionVirtualAccount({
      userId,
      amount,
      description,
      method: 'bank_transfer',
      orderId,
      bonusAmount,
      depositorName: resolvedDepositor,
    });

    return {
      orderId,
      orderNumber,
      amount,
      paymentMethod,
      paymentIntent: intent,
      virtualAccountInfo: intent.virtualAccountInfo ?? null,
    };
  }

  const intent = await createInicisPaymentIntent({
    userId,
    amount,
    description,
    method: 'card',
    orderId,
    bonusAmount,
    returnUrl,
    buyerName: buyerName ?? undefined,
    buyerEmail: buyerEmail ?? undefined,
    buyerTel: buyerTel ?? undefined,
  });

  if (intent.requestForm) {
    await ensureInicisSdkLoaded();
    submitInicisPaymentForm(intent.requestForm);
  }

  return {
    orderId,
    orderNumber,
    amount,
    paymentMethod,
    paymentIntent: intent,
  };
};

