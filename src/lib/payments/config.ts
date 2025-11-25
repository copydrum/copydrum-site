export interface InicisConfig {
  mid: string;
  apiKey: string;
  merchantKey: string;
  signKey?: string;
}

export interface PayactionConfig {
  userId: string;
  apiKey: string;
}

const requireEnv = (value: string | undefined, key: string) => {
  if (!value) {
    throw new Error(`환경 변수가 설정되지 않았습니다: ${key}`);
  }
  return value;
};

export const getInicisConfig = (): InicisConfig => {
  const mid = requireEnv(import.meta.env.VITE_INICIS_MID, 'VITE_INICIS_MID');
  const apiKey = requireEnv(import.meta.env.VITE_INICIS_API_KEY, 'VITE_INICIS_API_KEY');
  const merchantKey = requireEnv(import.meta.env.VITE_INICIS_MERCHANT_KEY, 'VITE_INICIS_MERCHANT_KEY');

  return {
    mid,
    apiKey,
    merchantKey,
    signKey: import.meta.env.VITE_INICIS_SIGN_KEY,
  };
};

export const getPayactionConfig = (): PayactionConfig => {
  const userId = requireEnv(import.meta.env.VITE_PAYACTION_USER_ID, 'VITE_PAYACTION_USER_ID');
  const apiKey = requireEnv(import.meta.env.VITE_PAYACTION_API_KEY, 'VITE_PAYACTION_API_KEY');
  return {
    userId,
    apiKey,
  };
};

















