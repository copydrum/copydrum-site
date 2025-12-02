# 푸터 하단 텍스트 다국어화 수정

## 🐛 문제점

14개 글로벌 언어 사이트(한국어, 영어, 일본어 제외)에서 푸터 하단 텍스트가 한국어로 표시되는 문제가 있었습니다.

**문제:**
- Footer 컴포넌트에 하드코딩된 영어 텍스트가 있음
- 일부 언어 파일에 footer 관련 i18n 키가 누락됨
- "All rights reserved" 및 "Global Service" 텍스트가 하드코딩되어 있음

## ✅ 수정 내용

### 1. Footer 컴포넌트 수정

**파일**: `src/components/common/Footer.tsx`

**Before:**
```tsx
<div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
  <p>&copy; {new Date().getFullYear()} CopyDrum. All rights reserved.</p>
  {isGlobalSite && (
    <p className="mt-2 text-xs text-gray-500">
      Global Service | English / Japanese / Vietnamese / French / German / Spanish / Portuguese
    </p>
  )}
</div>
```

**After:**
```tsx
<div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
  <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
  {isGlobalSite && (
    <p className="mt-2 text-xs text-gray-500">
      {t('footer.globalService')}
    </p>
  )}
</div>
```

### 2. 각 언어 파일에 footer 키 추가

모든 17개 언어 파일(`src/i18n/local/*/common.ts`)에 다음 footer 키들을 추가했습니다:

#### 필수 footer 키 목록:
- `footer.categories` - 악보 카테고리
- `footer.scoreCategoryTitle` - 악보 카테고리 (제목)
- `footer.support` - 고객 지원
- `footer.company` - 회사 정보
- `footer.guide` - 이용 가이드
- `footer.faq` - 자주 묻는 질문
- `footer.contact` - 문의하기
- `footer.refundPolicy` - 환불 정책
- `footer.about` - 회사 소개
- `footer.businessInfo` - 사업자 정보
- `footer.terms` - 이용약관
- `footer.privacy` - 개인정보처리방침
- `footer.partnership` - 파트너십
- `footer.description` - 사이트 설명
- `footer.companyInfo` - 회사 정보
- `footer.telecomLicense` - 통신판매업 신고
- `footer.address` - 주소
- `footer.contactInfo` - 연락처 정보 (한국 사이트용)
- `footer.email` - 이메일
- `footer.contactInfoGlobal` - 글로벌 사이트 연락처 정보
- `footer.copyright` - 저작권 정보 (year 변수 사용)
- `footer.globalService` - 글로벌 서비스 안내

### 3. 언어별 번역 예시

#### 독일어 (de)
```typescript
'footer.copyright': '© {{year}} CopyDrum. Alle Rechte vorbehalten.',
'footer.globalService': 'Globaler Service | Englisch / Japanisch / Vietnamesisch / Französisch / Deutsch / Spanisch / Portugiesisch',
```

#### 프랑스어 (fr)
```typescript
'footer.copyright': '© {{year}} CopyDrum. Tous droits réservés.',
'footer.globalService': 'Service mondial | Anglais / Japonais / Vietnamien / Français / Allemand / Espagnol / Portugais',
```

#### 스페인어 (es)
```typescript
'footer.copyright': '© {{year}} CopyDrum. Todos los derechos reservados.',
'footer.globalService': 'Servicio global | Inglés / Japonés / Vietnamita / Francés / Alemán / Español / Portugués',
```

#### 베트남어 (vi)
```typescript
'footer.copyright': '© {{year}} CopyDrum. Bảo lưu mọi quyền.',
'footer.globalService': 'Dịch vụ toàn cầu | Tiếng Anh / Tiếng Nhật / Tiếng Việt / Tiếng Pháp / Tiếng Đức / Tiếng Tây Ban Nha / Tiếng Bồ Đào Nha',
```

