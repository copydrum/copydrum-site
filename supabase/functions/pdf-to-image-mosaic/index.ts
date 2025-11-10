import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { pdfUrl, sheetId } = await req.json()

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: 'PDF URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('PDF 변환 시작:', pdfUrl)

    // PDF 파일 다운로드
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`)
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    console.log('PDF 다운로드 완료, 크기:', pdfBuffer.byteLength)

    // PDF를 이미지로 변환하는 외부 서비스 사용 (pdf2pic 대안)
    // 실제 구현에서는 Puppeteer나 다른 PDF 렌더링 서비스 사용
    
    // 임시로 Canvas API를 사용한 기본 이미지 생성 및 모자이크 처리
    const width = 595  // A4 width in points
    const height = 842 // A4 height in points
    
    // OffscreenCanvas 사용
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // 기본 흰색 배경 생성
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
    
    // 악보 미리보기 텍스트 추가 (실제로는 PDF 렌더링 결과 사용)
    ctx.fillStyle = 'black'
    ctx.font = '24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('DRUM SHEET PREVIEW', width / 2, 100)
    
    // 오선보 라인 그리기 (시뮬레이션)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    
    for (let i = 0; i < 5; i++) {
      const y = 150 + (i * 20)
      ctx.beginPath()
      ctx.moveTo(50, y)
      ctx.lineTo(width - 50, y)
      ctx.stroke()
    }
    
    // 음표 시뮬레이션
    ctx.fillStyle = 'black'
    for (let i = 0; i < 10; i++) {
      const x = 80 + (i * 50)
      const y = 160 + (Math.random() * 60)
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fill()
    }

    // 하단 절반에 모자이크 처리 적용
    const imageData = ctx.getImageData(0, 0, width, height)
    const mosaicImageData = applyMosaic(imageData, 20)
    ctx.putImageData(mosaicImageData, 0, 0)
    
    // 캔버스를 Blob으로 변환
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
    const arrayBuffer = await blob.arrayBuffer()
    
    console.log('이미지 생성 완료, 크기:', arrayBuffer.byteLength)
    
    // Supabase Storage에 이미지 업로드
    const fileName = `preview_${sheetId || crypto.randomUUID()}.jpg`
    const filePath = `previews/${fileName}`
    
    const { error: uploadError } = await supabaseClient.storage
      .from('drum-sheets')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })
    
    if (uploadError) {
      console.error('업로드 오류:', uploadError)
      throw uploadError
    }
    
    // 공개 URL 생성
    const { data } = supabaseClient.storage
      .from('drum-sheets')
      .getPublicUrl(filePath)
    
    console.log('이미지 업로드 완료:', data.publicUrl)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: data.publicUrl,
        fileName: fileName
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('PDF 변환 오류:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// 모자이크 처리 함수
function applyMosaic(imageData: ImageData, blockSize: number = 20): ImageData {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  
  // 하단 절반에만 모자이크 적용
  const startY = Math.floor(height / 2)
  
  for (let y = startY; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      // 블록의 평균 색상 계산
      let r = 0, g = 0, b = 0, count = 0
      
      for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4
          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          count++
        }
      }
      
      if (count > 0) {
        r = Math.floor(r / count)
        g = Math.floor(g / count)
        b = Math.floor(b / count)
        
        // 블록 전체를 평균 색상으로 채우기
        for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
          }
        }
      }
    }
  }
  
  return imageData
}