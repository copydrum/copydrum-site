# 드럼 악보 사이트 마이그레이션 가이드
## 아임웹 → 자체 호스팅 이전 (2만명 회원 + 1만 5천개 PDF)

---

## 📋 전체 프로세스 개요

1. **데이터베이스 설계 및 설정** (Supabase)
2. **회원 데이터 이전** (2만명)
3. **PDF 파일 이전** (1만 5천개)
4. **쇼핑몰 디자인 완성** (Cursor AI)
5. **호스팅 및 배포**

---

## 1단계: 데이터베이스 설계 및 준비

### 1.1 Supabase 프로젝트 설정

1. **Supabase 계정 생성 및 프로젝트 생성**
   - https://supabase.com 접속
   - 새 프로젝트 생성
   - 지역 선택: `Seoul (ap-northeast-2)` 또는 `Singapore`

2. **필요한 테이블 구조**

```sql
-- 1. 회원 테이블 (profiles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  password_hash TEXT, -- 마이그레이션 후 재설정 안내
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 아임웹에서 가져올 추가 필드
  imweb_user_id TEXT, -- 아임웹 회원 ID (참고용)
  migrated_at TIMESTAMPTZ -- 마이그레이션 시점
);

-- 2. 악보 테이블 (drum_sheets)
CREATE TABLE drum_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  price INTEGER NOT NULL DEFAULT 0,
  pdf_url TEXT NOT NULL, -- Supabase Storage URL
  thumbnail_url TEXT,
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  page_count INTEGER,
  file_size INTEGER, -- 바이트 단위
  purchase_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- 마이그레이션 정보
  imweb_product_id TEXT,
  migrated_at TIMESTAMPTZ
);

-- 3. 카테고리 테이블
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 주문 테이블
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  payment_method TEXT,
  payment_id TEXT, -- 결제 시스템 ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 주문 상세 (주문-악보 관계)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES drum_sheets(id),
  price INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 장바구니
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sheet_id UUID REFERENCES drum_sheets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sheet_id)
);

-- 7. 맞춤 제작 주문
CREATE TABLE custom_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  reference_url TEXT,
  difficulty_preference TEXT,
  additional_notes TEXT,
  status TEXT DEFAULT 'pending',
  estimated_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_drum_sheets_category ON drum_sheets(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
```

### 1.2 Supabase Storage 설정

1. **Storage 버킷 생성**
   - `pdf-files`: PDF 악보 파일 저장
   - `thumbnails`: 썸네일 이미지
   - `preview-images`: 미리보기 이미지

2. **Storage 정책 설정**
```sql
-- PDF 파일: 인증된 사용자만 다운로드
CREATE POLICY "Authenticated users can download PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-files' AND auth.role() = 'authenticated');

-- 썸네일/미리보기: 공개 접근 허용
CREATE POLICY "Public thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id IN ('thumbnails', 'preview-images'));
```

---

## 2단계: 회원 데이터 이전 (2만명)

### 2.1 아임웹에서 회원 데이터 추출

**방법 1: 아임웹 관리자 페이지에서 CSV 내보내기**
1. 아임웹 관리자 → 회원 관리
2. 전체 회원 목록 다운로드 (CSV/Excel)
3. 포함 필드: 이메일, 이름, 전화번호, 가입일, 회원ID

**방법 2: 아임웹 API 사용** (대량 데이터)
- 아임웹 개발자 API 키 발급
- 회원 목록 API 호출로 JSON 다운로드

### 2.2 데이터 변환 스크립트 작성

```typescript
// scripts/migrate-users.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // 서비스 키 사용
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ImwebUser {
  email: string;
  name: string;
  phone?: string;
  created_at: string;
  imweb_id: string;
}

async function migrateUsers() {
  // 1. CSV 파일 읽기
  const csvContent = fs.readFileSync('imweb-users.csv', 'utf-8');
  const users: ImwebUser[] = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`총 ${users.length}명의 회원 데이터 발견`);

  // 2. 배치 처리 (1000명씩)
  const batchSize = 1000;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const profiles = batch.map(user => ({
      email: user.email.toLowerCase().trim(),
      name: user.name || user.email.split('@')[0],
      phone: user.phone || null,
      imweb_user_id: user.imweb_id,
      role: 'user',
      created_at: user.created_at || new Date().toISOString(),
      migrated_at: new Date().toISOString()
    }));

    // 3. Supabase에 일괄 삽입
    const { data, error } = await supabase
      .from('profiles')
      .insert(profiles)
      .select();

    if (error) {
      console.error(`배치 ${i / batchSize + 1} 오류:`, error);
      errorCount += batch.length;
      
      // 개별 처리로 재시도
      for (const profile of profiles) {
        const { error: singleError } = await supabase
          .from('profiles')
          .upsert(profile, { onConflict: 'email' });
        
        if (singleError) {
          console.error(`${profile.email} 오류:`, singleError);
        } else {
          successCount++;
        }
      }
    } else {
      successCount += batch.length;
      console.log(`진행률: ${((i + batch.length) / users.length * 100).toFixed(1)}%`);
    }

    // API Rate Limit 방지 (0.5초 대기)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n이전 완료:`);
  console.log(`성공: ${successCount}명`);
  console.log(`실패: ${errorCount}명`);
}