#### 중국어 간체 (zh-CN)
```typescript
'footer.copyright': '© {{year}} CopyDrum. 版权所有。',
'footer.globalService': '全球服务 | 英语 / 日语 / 越南语 / 法语 / 德语 / 西班牙语 / 葡萄牙语',
```

#### 중국어 번체 (zh-TW)
```typescript
'footer.copyright': '© {{year}} CopyDrum. 版權所有。',
'footer.globalService': '全球服務 | 英語 / 日語 / 越南語 / 法語 / 德語 / 西班牙語 / 葡萄牙語',
```

## 📝 수정된 파일 목록

### 컴포넌트 파일 (1개)
1. **`src/components/common/Footer.tsx`**
   - 하드코딩된 텍스트를 i18n 키로 변경

### i18n 언어 파일 (17개)
1. **`src/i18n/local/ko/common.ts`** - 한국어
2. **`src/i18n/local/en/common.ts`** - 영어
3. **`src/i18n/local/ja/common.ts`** - 일본어
4. **`src/i18n/local/de/common.ts`** - 독일어
5. **`src/i18n/local/fr/common.ts`** - 프랑스어
6. **`src/i18n/local/es/common.ts`** - 스페인어
7. **`src/i18n/local/vi/common.ts`** - 베트남어
8. **`src/i18n/local/zh-CN/common.ts`** - 중국어 간체
9. **`src/i18n/local/zh-TW/common.ts`** - 중국어 번체
10. **`src/i18n/local/pt/common.ts`** - 포르투갈어
11. **`src/i18n/local/it/common.ts`** - 이탈리아어
12. **`src/i18n/local/ru/common.ts`** - 러시아어
13. **`src/i18n/local/th/common.ts`** - 태국어
14. **`src/i18n/local/tr/common.ts`** - 터키어
15. **`src/i18n/local/uk/common.ts`** - 우크라이나어
16. **`src/i18n/local/id/common.ts`** - 인도네시아어
17. **`src/i18n/local/hi/common.ts`** - 힌디어

## 🔍 주요 코드 변경사항

### Footer 컴포넌트 변경

**하드코딩 제거:**
- `All rights reserved.` → `t('footer.copyright', { year: ... })`
- `Global Service | ...` → `t('footer.globalService')`

**i18n 변수 사용:**
- `{{year}}` 변수를 사용하여 동적 연도 표시

### i18n 키 구조

모든 언어 파일에 일관된 footer 키 구조를 적용했습니다:

```typescript
// Footer 섹션
'footer.categories': '...',
'footer.scoreCategoryTitle': '...',
'footer.support': '...',
'footer.company': '...',
'footer.guide': '...',
'footer.faq': '...',
'footer.contact': '...',
'footer.refundPolicy': '...',
'footer.about': '...',
'footer.businessInfo': '...',
'footer.terms': '...',
'footer.privacy': '...',
'footer.partnership': '...',
'footer.description': '...',
'footer.companyInfo': '...',
'footer.telecomLicense': '...',
'footer.address': '...',
'footer.contactInfo': '...',
'footer.email': '...',
'footer.contactInfoGlobal': '...',
'footer.copyright': '© {{year}} CopyDrum. ...',
'footer.globalService': '...',
```

## 🧪 테스트 방법

### 1. 한국어 사이트 (copydrum.com)
1. 푸터 하단 확인
2. **✅ 예상 결과**: 기존과 동일하게 한국어로 표시

### 2. 영어 사이트 (en.copydrum.com)
1. 푸터 하단 확인
2. **✅ 예상 결과**: 기존과 동일하게 영어로 표시

### 3. 일본어 사이트 (jp.copydrum.com)
1. 푸터 하단 확인
2. **✅ 예상 결과**: 기존과 동일하게 일본어로 표시

### 4. 글로벌 언어 사이트 (14개)
각 언어 사이트에서 확인:

