# Supabase Storage 버킷 설정 가이드

## 문제
악보 등록 시 "Bucket not found" 오류가 발생하는 경우, Supabase Storage에 필요한 버킷이 생성되지 않았기 때문입니다.

## 해결 방법

### 1. Supabase 대시보드 접속
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택

### 2. Storage 버킷 생성
1. 왼쪽 메뉴에서 **Storage** 클릭
2. **"Create a new bucket"** 또는 **"New bucket"** 버튼 클릭
3. 다음 정보 입력:
   - **Name**: `pdf-files`
   - **Public bucket**: ✅ **체크** (공개 버킷으로 설정 - 필수!)
   - **File size limit**: (선택사항) 원하는 최대 파일 크기 설정
   - **Allowed MIME types**: (선택사항) `application/pdf, image/png` 등
4. **"Create bucket"** 클릭

### 3. 버킷 권한 설정 (필요한 경우)
1. 생성된 `pdf-files` 버킷 클릭
2. **Policies** 탭으로 이동
3. 다음 정책 추가:

#### 읽기 정책 (공개 접근)
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-files');
```

#### 업로드 정책 (인증된 사용자만)
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pdf-files' 
  AND auth.role() = 'authenticated'
);
```

또는 더 간단하게 **Public bucket**으로 설정하면 자동으로 읽기 권한이 부여됩니다.

### 4. 확인
버킷 생성 후 악보 등록을 다시 시도하세요.

## 필요한 버킷 목록

현재 애플리케이션에서 사용하는 버킷:

- **pdf-files**: PDF 파일 및 미리보기 이미지 저장
  - 경로: `pdfs/` (PDF 파일)
  - 경로: `previews/` (미리보기 이미지)

## 문제 해결

### 버킷을 찾을 수 없는 경우
- 버킷 이름이 정확히 `pdf-files`인지 확인 (대소문자 구분)
- Public bucket으로 설정되어 있는지 확인

### 업로드 권한 오류가 발생하는 경우
- Storage Policies에서 INSERT 권한 확인
- RLS(Row Level Security) 정책 확인

### 추가 도움말
- [Supabase Storage 문서](https://supabase.com/docs/guides/storage)
- [Storage Policies 문서](https://supabase.com/docs/guides/storage/security/access-control)









