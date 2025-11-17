# 카카오 OAuth 설정 가이드

## 1. 카카오 개발자 콘솔 설정

1. [카카오 개발자 콘솔](https://developers.kakao.com/)에 접속
2. 내 애플리케이션 > 애플리케이션 추가하기
3. 앱 이름, 사업자명 입력 후 저장

### 플랫폼 설정

1. 플랫폼 > Web 플랫폼 등록
   - 사이트 도메인: `https://copydrum.com`
   - Redirect URI: `https://copydrum.com/auth/callback`

### 카카오 로그인 활성화

1. 제품 설정 > 카카오 로그인 > 활성화 설정
2. Redirect URI 등록:
   - `https://copydrum.com/auth/callback`
   - `https://www.copydrum.com/auth/callback`
   - (개발 환경) `http://localhost:3000/auth/callback`

### 동의 항목 설정

1. 제품 설정 > 카카오 로그인 > 동의항목
2. 필수 동의 항목:
   - 이메일 (필수)
   - 닉네임 (선택)
3. 선택 동의 항목:
   - 프로필 사진 (선택)

### REST API 키 확인

1. 앱 설정 > 앱 키에서 REST API 키 복사

## 2. Supabase 설정

### OAuth 제공자 추가

1. Supabase 대시보드 접속
2. Authentication > Providers
3. Kakao 제공자 활성화
4. 다음 정보 입력:
   - **Client ID (REST API 키)**: 카카오 개발자 콘솔에서 복사한 REST API 키
   - **Client Secret**: 카카오 개발자 콘솔 > 제품 설정 > 카카오 로그인 > 보안에서 Client Secret 생성 후 입력
   - **Redirect URL**: `https://copydrum.com/auth/callback`

### Redirect URLs 설정

1. Authentication > URL Configuration
2. Redirect URLs에 추가:
   - `https://copydrum.com/auth/callback`
   - `https://www.copydrum.com/auth/callback`
   - (개발 환경) `http://localhost:3000/auth/callback`

## 3. 카카오 개발자 콘솔 Redirect URI 설정 (중요!)

**⚠️ KOE205 오류 해결을 위해 반드시 설정해야 합니다!**

카카오 개발자 콘솔에서 **Supabase의 Redirect URI**를 등록해야 합니다:

1. 제품 설정 > 카카오 로그인 > Redirect URI
2. **Supabase 프로젝트의 Redirect URI 추가** (필수):
   - `https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback`
   - 예시: `https://tkbyemysfmbhqwdvefsi.supabase.co/auth/v1/callback`
   
   **⚠️ 주의**: Supabase 프로젝트 ID는 Supabase 대시보드 > Settings > API에서 확인할 수 있습니다.

3. **추가로 등록할 URI들**:
   - `https://copydrum.com/auth/callback` (선택사항, 직접 콜백 사용 시)
   - `https://www.copydrum.com/auth/callback` (선택사항)

## 4. 테스트

1. 로그인 페이지에서 "카카오" 버튼 클릭
2. 카카오 로그인 화면으로 리다이렉트
3. 로그인 후 `/auth/callback`으로 리다이렉트
4. 자동으로 홈페이지로 이동

## 문제 해결

### "잘못된 요청 (KOE205)" 오류 ⚠️
**가장 흔한 오류입니다!**

이 오류는 카카오 개발자 콘솔에 **Supabase의 Redirect URI가 등록되지 않았을 때** 발생합니다.

**해결 방법:**
1. Supabase 대시보드 > Settings > API에서 프로젝트 URL 확인
   - 예: `https://tkbyemysfmbhqwdvefsi.supabase.co`
2. 카카오 개발자 콘솔 > 제품 설정 > 카카오 로그인 > Redirect URI에 추가:
   - `https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback`
   - 정확한 형식: `https://프로젝트ID.supabase.co/auth/v1/callback`
3. 저장 후 몇 분 기다린 후 다시 시도

**확인 사항:**
- URI 끝에 `/auth/v1/callback`이 정확히 포함되어 있는지
- `https://`로 시작하는지
- 슬래시(`/`)가 올바르게 포함되어 있는지
- 프로젝트 ID가 정확한지

### "redirect_uri_mismatch" 오류
- 카카오 개발자 콘솔의 Redirect URI와 Supabase의 Redirect URL이 일치하는지 확인
- 모든 도메인 변형을 등록했는지 확인 (www 포함)
- **Supabase의 Redirect URI가 등록되어 있는지 확인** (가장 중요!)

### "invalid_client" 오류
- REST API 키와 Client Secret이 올바른지 확인
- Supabase에 입력한 값이 카카오 개발자 콘솔의 값과 일치하는지 확인
- Client Secret이 생성되었는지 확인 (카카오 개발자 콘솔 > 제품 설정 > 카카오 로그인 > 보안)

### 로그인 후 프로필이 생성되지 않음
- `src/pages/auth/callback.tsx`의 프로필 생성 로직 확인
- Supabase의 `profiles` 테이블 스키마 확인

## 참고 자료

- [Supabase OAuth 문서](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [카카오 로그인 REST API 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)

