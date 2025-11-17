# 카카오 로그인 KOE205 오류 해결 가이드

## 오류 메시지
```
잘못된 요청 (KOE205)
카피드럼 서비스 설정에 오류가 있어, 이용할 수 없습니다.
서비스 관리자의 확인이 필요합니다.
```

## 원인
KOE205 오류는 **카카오 개발자 콘솔에 Supabase의 Redirect URI가 등록되지 않았을 때** 발생합니다.

Supabase OAuth를 사용할 때는 다음과 같은 흐름으로 동작합니다:
1. 사용자가 카카오 로그인 버튼 클릭
2. 브라우저 → Supabase OAuth 엔드포인트로 리다이렉트
3. Supabase → 카카오 로그인 페이지로 리다이렉트
4. 사용자가 카카오 로그인 완료
5. 카카오 → **Supabase의 Redirect URI**로 리다이렉트
6. Supabase → 우리 사이트의 `/auth/callback`으로 리다이렉트

**5번 단계에서 카카오가 Supabase의 Redirect URI로 리다이렉트하려고 하는데, 이 URI가 카카오 개발자 콘솔에 등록되어 있지 않으면 KOE205 오류가 발생합니다.**

## 해결 방법

### 1단계: Supabase 프로젝트 ID 확인
1. [Supabase 대시보드](https://app.supabase.com/) 접속
2. 프로젝트 선택
3. Settings > API 메뉴로 이동
4. **Project URL** 확인
   - 예: `https://tkbyemysfmbhqwdvefsi.supabase.co`
   - 이 URL에서 `tkbyemysfmbhqwdvefsi` 부분이 프로젝트 ID입니다.

### 2단계: 카카오 개발자 콘솔에 Redirect URI 등록
1. [카카오 개발자 콘솔](https://developers.kakao.com/) 접속
2. 내 애플리케이션 선택
3. **제품 설정 > 카카오 로그인** 메뉴로 이동
4. **Redirect URI** 섹션에서 **URI 추가** 클릭
5. 다음 형식으로 URI 입력:
   ```
   https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/auth/v1/callback
   ```
   
   예시:
   ```
   https://tkbyemysfmbhqwdvefsi.supabase.co/auth/v1/callback
   ```
   
6. **저장** 클릭

### 3단계: 확인 사항
다음 사항들이 정확한지 확인하세요:

- ✅ URI가 `https://`로 시작하는가?
- ✅ 프로젝트 ID가 정확한가?
- ✅ `/auth/v1/callback`이 정확히 포함되어 있는가?
- ✅ 슬래시(`/`)가 올바르게 포함되어 있는가?
- ✅ URI 끝에 추가 공백이나 문자가 없는가?

### 4단계: Supabase 설정 확인
1. Supabase 대시보드 > Authentication > Providers
2. Kakao 제공자가 활성화되어 있는지 확인
3. **Client ID (REST API 키)**가 올바르게 입력되어 있는지 확인
4. **Client Secret**이 올바르게 입력되어 있는지 확인

### 5단계: Supabase Redirect URLs 확인
1. Supabase 대시보드 > Authentication > URL Configuration
2. **Redirect URLs**에 다음이 등록되어 있는지 확인:
   - `https://copydrum.com/auth/callback`
   - `https://www.copydrum.com/auth/callback`

### 6단계: 테스트
1. 설정 저장 후 **5-10분 정도 기다립니다** (카카오 서버에 설정이 반영되는 시간)
2. 로그인 페이지에서 카카오 로그인 버튼 클릭
3. 카카오 로그인 화면이 정상적으로 표시되는지 확인

## 추가 문제 해결

### 여전히 오류가 발생하는 경우

1. **브라우저 캐시 삭제**
   - 브라우저 캐시와 쿠키를 삭제하고 다시 시도

2. **시크릿 모드에서 테스트**
   - 시크릿/프라이빗 모드에서 테스트하여 확장 프로그램이나 캐시의 영향을 제거

3. **카카오 앱 상태 확인**
   - 카카오 개발자 콘솔 > 앱 설정에서 앱 상태가 "운영" 또는 "개발"인지 확인
   - 앱이 비활성화되어 있지 않은지 확인

4. **REST API 키 확인**
   - 카카오 개발자 콘솔 > 앱 설정 > 앱 키에서 REST API 키 확인
   - Supabase에 입력한 Client ID와 일치하는지 확인

5. **Client Secret 확인**
   - 카카오 개발자 콘솔 > 제품 설정 > 카카오 로그인 > 보안
   - Client Secret이 생성되어 있는지 확인
   - Supabase에 입력한 Client Secret과 일치하는지 확인

6. **Supabase 로그 확인**
   - Supabase 대시보드 > Logs > Auth Logs에서 오류 로그 확인

## 참고

- 카카오 개발자 콘솔의 Redirect URI는 최대 20개까지 등록 가능합니다
- URI는 정확히 일치해야 하며, 대소문자를 구분합니다
- 설정 변경 후 즉시 반영되지 않을 수 있으므로 몇 분 기다려야 합니다