#### 독일어 (de.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. Alle Rechte vorbehalten."
  - "Globaler Service | Englisch / Japanisch / ..."

#### 프랑스어 (fr.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. Tous droits réservés."
  - "Service mondial | Anglais / Japonais / ..."

#### 스페인어 (es.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. Todos los derechos reservados."
  - "Servicio global | Inglés / Japonés / ..."

#### 베트남어 (vi.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. Bảo lưu mọi quyền."
  - "Dịch vụ toàn cầu | Tiếng Anh / Tiếng Nhật / ..."

#### 중국어 간체 (zh-cn.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. 版权所有。"
  - "全球服务 | 英语 / 日语 / ..."

#### 중국어 번체 (zh-tw.copydrum.com)
- **✅ 예상 결과**: 
  - "© 2025 CopyDrum. 版權所有。"
  - "全球服務 | 英語 / 日語 / ..."

#### 기타 언어 (pt, it, ru, th, tr, uk, id, hi)
- **✅ 예상 결과**: 각 언어에 맞게 번역된 텍스트 표시

### 5. 푸터 하단 텍스트 확인 항목

각 사이트에서 다음 항목들이 올바르게 번역되어 표시되는지 확인:

1. **저작권 정보** (`footer.copyright`)
   - 연도가 동적으로 표시되는지 확인
   - 각 언어로 올바르게 번역되었는지 확인

2. **글로벌 서비스 안내** (`footer.globalService`)
   - 글로벌 사이트에서만 표시되는지 확인
   - 각 언어로 올바르게 번역되었는지 확인

3. **악보 카테고리** (`footer.scoreCategoryTitle`)
   - 각 언어로 올바르게 번역되었는지 확인

4. **환불 정책** (`footer.refundPolicy`)
   - 각 언어로 올바르게 번역되었는지 확인

## ✅ 체크리스트

- [x] Footer 컴포넌트 하드코딩된 텍스트 제거
- [x] 모든 언어 파일에 footer.copyright 추가 (year 변수 지원)
- [x] 모든 언어 파일에 footer.globalService 추가
- [x] 모든 언어 파일에 footer.scoreCategoryTitle 추가
- [x] 모든 언어 파일에 footer.description 추가
- [x] 모든 언어 파일에 footer.companyInfo 추가
- [x] 모든 언어 파일에 footer.telecomLicense 추가
- [x] 모든 언어 파일에 footer.address 추가
- [x] 모든 언어 파일에 footer.contactInfo 추가
- [x] 모든 언어 파일에 footer.email 추가
- [x] 모든 언어 파일에 footer.contactInfoGlobal 추가
- [x] 모든 언어 파일에 기타 footer 키 추가
- [x] 한국어/영어/일본어 사이트 동작 확인
- [x] 14개 글로벌 언어 사이트 동작 확인

## 📚 관련 파일

- `src/components/common/Footer.tsx` - Footer 컴포넌트
- `src/i18n/local/*/common.ts` - 각 언어별 i18n 파일

## 🔍 변경 사항 요약

### 사용자 경험 개선

1. **Before**: 글로벌 언어 사이트에서 푸터 하단 텍스트가 한국어로 표시됨
2. **After**: 각 언어 사이트에서 해당 언어로 올바르게 번역된 텍스트 표시

### 일관된 다국어 지원

1. 모든 17개 언어 파일에 동일한 footer 키 구조 적용
2. 하드코딩된 텍스트를 모두 i18n 키로 교체
3. 동적 연도 표시를 위한 변수 지원

### 유지보수성 향상

1. 향후 텍스트 변경 시 각 언어 파일만 수정하면 됨
2. 새로운 언어 추가 시 동일한 키 구조를 따르면 됨
3. 하드코딩된 텍스트가 없어 일관성 유지 용이

이제 모든 글로벌 언어 사이트에서 푸터 하단 텍스트가 각 언어로 올바르게 표시됩니다.















