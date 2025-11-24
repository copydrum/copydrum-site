# Sheet Detail Page 글로벌 사이트 수정

## 🐛 문제점

글로벌 사이트 (ko/en/ja 제외)에서 Sheet Detail Page에 다음 문제가 있었습니다:

1. **Genre (장르)**: 한국어로 표시됨
2. **Difficulty (난이도)**: 한국어로 표시됨
3. **Price (가격)**: KRW로 표시됨 (이미 수정되어 있었음)
4. **"Add to Cart" 버튼 텍스트**: 한국어 "장바구니"로 표시됨
5. **버튼 비활성화**: 로그인하지 않은 사용자에게만 비활성화됨 (정상 동작)

## ✅ 수정 내용

### 1. Genre (장르) 번역

**파일**: `src/pages/sheet-detail/page.tsx`

**Before:**
```typescript
const getCategoryName = (categoryName: string | null | undefined): string => {
  if (!categoryName) return '';
  
  if (i18n.language === 'en') {
    // 영어 번역
  }
  
  if (i18n.language === 'ja') {
    // 일본어 번역
  }
  
  return categoryName; // ❌ 나머지 언어는 한국어로 반환
};
```

**After:**
```typescript
const getCategoryName = (categoryName: string | null | undefined): string => {
  if (!categoryName) return '';
  
  // ✅ 한국어 사이트: 원본 한국어 반환
  if (i18n.language === 'ko') {
    return categoryName;
  }
  
  // ✅ 영어/일본어 사이트: 기존 로직 유지
  if (i18n.language === 'en' || i18n.language === 'ja') {
    // 기존 번역 로직
  }
  
  // ✅ 나머지 모든 언어: categoriesPage.categories.* 키 사용
  const categoryMap: Record<string, string> = {
    '가요': t('categoriesPage.categories.kpop'),
    '팝': t('categoriesPage.categories.pop'),
    // ... 모든 카테고리 매핑
  };
  
  return categoryMap[categoryName] || categoryName;
};
```

### 2. Difficulty (난이도) 번역

**파일**: `src/pages/sheet-detail/page.tsx`

**Before:**
```typescript
const getDifficultyDisplayText = (difficulty: string) => {
  // USD/JPY만 처리하고 나머지는 한국어로 반환
  if (currency === 'USD' || i18n.language === 'en') {
    // 영어 번역
  }
  
  if (currency === 'JPY' || i18n.language === 'ja') {
    // 일본어 번역
  }
  
  // ❌ 나머지 언어는 한국어로 반환
  return difficulty;
};
```

**After:**
```typescript
const getDifficultyDisplayText = (difficulty: string) => {
  if (!difficulty) return t('sheetDetail.difficulty.notSet');
  
  // ✅ 한국어 사이트: 원본 한글 값 그대로 반환
  if (i18n.language === 'ko') {
    return difficulty;
  }
  
  // ✅ 영어/일본어 사이트: 기존 로직 유지
  if (i18n.language === 'en' || i18n.language === 'ja') {
    // 기존 번역 로직
  }
  
  // ✅ 나머지 모든 언어: i18n 키 사용
  const difficultyMap: Record<string, string> = {
    '초급': 'beginner',
    '중급': 'intermediate',
    '고급': 'advanced',
  };
  
  const mappedKey = difficultyMap[normalizedDifficulty] || difficultyMap[difficulty];
  if (mappedKey) {
    const translated = t(`sheetDetail.difficulty.${mappedKey}`);
    if (translated !== `sheetDetail.difficulty.${mappedKey}`) {
      return translated;
    }
  }
  
  // 영어 값인 경우 직접 번역
  switch (normalizedDifficulty) {
    case 'beginner':
      return t('sheetDetail.difficulty.beginner');
    case 'intermediate':
      return t('sheetDetail.difficulty.intermediate');
    case 'advanced':
      return t('sheetDetail.difficulty.advanced');
    default:
      return difficulty;
  }
};
```

### 3. 버튼 텍스트 번역

**파일**: `src/pages/sheet-detail/page.tsx`

**Before:**
```typescript
<span>{isInCart(sheet.id) ? t('categories.alreadyInCart') : t('categories.addToCart')}</span>
// ❌ categories.addToCart는 일부 언어에만 존재

<span>{buyingNow ? (t('sheet.buyNowProcessing') || '처리 중...') : t('sheet.buyNow')}</span>
// ❌ sheet.buyNow는 일부 언어에만 존재
```

**After:**
```typescript
<span>{isInCart(sheet.id) ? t('categoriesPage.alreadyPurchasedGeneric') || t('categories.alreadyInCart') : t('categoriesPage.addToCart')}</span>
// ✅ categoriesPage.addToCart는 모든 언어에 존재

<span>{buyingNow ? (t('sheetDetail.purchaseProcessing') || t('sheet.buyNowProcessing') || '처리 중...') : t('categoriesPage.buyNow')}</span>
// ✅ categoriesPage.buyNow는 모든 언어에 존재
```

### 4. 가격 표시

**이미 수정되어 있었음**: `formatCurrency` 함수를 사용하여 사이트 통화로 변환 및 표시

```typescript
const formatCurrency = (value: number) => {
  const convertedAmount = convertFromKrw(value, currency);
  return formatCurrencyUtil(convertedAmount, currency);
};

// 사용
<span className="text-3xl font-bold text-blue-600">
  {formatCurrency(displayPrice)}
</span>
```

