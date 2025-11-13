# Supabase Edge Functions 배포 가이드

## 1. Supabase CLI 설치

### Windows (PowerShell)

**⚠️ 중요**: npm으로 전역 설치(`npm install -g supabase`)는 지원되지 않습니다.

#### 방법 1: npx 사용 (가장 간단, 권장)
npx를 사용하면 CLI를 설치하지 않고도 바로 사용할 수 있습니다:

```powershell
# npx로 직접 실행 (설치 불필요)
npx supabase --version
```

#### 방법 2: Scoop 사용 (Windows 패키지 매니저)
```powershell
# Scoop이 설치되어 있다면
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 설치 확인
supabase --version
```

#### 방법 3: 직접 다운로드
1. https://github.com/supabase/cli/releases 방문
2. Windows용 바이너리 다운로드 (예: `supabase_X.X.X_windows_amd64.zip`)
3. 압축 해제 후 PATH에 추가하거나 원하는 위치에 저장
4. PowerShell에서 실행 경로 지정하여 사용

#### 방법 4: 프로젝트 로컬 설치 (선택사항)
```powershell
# 프로젝트 폴더에서
npm install supabase --save-dev

# 사용 시
npx supabase --version
```

## 2. Supabase 프로젝트에 로그인

### npx 사용 시
```bash
npx supabase login
```

### CLI가 설치된 경우
```bash
supabase login
```

브라우저가 열리면 Supabase 계정으로 로그인하세요.

## 3. 프로젝트 연결 (선택사항)

프로젝트가 이미 Supabase 대시보드에 있다면:

```bash
# 프로젝트 ID 확인 (Supabase 대시보드 > Settings > General > Reference ID)
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Edge Function 배포

### npx 사용 시

#### 특정 함수만 배포
```bash
npx supabase functions deploy admin-cancel-order
```

#### 모든 함수 배포
```bash
npx supabase functions deploy
```

### CLI가 설치된 경우

#### 특정 함수만 배포
```bash
supabase functions deploy admin-cancel-order
```

#### 모든 함수 배포
```bash
supabase functions deploy
```

**⚠️ 주의**: 배포 전에 프로젝트 루트에서 실행해야 합니다 (`supabase/functions/` 폴더가 있는 위치).

## 5. 환경 변수 설정 (필요한 경우)

Edge Function에서 사용하는 환경 변수는 Supabase 대시보드에서 설정합니다:

1. Supabase 대시보드 접속
2. **Edge Functions** > **Settings** 이동
3. **Secrets** 탭에서 환경 변수 추가:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - 기타 필요한 환경 변수

## 6. 배포 확인

배포 후 함수가 정상 작동하는지 확인:

### npx 사용 시
```bash
# 함수 로그 확인
npx supabase functions logs admin-cancel-order
```

### CLI가 설치된 경우
```bash
# 함수 로그 확인
supabase functions logs admin-cancel-order
```

### 함수 호출 테스트 (선택사항)
PowerShell에서:
```powershell
# YOUR_PROJECT_REF를 실제 프로젝트 참조 ID로 변경
# YOUR_ANON_KEY를 실제 Anon Key로 변경
$headers = @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type" = "application/json"
}
$body = @{
    orderId = "test"
    doRefund = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin-cancel-order" -Method POST -Headers $headers -Body $body
```

또는 브라우저 개발자 도구의 Console에서:
```javascript
// 실제 프로젝트 URL과 키로 변경
fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin-cancel-order', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ orderId: 'test', doRefund: false })
})
.then(r => r.json())
.then(console.log)
```

## 문제 해결

### CLI가 설치되지 않는 경우
- Node.js가 설치되어 있는지 확인: `node --version`
- npm이 설치되어 있는지 확인: `npm --version`
- 관리자 권한으로 PowerShell 실행 후 재시도

### 배포 오류가 발생하는 경우
- Supabase 대시보드에서 프로젝트가 활성화되어 있는지 확인
- `supabase login`으로 로그인 상태 확인
- 함수 코드에 문법 오류가 없는지 확인

### CORS 오류가 계속되는 경우
- Edge Function이 배포되었는지 확인
- 브라우저 개발자 도구의 Network 탭에서 실제 요청 URL 확인
- Edge Function의 CORS 헤더 설정 확인

