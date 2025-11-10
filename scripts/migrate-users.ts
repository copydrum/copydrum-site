/**
 * 아임웹 회원 데이터 → Supabase 마이그레이션 스크립트
 * 
 * 사용 방법:
 * 1. 아임웹에서 회원 데이터를 CSV로 내보내기
 * 2. .env 파일에 Supabase 정보 설정
 * 3. npx tsx scripts/migrate-users.ts 실행
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// 환경 변수 설정
const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('VITE_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ImwebUser {
  email: string;
  name: string;
  phone?: string;
  created_at?: string;
  imweb_id?: string;
  [key: string]: any; // CSV 컬럼이 다양할 수 있음
}

interface MigrationResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

async function migrateUsers(
  csvFilePath: string,
  options: {
    batchSize?: number;
    skipDuplicates?: boolean;
  } = {}
): Promise<MigrationResult> {
  const { batchSize = 100, skipDuplicates = true } = options;

  // 1. CSV 파일 읽기
  console.log(`\n📖 CSV 파일 읽기: ${csvFilePath}`);
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');

  const records: ImwebUser[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // UTF-8 BOM 처리
  });

  console.log(`✅ 총 ${records.length}명의 회원 데이터 발견\n`);

  const result: MigrationResult = {
    total: records.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  // 2. 배치 처리
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);

    console.log(`📦 배치 ${batchNum}/${totalBatches} 처리 중... (${i + 1}~${Math.min(i + batchSize, records.length)})`);

    // 데이터 정제
    const profiles = batch
      .map(user => {
        const email = (user.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) {
          return null; // 유효하지 않은 이메일 제외
        }

        return {
          email,
          name: (user.name || user.email?.split('@')[0] || '회원').trim(),
          phone: user.phone ? user.phone.trim() : null,
          imweb_user_id: user.imweb_id || user.id || null,
          role: 'user' as const,
          created_at: user.created_at 
            ? new Date(user.created_at).toISOString()
            : new Date().toISOString(),
          migrated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (profiles.length === 0) {
      console.log(`⚠️  이 배치에 유효한 데이터가 없습니다.\n`);
      continue;
    }

    try {
      // 3. Supabase에 일괄 삽입
      const { data, error } = skipDuplicates
        ? await supabase
            .from('profiles')
            .upsert(profiles, {
              onConflict: 'email',
              ignoreDuplicates: false,
            })
            .select()
        : await supabase
            .from('profiles')
            .insert(profiles)
            .select();

      if (error) {
        throw error;
      }

      result.success += profiles.length;
      console.log(`✅ ${profiles.length}명 성공\n`);

      // 4. API Rate Limit 방지
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`❌ 배치 오류:`, error.message);

      // 개별 처리로 재시도
      console.log(`   개별 처리로 재시도 중...`);
      for (const profile of profiles) {
        try {
          const { error: singleError } = await supabase
            .from('profiles')
            .upsert(profile, {
              onConflict: 'email',
              ignoreDuplicates: false,
            });

          if (singleError) {
            result.failed++;
            result.errors.push({
              email: profile.email,
              error: singleError.message,
            });
            console.error(`   ❌ ${profile.email}: ${singleError.message}`);
          } else {
            result.success++;
          }
        } catch (err: any) {
          result.failed++;
          result.errors.push({
            email: profile.email,
            error: err.message,
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('');
    }

    // 진행률 표시
    const progress = ((i + batch.length) / records.length * 100).toFixed(1);
    console.log(`📊 진행률: ${progress}% (${result.success} 성공, ${result.failed} 실패)\n`);
  }

  return result;
}

// 실행
async function main() {
  const csvFilePath = process.argv[2] || './imweb-users.csv';

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${csvFilePath}`);
    console.error('\n사용법: npx tsx scripts/migrate-users.ts [CSV파일경로]');
    process.exit(1);
  }

  console.log('🚀 아임웹 회원 마이그레이션 시작\n');
  console.log(`📁 파일: ${csvFilePath}`);
  console.log(`🌐 Supabase: ${supabaseUrl}\n`);

  const result = await migrateUsers(csvFilePath, {
    batchSize: 100,
    skipDuplicates: true,
  });

  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 마이그레이션 결과');
  console.log('='.repeat(50));
  console.log(`전체: ${result.total}명`);
  console.log(`✅ 성공: ${result.success}명`);
  console.log(`❌ 실패: ${result.failed}명`);
  console.log(`📈 성공률: ${((result.success / result.total) * 100).toFixed(1)}%`);

  if (result.errors.length > 0 && result.errors.length <= 20) {
    console.log('\n❌ 실패한 항목:');
    result.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.email}: ${err.error}`);
    });
  } else if (result.errors.length > 20) {
    console.log(`\n⚠️  ${result.errors.length}개의 오류가 발생했습니다.`);
    console.log('   자세한 내용은 error-log.json을 확인하세요.');
    
    // 오류 로그 저장
    fs.writeFileSync(
      './error-log.json',
      JSON.stringify(result.errors, null, 2),
      'utf-8'
    );
  }

  console.log('\n✅ 마이그레이션 완료!\n');
}

main().catch((error) => {
  console.error('\n❌ 치명적 오류:', error);
  process.exit(1);
});









