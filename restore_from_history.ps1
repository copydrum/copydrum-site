# Cursor 히스토리에서 오늘 날짜의 최신 버전으로 파일 복구 스크립트

$historyPath = "$env:APPDATA\Cursor\User\History"
$projectPath = (Resolve-Path "C:\copydrum_site").Path
$today = Get-Date "2025-11-10"

Write-Host "프로젝트 경로: $projectPath"
Write-Host "히스토리 경로: $historyPath"
Write-Host "복구 대상 날짜: $today"
Write-Host ""

# 오늘 수정된 파일 목록 가져오기
$filesToRestore = Get-ChildItem -Path "$projectPath\src" -Recurse -File | 
    Where-Object { $_.LastWriteTime -gt (Get-Date "2025-11-10 00:00") }

Write-Host "복구할 파일 수: $($filesToRestore.Count)"
Write-Host ""

$restoredCount = 0
$failedCount = 0

foreach ($file in $filesToRestore) {
    $relativePath = $file.FullName.Replace($projectPath, "").TrimStart('\')
    Write-Host "처리 중: $relativePath"
    
    # 파일 경로를 해시로 변환 (Cursor가 사용하는 방식)
    $filePathBytes = [System.Text.Encoding]::UTF8.GetBytes($file.FullName.ToLower())
    $hash = [System.BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash($filePathBytes)).Replace("-", "").ToLower()
    
    # 해시의 첫 부분으로 디렉토리 찾기 (Cursor는 해시의 일부를 사용)
    $possibleDirs = Get-ChildItem -Path $historyPath -Directory | 
        Where-Object { $_.Name -like "*$($hash.Substring(0,8))*" -or $_.Name -like "*$($hash.Substring(8,8))*" }
    
    $found = $false
    
    foreach ($dir in $possibleDirs) {
        $entriesFile = Join-Path $dir.FullName "entries.json"
        if (Test-Path $entriesFile) {
            try {
                $entries = Get-Content $entriesFile -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($entries -and $entries.source -eq $file.FullName) {
                    # 오늘 날짜의 최신 파일 찾기
                    $historyFiles = Get-ChildItem -Path $dir.FullName -File | 
                        Where-Object { $_.LastWriteTime -ge $today -and $_.Name -ne "entries.json" } |
                        Sort-Object LastWriteTime -Descending
                    
                    if ($historyFiles.Count -gt 0) {
                        $latestFile = $historyFiles[0]
                        $content = Get-Content $latestFile.FullName -Raw -Encoding UTF8
                        if ($content) {
                            Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
                            Write-Host "  ✓ 복구 완료: $($latestFile.LastWriteTime)" -ForegroundColor Green
                            $restoredCount++
                            $found = $true
                            break
                        }
                    }
                }
            } catch {
                # entries.json 파싱 실패 시 무시
            }
        }
        
        # entries.json이 없거나 실패한 경우, 디렉토리 내의 모든 파일 확인
        if (-not $found) {
            $historyFiles = Get-ChildItem -Path $dir.FullName -File | 
                Where-Object { $_.LastWriteTime -ge $today -and $_.Name -ne "entries.json" } |
                Sort-Object LastWriteTime -Descending
            
            if ($historyFiles.Count -gt 0) {
                # 파일 내용이 실제 소스 파일과 유사한지 확인
                $latestFile = $historyFiles[0]
                $content = Get-Content $latestFile.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                if ($content -and $content.Length -gt 100) {
                    # 간단한 검증: 파일 확장자와 내용이 일치하는지
                    $isValid = $false
                    if ($file.Extension -eq ".tsx" -or $file.Extension -eq ".ts") {
                        if ($content -match "import|export|function|const|interface") {
                            $isValid = $true
                        }
                    } elseif ($file.Extension -eq ".css") {
                        if ($content -match "@|{|}|:|;") {
                            $isValid = $true
                        }
                    } else {
                        $isValid = $true
                    }
                    
                    if ($isValid) {
                        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
                        Write-Host "  ✓ 복구 완료 (추정): $($latestFile.LastWriteTime)" -ForegroundColor Yellow
                        $restoredCount++
                        $found = $true
                        break
                    }
                }
            }
        }
    }
    
    if (-not $found) {
        Write-Host "  ✗ 히스토리를 찾을 수 없음" -ForegroundColor Red
        $failedCount++
    }
}

Write-Host ""
Write-Host "=== 복구 완료 ===" -ForegroundColor Cyan
Write-Host "성공: $restoredCount 개" -ForegroundColor Green
Write-Host "실패: $failedCount 개" -ForegroundColor Red

