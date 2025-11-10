# 관리자 권한 설정 가이드

## 방법 1: Supabase 대시보드에서 직접 변경

1. Supabase Dashboard 접속
2. Table Editor → `profiles` 테이블 선택
3. 로그인한 사용자의 이메일로 검색
4. `role` 컬럼을 `user` → `admin`으로 변경
5. 저장

## 방법 2: SQL 쿼리로 변경

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- 이메일로 관리자 권한 부여
UPDATE profiles 
SET role = 'admin'
WHERE email = 'your-email@example.com';

-- 확인
SELECT email, role FROM profiles WHERE email = 'your-email@example.com';
```

## 방법 3: 여러 사용자를 한 번에 관리자로 변경

```sql
-- 특정 이메일 목록을 관리자로 설정
UPDATE profiles 
SET role = 'admin'
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com'
);
```

## 확인 방법

브라우저 콘솔(F12)에서 다음 로그가 보여야 합니다:
- ✅ "관리자 이메일 확인됨: [이메일]"
- ✅ "관리자 권한이 없습니다" 메시지가 안 나와야 함