### 5. 버튼 비활성화 조건

**정상 동작**: 로그인하지 않은 사용자에게만 비활성화됨

```typescript
disabled={!user || isInCart(sheet.id)}  // Add to Cart
disabled={!user || buyingNow}           // Buy Now
```

사이트 언어나 통화와 관련된 비활성화 조건은 없습니다.

## 📝 수정된 파일 목록

1. **`src/pages/sheet-detail/page.tsx`**
   - `getCategoryName` 함수: 모든 언어 지원
   - `getDifficultyDisplayText` 함수: 모든 언어 지원
   - 버튼 텍스트: `categoriesPage.addToCart`, `categoriesPage.buyNow` 사용

## 🔍 주요 코드 변경사항

### getCategoryName 함수

```typescript
// ✅ Before: en/ja만 처리
if (i18n.language === 'en') { /* ... */ }
if (i18n.language === 'ja') { /* ... */ }
return categoryName; // ❌ 나머지 언어는 한국어

// ✅ After: 모든 언어 지원
if (i18n.language === 'ko') return categoryName;
if (i18n.language === 'en' || i18n.language === 'ja') { /* 기존 로직 */ }
// ✅ 나머지 언어: categoriesPage.categories.* 키 사용
```

### getDifficultyDisplayText 함수

```typescript
// ✅ Before: USD/JPY만 처리
if (currency === 'USD' || i18n.language === 'en') { /* ... */ }
if (currency === 'JPY' || i18n.language === 'ja') { /* ... */ }
return difficulty; // ❌ 나머지 언어는 한국어

// ✅ After: 모든 언어 지원
if (i18n.language === 'ko') return difficulty;
if (i18n.language === 'en' || i18n.language === 'ja') { /* 기존 로직 */ }
// ✅ 나머지 언어: sheetDetail.difficulty.* 키 사용
```

### 버튼 텍스트

```typescript
// ✅ Before: 일부 언어에만 존재하는 키 사용
t('categories.addToCart')
t('sheet.buyNow')

// ✅ After: 모든 언어에 존재하는 키 사용
t('categoriesPage.addToCart')
t('categoriesPage.buyNow')
```

## 🧪 테스트 방법

### 1. 프랑스어 사이트 (fr.copydrum.com)

1. Sheet Detail Page로 이동
2. **Genre**: 프랑스어로 표시되는지 확인 (예: "Pop", "Rock")
3. **Difficulty**: 프랑스어로 표시되는지 확인 (예: "Débutant", "Intermédiaire")
4. **Price**: EUR로 표시되는지 확인 (예: "€2.50")
5. **"Add to Cart" 버튼**: "Ajouter au panier"로 표시되는지 확인
6. **"Buy Now" 버튼**: "Acheter maintenant"로 표시되는지 확인
7. **버튼 활성화**: 로그인한 사용자는 버튼이 활성화되어 있어야 함

### 2. 스페인어 사이트 (es.copydrum.com)

1. Sheet Detail Page로 이동
2. **Genre**: 스페인어로 표시되는지 확인
3. **Difficulty**: 스페인어로 표시되는지 확인 (예: "Principiante", "Intermedio")
4. **Price**: USD로 표시되는지 확인
5. **버튼 텍스트**: 스페인어로 표시되는지 확인

### 3. 베트남어 사이트 (vi.copydrum.com)

1. Sheet Detail Page로 이동
2. **Genre**: 베트남어로 표시되는지 확인
3. **Difficulty**: 베트남어로 표시되는지 확인 (예: "Người mới bắt đầu", "Trung cấp")
4. **Price**: USD로 표시되는지 확인
5. **버튼 텍스트**: 베트남어로 표시되는지 확인

### 4. 중국어 간체 사이트 (zh-cn.copydrum.com)

1. Sheet Detail Page로 이동
2. **Genre**: 중국어로 표시되는지 확인
3. **Difficulty**: 중국어로 표시되는지 확인 (예: "初级", "中级")
4. **Price**: USD로 표시되는지 확인
5. **버튼 텍스트**: 중국어로 표시되는지 확인

### 5. 한국어/영어/일본어 사이트 확인

1. **한국어 사이트 (copydrum.com)**: 기존과 동일하게 작동하는지 확인
2. **영어 사이트 (en.copydrum.com)**: 기존과 동일하게 작동하는지 확인
3. **일본어 사이트 (jp.copydrum.com)**: 기존과 동일하게 작동하는지 확인

## ✅ 체크리스트

- [x] `getCategoryName` 함수를 모든 언어 지원하도록 수정
- [x] `getDifficultyDisplayText` 함수를 모든 언어 지원하도록 수정
- [x] 버튼 텍스트를 `categoriesPage.addToCart`, `categoriesPage.buyNow`로 변경
- [x] 가격 표시 확인 (이미 `formatCurrency` 사용 중)
- [x] 버튼 disabled 조건 확인 (정상 동작)
- [x] 한국어/영어/일본어 사이트 동작 확인 (변경 없음)

## 📚 관련 파일

- `src/pages/sheet-detail/page.tsx` - Sheet Detail Page
- `src/i18n/locales/*/categoriesPage.json` - 카테고리 번역 키
- `src/i18n/locales/*/sheetDetail.json` - 난이도 번역 키
- `src/lib/currency.ts` - 통화 변환 유틸리티

