# GitHub + Vercel 자동 배포 가이드

이 문서는 `C:\copydrum_site` 프로젝트를 GitHub와 Vercel에 연결하여 커밋/푸시만으로 자동 배포가 이뤄지도록 설정하는 방법을 안내합니다.

## 1. 사전 준비

- GitHub 계정과 Vercel 계정을 준비합니다.
- 로컬 개발 환경에 Git이 설치되어 있는지 확인합니다.
- 프로젝트 루트(`C:\copydrum_site`)에서 명령을 실행합니다.
- 로컬 `.env` 파일에 아래 환경 변수가 모두 채워져 있는지 확인합니다.
  - `VITE_PUBLIC_SUPABASE_URL`
  - `VITE_PUBLIC_SUPABASE_ANON_KEY`
  - `VITE_INICIS_MID`
  - `VITE_INICIS_API_KEY`
  - `VITE_INICIS_MERCHANT_KEY`
  - `VITE_INICIS_SIGN_KEY`
  - `VITE_PAYACTION_USER_ID`
  - `VITE_PAYACTION_API_KEY`

> 참고: `.env` 파일은 `.gitignore`에 의해 업로드되지 않습니다. 공유가 필요하면 `.env.example`을 복사해 사용하세요.

## 2. Git 저장소 초기화 및 첫 커밋

1. Git 초기화
   ```powershell
   git init
   ```
2. 초기 커밋을 만들기 전에 필요하다면 사용자 정보를 설정합니다.
   ```powershell
   git config user.name "Your Name"
   git config user.email "your-email@example.com"
   ```
3. 의존성 설치 기록은 `package-lock.json`에 이미 포함되어 있으므로 그대로 커밋합니다.
4. 스테이징 및 커밋
   ```powershell
   git add .
   git commit -m "Initialize project"
   ```

## 3. GitHub 저장소 생성 및 연결

1. GitHub에서 새 저장소를 생성합니다. (예: `copydrum-site`)
2. 생성된 저장소의 원격 URL을 확인합니다. (예: `https://github.com/username/copydrum-site.git`)
3. 로컬 저장소에 원격을 추가합니다.
   ```powershell
   git remote add origin https://github.com/username/copydrum-site.git
   ```
4. 기본 브랜치가 `main`인지 확인하고 첫 푸시를 실행합니다.
   ```powershell
   git branch -M main
   git push -u origin main
   ```

## 4. Vercel 프로젝트 생성 및 GitHub 연동

1. [Vercel 대시보드](https://vercel.com/dashboard)에 접속하여 **Add New… → Project**를 선택합니다.
2. Git Provider로 GitHub를 선택하고 방금 업로드한 저장소를 Import합니다.
3. **Framework Preset**은 `Vite`로 자동 인식되거나 직접 선택합니다.
4. **Build & Output 설정**
   - Install Command: `npm install` (기본값)
   - Build Command: `npm run build`
   - Output Directory: `out` (Vite 설정과 동일)
5. **Environment Variables** 섹션에 `.env.example`에 있는 8개 변수를 모두 입력합니다.
   - Supabase 대시보드에서 URL/Anon key를 확인합니다.
   - Inicis/Payaction 키는 해당 결제사 관리자 페이지에서 확인합니다.
6. **Deploy** 버튼을 누르면 첫 빌드가 시작되고 몇 분 후 배포가 완료됩니다.

## 5. 커스텀 도메인 연결

1. Vercel 프로젝트의 **Settings → Domains** 메뉴로 이동합니다.
2. `Add` 버튼을 눌러 소유한 도메인을 입력하고 추가합니다.
3. Vercel이 안내하는 DNS 레코드를 도메인 관리업체에 설정합니다.
   - A 레코드 또는 CNAME 레코드를 제공받게 됩니다.
   - DNS 적용까지 최대 24시간이 걸릴 수 있습니다.
4. DNS가 정상 연결되면 Vercel이 자동으로 SSL 인증서를 발급하여 HTTPS가 활성화됩니다.

## 6. 배포 확인 및 모니터링

- Vercel의 **Deployments** 탭에서 빌드 로그와 배포 상태를 확인할 수 있습니다.
- 문제가 발생하면 로그를 확인하고 수정 후 다시 커밋/푸시합니다.
- Vercel Analytics나 Supabase 로그를 통해 추가 모니터링을 설정할 수 있습니다.

## 7. 이후 작업 플로우

1. Cursor AI 또는 로컬 에디터로 코드를 수정합니다.
2. 변경 사항을 확인 후 커밋합니다.
   ```powershell
   git add .
   git commit -m "변경 내용 요약"
   ```
3. 원격 저장소에 푸시합니다.
   ```powershell
   git push
   ```
4. Vercel이 자동으로 새로운 커밋을 감지하고 빌드/배포를 진행합니다. (보통 2~3분)
5. 배포 완료 후 연결된 도메인에서 변경 사항을 바로 확인할 수 있습니다.

## 8. 추가 팁

- **환경 변수 변경** 시 Vercel 대시보드에서 값을 업데이트하고 `Redeploy` 버튼을 눌러 새 값을 반영합니다.
- **수동 배포**가 필요하면 Vercel CLI(`npm i -g vercel`)를 사용해 `vercel deploy`를 실행할 수 있지만, 기본적으로는 Git 연동만으로 충분합니다.
- 긴급 롤백이 필요할 경우 Vercel Deployments 목록에서 이전 배포를 **Promote**하면 즉시 이전 버전으로 전환됩니다.

이제 GitHub에 푸시하는 것만으로 자동으로 도메인에 반영되는 배포 파이프라인이 준비되었습니다.