migrateUsers().catch(console.error);
```

### 2.3 실행 방법

```bash
# TypeScript 실행 환경 설치
npm install --save-dev tsx @types/node csv-parse

# 스크립트 실행
npx tsx scripts/migrate-users.ts
```

### 2.4 회원 비밀번호 처리

**옵션 1: 임시 비밀번호 발급 및 이메일 발송**
```typescript
// 비밀번호 재설정 토큰 생성 후 이메일 발송
// Supabase Auth의 비밀번호 재설정 기능 활용
```

**옵션 2: 소셜 로그인 연동 강화**
- 카카오, 구글 로그인 제공
- 비밀번호 없이 로그인 가능

---

## 3단계: PDF 파일 이전 (1만 5천개)

### 3.1 PDF 파일 다운로드 전략

**아임웹에서 PDF 파일 추출:**
1. 아임웹 FTP 접속 → 상품 이미지/파일 폴더 확인
2. 또는 상품 관리 페이지에서 각 상품의 파일 다운로드
3. 파일명 규칙: `{상품ID}-{제목}.pdf`

### 3.2 대량 업로드 스크립트

```typescript
// scripts/migrate-pdfs.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PDFInfo {
  filePath: string;
  title: string;
  artist: string;
  category: string;
  price: number;
  imweb_product_id: string;
}

