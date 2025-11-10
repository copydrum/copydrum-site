# Git 백업 설정 가이드

## 앞으로 이런 일을 방지하기 위한 설정

### 1. Git 원격 저장소 연결 (필수)

```bash
# GitHub/GitLab 등에 원격 저장소 생성 후
git remote add origin <원격저장소URL>
git branch -M main
git push -u origin main
```

### 2. 자동 커밋 스크립트

작업 전에 항상 커밋하세요:

```bash
git add .
git commit -m "작업 내용 설명"
git push
```

### 3. Cursor 설정

- 파일 저장 시 자동 저장 활성화
- Git 자동 커밋 확장 프로그램 사용 고려

### 4. 정기 백업

- 매일 작업 종료 전 Git 커밋 & 푸시
- 주간 백업을 외부 저장소에 저장

