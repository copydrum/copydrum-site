/**
 * 포인트 가격 계산 유틸리티
 * 
 * 정책:
 * - point_price_raw = price_krw * 0.85
 * - point_price = Math.floor(point_price_raw / 100) * 100 (100P 단위 내림 처리)
 * 
 * @param priceKRW KRW 가격
 * @returns 포인트 가격 (100P 단위로 내림 처리된 값)
 */
export function calculatePointPrice(priceKRW: number): number {
  const pointPriceRaw = priceKRW * 0.85;
  return Math.floor(pointPriceRaw / 100) * 100;
}

