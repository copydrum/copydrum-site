/**
 * PDF 파일 → Supabase Storage 마이그레이션 스크립트
 * 
 * 사용 방법:
 * 1. PDF 파일들을 로컬 폴더에 준비
 * 2. PDF 목록 JSON 파일 생성 (pdf-list.json)
 * 3. npx tsx scripts/migrate-pdfs.ts 실행
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 환경 변수 설정
const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('VITE_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PDFInfo {
  filePath: string;
  title: string;
  artist: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  price: number;
  imweb_product_id?: string;
  thumbnail_path?: string;
  preview_image_path?: string;
}

interface UploadResult {
  success: boolean;
  sheetId?: string;
  error?: string;
}

async function getOrCreateCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  // 카테고리 찾기
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .single();

  if (existing) {
    return existing.id;
  }

  // 없으면 생성
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({ name: categoryName })
    .select('id')
    .single();

  if (error) {
    console.warn(`⚠️  카테고리 생성 실패 (${categoryName}):`, error.message);
    return null;
  }

  return newCategory.id;
}

async function uploadThumbnail(filePath: string): Promise<string | null> {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // 이미지 파일만 허용
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return null;
    }

    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(`${Date.now()}-${fileName}`, fileBuffer, {
        contentType: `image/${ext.slice(1)}`,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.warn(`⚠️  썸네일 업로드 실패:`, error);
    return null;
  }
}

async function uploadPDF(pdfInfo: PDFInfo): Promise<UploadResult> {
  try {
    // 1. 파일 존재 확인
    if (!fs.existsSync(pdfInfo.filePath)) {
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${pdfInfo.filePath}`,
      };
    }

    // 2. 파일 읽기
    const fileBuffer = fs.readFileSync(pdfInfo.filePath);
    const fileName = path.basename(pdfInfo.filePath);
    const fileSize = fileBuffer.length;

    // PDF 파일 확인
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return {
        success: false,
        error: `PDF 파일이 아닙니다: ${fileName}`,
      };
    }

    // 3. Supabase Storage에 PDF 업로드
    const storagePath = `sheets/${Date.now()}-${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdf-files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage 업로드 실패: ${uploadError.message}`);
    }

    // 4. 공개 URL 생성 (또는 서명된 URL)
    const { data: urlData } = supabase.storage
      .from('pdf-files')
      .getPublicUrl(uploadData.path);

    // 5. 썸네일 업로드 (있는 경우)
    const thumbnailUrl = pdfInfo.thumbnail_path
      ? await uploadThumbnail(pdfInfo.thumbnail_path)
      : null;

    // 6. 카테고리 ID 가져오기
    const categoryId = pdfInfo.category
      ? await getOrCreateCategory(pdfInfo.category)
      : null;

    // 7. 데이터베이스에 레코드 생성
    const { data: sheet, error: dbError } = await supabase
      .from('drum_sheets')
      .insert({
        title: pdfInfo.title,
        artist: pdfInfo.artist,
        category_id: categoryId,
        difficulty: pdfInfo.difficulty || 'beginner',
        price: pdfInfo.price || 0,
        pdf_url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        file_size: fileSize,
        is_active: true,
        imweb_product_id: pdfInfo.imweb_product_id,
        migrated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      throw new Error(`DB 삽입 실패: ${dbError.message}`);
    }

    return {
      success: true,
      sheetId: sheet.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

async function migratePDFs(
  jsonFilePath: string,
  options: {
    concurrentLimit?: number;
    retryCount?: number;
  } = {}
): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{ title: string; error: string }>;
}> {
  const { concurrentLimit = 5, retryCount = 3 } = options;

  // 1. JSON 파일 읽기
  console.log(`\n📖 PDF 목록 읽기: ${jsonFilePath}`);
  const pdfList: PDFInfo[] = JSON.parse(
    fs.readFileSync(jsonFilePath, 'utf-8')
  );

  console.log(`✅ 총 ${pdfList.length}개의 PDF 파일 발견\n`);

  const result = {
    total: pdfList.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ title: string; error: string }>,
  };

  // 2. 배치 처리
  for (let i = 0; i < pdfList.length; i += concurrentLimit) {
    const batch = pdfList.slice(i, i + concurrentLimit);
    const batchNum = Math.floor(i / concurrentLimit) + 1;
    const totalBatches = Math.ceil(pdfList.length / concurrentLimit);

    console.log(
      `📦 배치 ${batchNum}/${totalBatches} 처리 중... (${i + 1}~${Math.min(i + concurrentLimit, pdfList.length)})`
    );

    // 동시 업로드
    const uploadPromises = batch.map(async (pdf) => {
      let lastError: string | undefined;
      
      // 재시도 로직
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        const uploadResult = await uploadPDF(pdf);
        
        if (uploadResult.success) {
          result.success++;
          console.log(`  ✅ ${pdf.title} - ${pdf.artist}`);
          return;
        }
        
        lastError = uploadResult.error;
        
        if (attempt < retryCount) {
          console.warn(`  ⚠️  ${pdf.title} 재시도 중... (${attempt}/${retryCount})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      // 모든 재시도 실패
      result.failed++;
      result.errors.push({
        title: pdf.title,
        error: lastError || '알 수 없는 오류',
      });
      console.error(`  ❌ ${pdf.title}: ${lastError}`);
    });

    await Promise.allSettled(uploadPromises);

    // 진행률 표시
    const progress = ((i + batch.length) / pdfList.length * 100).toFixed(1);
    console.log(
      `\n📊 진행률: ${progress}% (${result.success} 성공, ${result.failed} 실패)\n`
    );

    // Rate Limit 방지
    if (i + concurrentLimit < pdfList.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return result;
}

// 실행
async function main() {
  const jsonFilePath = process.argv[2] || './pdf-list.json';

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${jsonFilePath}`);
    console.error('\n사용법: npx tsx scripts/migrate-pdfs.ts [JSON파일경로]');
    console.error('\n예시 JSON 형식:');
    console.error(JSON.stringify(
      [
        {
          filePath: './pdfs/song1.pdf',
          title: '곡 제목',
          artist: '아티스트명',
          category: '록',
          difficulty: 'intermediate',
          price: 15000,
          imweb_product_id: '12345',
        },
      ],
      null,
      2
    ));
    process.exit(1);
  }

  console.log('🚀 PDF 파일 마이그레이션 시작\n');
  console.log(`📁 파일: ${jsonFilePath}`);
  console.log(`🌐 Supabase: ${supabaseUrl}\n`);

  const result = await migratePDFs(jsonFilePath, {
    concurrentLimit: 5,
    retryCount: 3,
  });

  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 마이그레이션 결과');
  console.log('='.repeat(50));
  console.log(`전체: ${result.total}개`);
  console.log(`✅ 성공: ${result.success}개`);
  console.log(`❌ 실패: ${result.failed}개`);
  console.log(`📈 성공률: ${((result.success / result.total) * 100).toFixed(1)}%`);

  if (result.errors.length > 0) {
    console.log('\n❌ 실패한 파일:');
    result.errors.slice(0, 20).forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.title}: ${err.error}`);
    });

    if (result.errors.length > 20) {
      console.log(`\n  ... 외 ${result.errors.length - 20}개`);
    }

    // 오류 로그 저장
    fs.writeFileSync(
      './pdf-error-log.json',
      JSON.stringify(result.errors, null, 2),
      'utf-8'
    );
    console.log('\n  자세한 내용은 pdf-error-log.json을 확인하세요.');
  }

  console.log('\n✅ 마이그레이션 완료!\n');
}

main().catch((error) => {
  console.error('\n❌ 치명적 오류:', error);
  process.exit(1);
});









