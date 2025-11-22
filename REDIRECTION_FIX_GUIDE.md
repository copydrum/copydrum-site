# 리디렉션 문제 수정 가이드

## 문제 상황
- `https://copydrum.com` → `https://en.copydrum.com`으로 리디렉션됨
- `https://jp.copydrum.com` → `https://en.copydrum.com`으로 리디렉션됨

## 수정 내용

### 1. vercel.json 업데이트
- `www.copydrum.com` → `copydrum.com` 리디렉션만 추가
- 다른 도메인은 리디렉션하지 않도록 설정

### 2. getLocaleFromHost 함수 개선
- `www.copydrum.com` 처리 추가
- 도메인별 언어 감지 로직 개선

### 3. HreflangTags 업데이트
- 일본어 사이트(`jp.copydrum.com`) hreflang 태그 추가

## Vercel 대시보드 확인 사항

**중요**: Vercel 프로젝트 설정에서 리디렉션 규칙을 확인해야 합니다.

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - 해당 프로젝트 선택

2. **Settings > Domains 확인**
   - 각 도메인이 올바르게 연결되어 있는지 확인
   - `copydrum.com`, `en.copydrum.com`, `jp.copydrum.com` 모두 확인

3. **Settings > Redirects 확인**
   - 프로젝트 설정에서 Redirects 탭 확인
   - `copydrum.com` → `en.copydrum.com` 리디렉션이 있는지 확인
   - `jp.copydrum.com` → `en.copydrum.com` 리디렉션이 있는지 확인
   - **있다면 삭제해야 합니다**

4. **환경 변수 확인**
   - `VITE_FORCE_GLOBAL_SITE` 환경 변수가 `true`로 설정되어 있지 않은지 확인

## 테스트 체크리스트

배포 후 다음 URL들을 테스트하세요:

- [ ] `https://copydrum.com` → 한국어 페이지 유지 (리디렉션 없음)
- [ ] `https://www.copydrum.com` → `https://copydrum.com`으로 리디렉션 (301)
- [ ] `https://jp.copydrum.com` → 일본어 페이지 유지 (리디렉션 없음)
- [ ] `https://en.copydrum.com` → 영어 페이지 유지 (리디렉션 없음)
- [ ] 브라우저 언어가 다른 경우에도 도메인 기반 언어 유지 확인
- [ ] 리디렉션 루프나 과도한 체인이 없는지 확인

## 디버깅 방법

### 1. 브라우저 개발자 도구
```javascript
// 콘솔에서 실행하여 현재 호스트 확인
console.log('Current host:', window.location.host);
console.log('Detected language:', i18n.language);
```

### 2. 네트워크 탭 확인
- Network 탭에서 리디렉션 체인 확인
- 301/302 응답이 있는지 확인
- Response Headers에서 `Location` 헤더 확인

### 3. curl로 테스트
```bash
# 리디렉션 확인
curl -I https://copydrum.com
curl -I https://jp.copydrum.com
curl -I https://en.copydrum.com

# Location 헤더가 있으면 리디렉션 발생
```

## 추가 확인 사항

### CDN 설정 (Cloudflare 등)
CDN을 사용하는 경우:
- CDN 대시보드에서 리디렉션 규칙 확인
- Page Rules 또는 Redirect Rules 확인
- 캐시 무효화 필요할 수 있음

### DNS 설정
- 각 서브도메인이 올바른 IP로 연결되어 있는지 확인
- CNAME 레코드 확인

## 예상 동작

### 정상 동작
- `copydrum.com` → 한국어 페이지 (ko)
- `jp.copydrum.com` → 일본어 페이지 (ja)
- `en.copydrum.com` → 영어 페이지 (en)
- `www.copydrum.com` → `copydrum.com`으로 리디렉션 (301)

### 비정상 동작 (수정 필요)
- `copydrum.com` → `en.copydrum.com`으로 리디렉션 ❌
- `jp.copydrum.com` → `en.copydrum.com`으로 리디렉션 ❌

## 롤백 방법

문제가 발생하면:
1. `vercel.json`의 `redirects` 섹션 제거
2. `src/i18n/getLocaleFromHost.ts` 이전 버전으로 복원
3. Vercel 대시보드에서 리디렉션 규칙 확인 및 수정

