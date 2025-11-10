# Cursor 히스토리에서 오늘 날짜의 최신 버전으로 파일 복구 스크립트 v2

$historyPath = "$env:APPDATA\Cursor\User\History"
$projectPath = (Resolve-Path "C:\copydrum_site").Path
$todayStart = Get-Date "2025-11-10 00:00:00"
$todayEnd = Get-Date "2025-11-10 23:59:59"

Write-Host "프로젝트 경로: $projectPath"
Write-Host "히스토리 경로: $historyPath"
Write-Host "복구 대상 날짜: $todayStart ~ $todayEnd"
Write-Host ""

# 오늘 수정된 파일 목록
$filesToRestore = Get-ChildItem -Path "$projectPath\src" -Recurse -File | 
    Where-Object { $_.LastWriteTime -ge $todayStart }

Write-Host "복구할 파일 수: $($filesToRestore.Count)"
Write-Host ""

# 히스토리 디렉토리에서 entries.json을 읽어 파일 매핑 생성
Write-Host "히스토리 스캔 중..."
$historyMap = @{}

$historyDirs = Get-ChildItem -Path $historyPath -Directory | 
    Where-Object { $_.LastWriteTime -ge $todayStart }

foreach ($dir in $historyDirs) {
    $entriesFile = Join-Path $dir.FullName "entries.json"
    if (Test-Path $entriesFile) {
        try {
            $entries = Get-Content $entriesFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($entries -and $entries.source) {
                $sourcePath = $entries.source
                if ($sourcePath -like "*copydrum_site*") {
                    # 상대 경로로 변환
                    $relativePath = $sourcePath.Replace($projectPath, "").TrimStart('\')
                    if (-not $historyMap.ContainsKey($relativePath)) {
                        $historyMap[$relativePath] = @()
                    }
                    $historyMap[$relativePath] += $dir
                }
            }
        } catch {
            # entries.json 파싱 실패 시 무시
        }
    }
}

Write-Host "히스토리 매핑 완료: $($historyMap.Count) 개 파일 발견"
Write-Host ""

$restoredCount = 0
$failedCount = 0

foreach ($file in $filesToRestore) {
    $relativePath = $file.FullName.Replace($projectPath, "").TrimStart('\')
    Write-Host "처리 중: $relativePath"
    
    $found = $false
    
    # 히스토리 매핑에서 찾기
    if ($historyMap.ContainsKey($relativePath)) {
        $historyDirs = $historyMap[$relativePath]
        
        foreach ($dir in $historyDirs) {
            # 오늘 날짜의 최신 파일 찾기
            $historyFiles = Get-ChildItem -Path $dir.FullName -File | 
                Where-Object { 
                    $_.Name -ne "entries.json" -and 
                    $_.LastWriteTime -ge $todayStart -and 
                    $_.LastWriteTime -le $todayEnd
                } |
                Sort-Object LastWriteTime -Descending
            
            if ($historyFiles.Count -gt 0) {
                $latestFile = $historyFiles[0]
                try {
                    $content = Get-Content $latestFile.FullName -Raw -Encoding UTF8 -ErrorAction Stop
                    if ($content -and $content.Length -gt 0) {
                        # 백업 생성
                        $backupPath = "$($file.FullName).backup"
                        Copy-Item -Path $file.FullName -Destination $backupPath -ErrorAction SilentlyContinue
                        
                        # 파일 복구
                        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline -ErrorAction Stop
                        Write-Host "  ✓ 복구 완료: $($latestFile.LastWriteTime) (버전: $($latestFile.Name))" -ForegroundColor Green
                        $restoredCount++
                        $found = $true
                        break
                    }
                } catch {
                    Write-Host "  ✗ 파일 읽기 실패: $($latestFile.Name)" -ForegroundColor Red
                }
            }
        }
    }
    
    # 히스토리 매핑에 없으면 전체 검색
    if (-not $found) {
        # 파일 경로의 해시를 계산하여 직접 찾기 시도
        $filePathLower = $file.FullName.ToLower()
        $allHistoryDirs = Get-ChildItem -Path $historyPath -Directory | 
            Where-Object { $_.LastWriteTime -ge $todayStart }
        
        foreach ($dir in $allHistoryDirs) {
            $entriesFile = Join-Path $dir.FullName "entries.json"
            if (Test-Path $entriesFile) {
                try {
                    $entries = Get-Content $entriesFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($entries -and $entries.source -and $entries.source.ToLower() -eq $filePathLower) {
                        $historyFiles = Get-ChildItem -Path $dir.FullName -File | 
                            Where-Object { 
                                $_.Name -ne "entries.json" -and 
                                $_.LastWriteTime -ge $todayStart
                            } |
                            Sort-Object LastWriteTime -Descending
                        
                        if ($historyFiles.Count -gt 0) {
                            $latestFile = $historyFiles[0]
                            $content = Get-Content $latestFile.FullName -Raw -Encoding UTF8 -ErrorAction Stop
                            if ($content) {
                                Copy-Item -Path $file.FullName -Destination "$($file.FullName).backup" -ErrorAction SilentlyContinue
                                Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline -ErrorAction Stop
                                Write-Host "  ✓ 복구 완료 (전체 검색): $($latestFile.LastWriteTime)" -ForegroundColor Yellow
                                $restoredCount++
                                $found = $true
                                break
                            }
                        }
                    }
                } catch {}
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

if ($restoredCount -gt 0) {
    Write-Host ""
    Write-Host "백업 파일은 .backup 확장자로 저장되었습니다." -ForegroundColor Yellow
}