async function uploadPDF(pdfInfo: PDFInfo) {
  try {
    // 1. 파일 읽기
    const fileBuffer = fs.readFileSync(pdfInfo.filePath);
    const fileName = path.basename(pdfInfo.filePath);
    const fileSize = fileBuffer.length;

    // 2. Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdf-files')
      .upload(`${Date.now()}-${fileName}`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 3. 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from('pdf-files')
      .getPublicUrl(uploadData.path);

    // 4. 데이터베이스에 레코드 생성
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('name', pdfInfo.category)
      .single();

    const { data: sheet, error: dbError } = await supabase
      .from('drum_sheets')
      .insert({
        title: pdfInfo.title,
        artist: pdfInfo.artist,
        category_id: category?.id || null,
        price: pdfInfo.price,
        pdf_url: urlData.publicUrl,
        file_size: fileSize,
        imweb_product_id: pdfInfo.imweb_product_id,
        is_active: true,
        migrated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return { success: true, sheet };
  } catch (error) {
    return { success: false, error };
  }
}

async function migratePDFs() {
  // PDF 정보가 담긴 CSV/JSON 읽기
  const pdfList: PDFInfo[] = JSON.parse(
    fs.readFileSync('pdf-list.json', 'utf-8')
  );

  console.log(`총 ${pdfList.length}개의 PDF 파일 업로드 시작`);

  let successCount = 0;
  let errorCount = 0;

  // 동시 업로드 제한 (5개씩)
  const concurrentLimit = 5;
  
  for (let i = 0; i < pdfList.length; i += concurrentLimit) {
    const batch = pdfList.slice(i, i + concurrentLimit);
    
    const results = await Promise.allSettled(
      batch.map(pdf => uploadPDF(pdf))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        console.log(`✓ ${i + index + 1}/${pdfList.length}: ${batch[index].title}`);
      } else {
        errorCount++;
        console.error(`✗ ${i + index + 1}/${pdfList.length}: ${batch[index].title}`, result);
      }
    });

    // 진행률 표시
    const progress = ((i + concurrentLimit) / pdfList.length * 100).toFixed(1);
    console.log(`진행률: ${progress}% (${successCount} 성공, ${errorCount} 실패)`);

    // Rate Limit 방지
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n업로드 완료:`);
  console.log(`성공: ${successCount}개`);
  console.log(`실패: ${errorCount}개`);
}

migratePDFs().catch(console.error);
```

### 3.3 실행 방법

```bash
# 1. PDF 목록 JSON 파일 생성 (수동 또는 스크립트)
# pdf-list.json 예시:
[
  {
    "filePath": "./pdfs/001-song.pdf",
    "title": "곡 제목",
    "artist": "아티스트명",
    "category": "록",
    "price": 15000,
    "imweb_product_id": "12345"
  }
]

# 2. 스크립트 실행
npx tsx scripts/migrate-pdfs.ts
```

### 3.4 성능 최적화 팁

1. **배치 처리**: 여러 파일을 동시에 업로드 (5-10개)
2. **재시도 로직**: 실패 시 자동 재시도 (최대 3회)
3. **진행 상황 저장**: 중단 시 재개 가능하도록 체크포인트 저장

---

## 4단계: 쇼핑몰 디자인 완성 (Cursor AI)

### 4.1 현재 프로젝트 구조 활용

현재 `copydrum_site` 프로젝트는 이미 기본 구조가 있음:
- ✅ React + TypeScript
- ✅ Tailwind CSS
- ✅ Supabase 연동
- ✅ 라우팅 설정

### 4.2 Cursor AI로 개선할 부분

**요청 예시:**
```
다음 기능을 추가/개선해줘:

1. 홈페이지 디자인 개선
   - 히어로 섹션 강화
   - 인기 악보 카로셀
   - 신규 악보 섹션
   - 추천 악보 (개인화)

2. 상품 상세 페이지
   - PDF 미리보기 기능
   - 다운로드 버튼
   - 관련 악보 추천

3. 검색 기능 고도화
   - 실시간 검색
   - 필터 (카테고리, 난이도, 가격)
   - 정렬 옵션

4. 결제 시스템 연동
   - 토스페이먼츠 또는 아임포트
   - 장바구니 기능 완성

5. 반응형 디자인
   - 모바일 최적화
   - 태블릿 레이아웃
```

### 4.3 디자인 가이드라인

- **컬러**: 브랜드 컬러 유지
- **타이포그래피**: 가독성 중시
- **이미지**: PDF 썸네일 자동 생성
- **UX**: 직관적인 네비게이션

---

## 5단계: 호스팅 및 배포

### 5.1 호스팅 옵션 비교

| 옵션 | 비용/월 | 추천도 | 특징 |
|------|---------|--------|------|
| **Vercel** | 무료~$20 | ⭐⭐⭐⭐⭐ | Next.js 최적화, CDN 자동, 쉽고 빠름 |
| **Netlify** | 무료~$19 | ⭐⭐⭐⭐⭐ | 정적 사이트, 폼 처리, 빠른 배포 |
| **AWS S3 + CloudFront** | $5~50 | ⭐⭐⭐⭐ | 대용량 트래픽, 확장성 우수 |
| **클라우드웨이즈** | $12~ | ⭐⭐⭐ | VPS, 완전한 제어 가능 |

### 5.2 Vercel 배포 (추천)

```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 프로젝트 빌드 설정
# vercel.json 생성
{
  "buildCommand": "npm run build",
  "outputDirectory": "out",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

# 3. 환경 변수 설정 (.env.production)
VITE_PUBLIC_SUPABASE_URL=your_supabase_url
VITE_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# 4. 배포
vercel --prod
```

### 5.3 도메인 연결

1. 도메인 구매 (가비아, 후이즈 등)
2. Vercel에서 도메인 추가
3. DNS 설정 (CNAME 또는 A 레코드)

### 5.4 CDN 및 성능 최적화

- **이미지 최적화**: WebP 형식, lazy loading
- **PDF 다운로드**: CDN을 통한 빠른 다운로드
- **캐싱**: 브라우저 캐시, 서비스 워커 활용

---

## 6단계: 데이터 검증 및 테스트

### 6.1 검증 체크리스트

- [ ] 회원 수 확인 (2만명)
- [ ] PDF 파일 수 확인 (1만 5천개)
- [ ] 모든 PDF 다운로드 테스트
- [ ] 결제 플로우 테스트
- [ ] 회원 로그인/로그아웃 테스트
- [ ] 관리자 페이지 기능 테스트

### 6.2 성능 테스트

```bash
# Lighthouse 성능 테스트
npm install -g lighthouse
lighthouse https://your-site.com --view
```

---

## 7단계: 운영 체크리스트

### 7.1 필수 설정

- [ ] SSL 인증서 (HTTPS)
- [ ] 백업 스케줄 (Supabase 자동 백업)
- [ ] 에러 모니터링 (Sentry 등)
- [ ] 분석 도구 (Google Analytics)

### 7.2 비상 계획

- **데이터 백업**: 주기적 다운로드 및 보관
- **롤백 계획**: 문제 발생 시 즉시 이전 버전으로 복구
- **고객 지원**: 문의 채널 준비

---

## 예상 비용

| 항목 | 월 비용 | 연 비용 |
|------|---------|---------|
| **Supabase** (Pro) | $25 | $300 |
| **Vercel** (Pro) | $20 | $240 |
| **도메인** | - | $15 |
| **결제 수수료** | 트랜잭션당 3% | - |
| **기타 도구** | $10 | $120 |
| **합계** | **$55** | **$675** |

*트래픽이 많을 경우 추가 비용 발생 가능

---

## 마이그레이션 일정 (권장)

- **1주차**: 데이터베이스 설계, 회원 데이터 이전
- **2주차**: PDF 파일 업로드 (일괄 처리)
- **3주차**: 디자인 완성 및 기능 개발
- **4주차**: 테스트 및 배포
- **5주차**: 운영 안정화 및 모니터링

---

## 추가 팁

1. **점진적 이전**: 새 사이트와 아임웹을 병행 운영 후 완전 전환
2. **SEO 유지**: 기존 URL 구조 유지 또는 301 리다이렉트
3. **고객 안내**: 이전 이메일 발송 및 공지사항

---

## 문제 해결

- **대량 업로드 실패**: 배치 크기 줄이기, 재시도 로직 추가
- **성능 이슈**: 데이터베이스 인덱스 확인, 쿼리 최적화
- **비용 초과**: 사용량 모니터링, 불필요한 리소스 정리

---

이 가이드를 참고하여 단계별로 진행하시면 됩니다. 각 단계에서 문제가 발생하면 알려주세요!









