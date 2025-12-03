# 구매내역 주문 필터링 개선 완료 보고서

## 개요

고객 마이페이지의 구매내역(주문내역) 리스트에서 결제 완료된 주문만 기본적으로 표시하도록 개선했습니다. 결제 대기 주문은 별도 탭에서 확인할 수 있습니다.

## 수정된 파일 목록

### 1. `src/pages/my-orders/page.tsx`

#### 주요 변경사항:
- **payment_status 필터링 추가**: 기본 탭에서는 `payment_status = 'paid'`인 주문만 표시
- **order_type 필터링 추가**: `order_type = 'product'`이거나 order_items가 있는 주문만 표시 (악보 구매만)
- **탭 기능 추가**: "다운로드 가능" (결제 완료) / "결제 대기" (결제 미완료) 탭 추가
- **쿼리 개선**: `order_type` 필드 추가하여 악보 구매 주문만 필터링

#### 필터링 조건:
```typescript
// 기본 탭 (결제 완료)
.eq('user_id', currentUser.id)
.eq('payment_status', 'paid')
// 클라이언트 사이드에서 order_type = 'product' 또는 order_items가 있는 주문만 필터링

// 결제 대기 탭
.eq('user_id', currentUser.id)
.or('payment_status.neq.paid,payment_status.is.null')
// 클라이언트 사이드에서 order_type = 'product' 또는 order_items가 있는 주문만 필터링
```

#### 추가된 상태:
- `paymentStatusFilter`: `'paid' | 'pending'` - 현재 선택된 탭 상태

#### UI 변경:
- 탭 버튼 추가: "다운로드 가능" / "결제 대기"
- 탭 전환 시 주문 목록 자동 갱신

### 2. `src/pages/mypage/page.tsx`

#### 주요 변경사항:
- **payment_status 필터링 추가**: `payment_status = 'paid'`인 주문만 표시
- **order_type 필터링 추가**: 클라이언트 사이드에서 악보 구매 주문만 필터링
- **쿼리 개선**: `order_type` 필드 추가

#### 필터링 조건:
```typescript
.eq('user_id', currentUser.id)
.eq('payment_status', 'paid')  // 결제 완료된 주문만
// 클라이언트 사이드에서 order_type = 'product' 또는 order_items가 있는 주문만 필터링
```

### 3. `src/components/purchase/PurchaseHistoryContent.tsx`

#### 주요 변경사항:
- **payment_status 필터링 추가**: `payment_status = 'paid'`인 주문만 표시
- **order_type 필터링 추가**: 클라이언트 사이드에서 악보 구매 주문만 필터링
- **쿼리 개선**: `payment_status`, `order_type` 필드 추가

#### 필터링 조건:
```typescript
.eq('user_id', user.id)
.eq('payment_status', 'paid')  // 결제 완료된 주문만
// 클라이언트 사이드에서 order_type = 'product' 또는 order_items가 있는 주문만 필터링
```

## 필터링 로직 상세

### 서버 사이드 필터링 (Supabase 쿼리)

1. **사용자 필터링**: `user_id = 현재 로그인 유저`
2. **결제 상태 필터링**:
   - 기본 탭: `payment_status = 'paid'`
   - 결제 대기 탭: `payment_status != 'paid' OR payment_status IS NULL`

### 클라이언트 사이드 필터링

1. **order_items 존재 확인**: `order_items.length > 0`
2. **order_type 확인**: `order_type === 'product'` 또는 `order_type`이 없는 경우 (기존 주문 호환성)

## UI 변경사항

### `src/pages/my-orders/page.tsx`

- 탭 UI 추가:
  ```tsx
  <div className="mt-4 flex gap-2 border-b border-gray-200">
    <button onClick={() => setPaymentStatusFilter('paid')}>
      다운로드 가능
    </button>
    <button onClick={() => setPaymentStatusFilter('pending')}>
      결제 대기
    </button>
  </div>
  ```

## 동작 방식

### 기본 동작 (결제 완료 탭)

1. 사용자가 마이페이지 구매내역에 접속
2. `payment_status = 'paid'`인 주문만 쿼리
3. 클라이언트에서 `order_type = 'product'` 또는 `order_items`가 있는 주문만 필터링
4. 다운로드 가능한 주문 목록 표시

### 결제 대기 탭

1. 사용자가 "결제 대기" 탭 클릭
2. `payment_status != 'paid'`인 주문만 쿼리
3. 클라이언트에서 `order_type = 'product'` 또는 `order_items`가 있는 주문만 필터링
4. 결제가 완료되지 않은 주문 목록 표시

## 영향 범위

- ✅ 기존 다운로드 기능 유지
- ✅ 기존 환불/제한 경고 팝업 로직 유지
- ✅ 기존 주문 상태 표시 로직 유지
- ✅ 기존 주문 항목 선택/다운로드 기능 유지

## 테스트 시나리오

1. **결제 완료 주문 확인**:
   - 결제 완료된 주문이 "다운로드 가능" 탭에 표시되는지 확인
   - 다운로드 버튼이 정상 작동하는지 확인

2. **결제 대기 주문 확인**:
   - 결제가 완료되지 않은 주문이 "결제 대기" 탭에 표시되는지 확인
   - 탭 전환이 정상 작동하는지 확인

3. **필터링 확인**:
   - `order_type != 'product'`인 주문(예: 캐시 충전)이 표시되지 않는지 확인
   - `order_items`가 없는 주문이 표시되지 않는지 확인

## 주의사항

1. **기존 주문 호환성**: `order_type`이 없는 기존 주문도 `order_items` 존재 여부로 판단하여 표시됨
2. **캐시 충전 주문**: `order_type = 'cash'`인 주문은 구매내역에 표시되지 않음
3. **RLS 정책**: 기존 RLS 정책과 함께 이중 보안 적용 유지

## 향후 개선 사항

- [ ] 탭 번역 키 추가 (현재 하드코딩된 한국어 텍스트)
- [ ] 결제 대기 주문의 재결제 기능 추가
- [ ] 주문 상태별 정렬 옵션 추가







