# Home Page Popular Sheets Genre Localization Fix

## 🐛 문제점

PC 메인 페이지의 "Popular Sheets / 인기악보" 섹션에서 글로벌 사이트(ko/en/ja 제외)에서 장르가 한국어로 표시되었습니다.

**원인:**
- 장르 필터 버튼의 `getGenreName` 함수가 `category.*` 키를 사용
- 이 키들은 모든 언어에 존재하지 않아서 글로벌 사이트에서 번역이 되지 않음
- Sheet Detail Page에서는 `categoriesPage.categories.*` 키를 사용하고 있었음

## ✅ 수정 내용

### 1. 장르 번역 로직 수정

**파일**: `src/pages/home/page.tsx`

**Before:**
```typescript
const getGenreName = (genreKo: string): string => {
  const genreMap: Record<string, string> = {
    '가요': t('category.kpop'),      // ❌ 모든 언어에 존재하지 않음
    '팝': t('category.pop'),
    '락': t('category.rock'),
    // ...
  };
  return genreMap[genreKo] || genreKo;
};
```

**After:**
```typescript
const getGenreName = (categoryName: string | null | undefined): string => {
  if (!categoryName) return '';

  // ✅ 한국어 사이트: 원본 한국어 반환
  if (i18n.language === 'ko') {
    return categoryName;
  }

  // ✅ 영어 사이트: categoriesPage.categories.* 키 사용
  if (i18n.language === 'en') {
    const categoryMap: Record<string, string> = {
      '가요': t('categoriesPage.categories.kpop'),
      '팝': t('categoriesPage.categories.pop'),
      '락': t('categoriesPage.categories.rock'),
      // ...
    };
    return categoryMap[categoryName] || categoryName;
  }

  // ✅ 일본어 사이트: category.* 키 사용 (기존 로직 유지)
  if (i18n.language === 'ja') {
    const categoryMapJa: Record<string, string> = {
      '가요': t('category.kpop'),
      '팝': t('category.pop'),
      // ...
    };
    return categoryMapJa[categoryName] || categoryName;
  }

  // ✅ 나머지 모든 언어: categoriesPage.categories.* 키 사용
  const categoryMap: Record<string, string> = {
    '가요': t('categoriesPage.categories.kpop'),
    '팝': t('categoriesPage.categories.pop'),
    '락': t('categoriesPage.categories.rock'),
    // ...
  };
  
  return categoryMap[categoryName] || categoryName;
};
```

### 2. Sheet Detail Page와 동일한 로직 사용

- Sheet Detail Page의 `getCategoryName` 함수와 동일한 패턴 적용
- 모든 언어에서 `categoriesPage.categories.*` 키 사용 (ko/en/ja는 예외 처리)
- ko/en/ja 사이트는 기존 동작 유지

## 📝 수정된 파일 목록

1. **`src/pages/home/page.tsx`**
   - 장르 필터 버튼의 `getGenreName` 함수 수정
   - Sheet Detail Page와 동일한 번역 로직 적용

## 🔍 주요 코드 변경사항

### 장르 필터 버튼 번역

**Before:**
```typescript
// ❌ category.* 키 사용 (모든 언어에 존재하지 않음)
const getGenreName = (genreKo: string): string => {
  const genreMap: Record<string, string> = {
    '가요': t('category.kpop'),
    '팝': t('category.pop'),
    // ...
  };
  return genreMap[genreKo] || genreKo;
};
```

**After:**
```typescript
// ✅ categoriesPage.categories.* 키 사용 (모든 언어에 존재)
const getGenreName = (categoryName: string | null | undefined): string => {
  if (!categoryName) return '';

  // 한국어 사이트: 원본 반환
  if (i18n.language === 'ko') {
    return categoryName;
  }

  // 영어 사이트: categoriesPage.categories.* 키 사용
  if (i18n.language === 'en') {
    // ...
  }

  // 일본어 사이트: category.* 키 사용 (기존 로직 유지)
  if (i18n.language === 'ja') {
    // ...
  }

  // 나머지 모든 언어: categoriesPage.categories.* 키 사용
  const categoryMap: Record<string, string> = {
    '가요': t('categoriesPage.categories.kpop'),
    '팝': t('categoriesPage.categories.pop'),
    // ...
  };
  
  return categoryMap[categoryName] || categoryName;
};
```

## 🧪 테스트 방법

### 1. 프랑스어 사이트 (fr.copydrum.com)

1. PC 메인 페이지로 이동
2. "Popular Sheets" 섹션으로 스크롤
3. 장르 필터 버튼 확인
4. **✅ 예상 결과**: 장르가 프랑스어로 표시됨 (예: "Pop", "Rock", "K-POP")

### 2. 스페인어 사이트 (es.copydrum.com)

1. PC 메인 페이지로 이동
2. "Popular Sheets" 섹션으로 스크롤
3. 장르 필터 버튼 확인
4. **✅ 예상 결과**: 장르가 스페인어로 표시됨

### 3. 베트남어 사이트 (vi.copydrum.com)

1. PC 메인 페이지로 이동
2. "Popular Sheets" 섹션으로 스크롤
3. 장르 필터 버튼 확인
4. **✅ 예상 결과**: 장르가 베트남어로 표시됨

### 4. 중국어 간체 사이트 (zh-cn.copydrum.com)

1. PC 메인 페이지로 이동
2. "Popular Sheets" 섹션으로 스크롤
3. 장르 필터 버튼 확인
4. **✅ 예상 결과**: 장르가 중국어로 표시됨

### 5. 한국어/영어/일본어 사이트 확인

1. **한국어 사이트 (copydrum.com)**: 기존과 동일하게 한국어 장르 표시
2. **영어 사이트 (en.copydrum.com)**: 기존과 동일하게 영어 장르 표시
3. **일본어 사이트 (jp.copydrum.com)**: 기존과 동일하게 일본어 장르 표시

## ✅ 체크리스트

- [x] 장르 필터 버튼의 `getGenreName` 함수 수정
- [x] Sheet Detail Page와 동일한 번역 로직 적용
- [x] 모든 언어에서 `categoriesPage.categories.*` 키 사용
- [x] ko/en/ja 사이트는 기존 동작 유지
- [x] 글로벌 사이트에서 장르가 올바르게 번역되는지 확인

## 📚 관련 파일

- `src/pages/home/page.tsx` - Home Page
- `src/pages/sheet-detail/page.tsx` - Sheet Detail Page (참고)
- `src/i18n/locales/*/categoriesPage.json` - 장르 번역 키

## 🔍 에러 원인 및 해결

### 에러 원인

1. **잘못된 i18n 키 사용**: `category.*` 키는 모든 언어에 존재하지 않음
2. **일관성 부족**: Sheet Detail Page는 `categoriesPage.categories.*` 키를 사용하고 있었음
3. **글로벌 사이트 미지원**: 글로벌 사이트에서 번역이 되지 않아 한국어로 표시됨

### 해결 방법

1. **올바른 i18n 키 사용**: `categoriesPage.categories.*` 키 사용 (모든 언어에 존재)
2. **일관된 로직 적용**: Sheet Detail Page와 동일한 번역 로직 적용
3. **언어별 처리**: ko/en/ja는 기존 로직 유지, 나머지 언어는 `categoriesPage.categories.*` 키 사용

이제 PC 메인 페이지의 "Popular Sheets" 섹션에서 모든 글로벌 사이트에서 장르가 올바르게 번역되어 표시됩니다.

















