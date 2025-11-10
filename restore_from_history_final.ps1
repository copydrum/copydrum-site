# Cursor 히스토리에서 오늘 날짜의 최신 버전으로 파일 복구 스크립트 (최종)

$historyPath = "$env:APPDATA\Cursor\User\History"
$projectPath = (Resolve-Path "C:\copydrum_site").Path

# 타임스탬프 변환 함수 (밀리초 -> DateTime)
function Convert-Timestamp {
    param([long]$timestamp)
    $epoch = [DateTimeOffset]::FromUnixTimeMilliseconds($timestamp)
    return $epoch.LocalDateTime
}

Write-Host "프로젝트 경로: $projectPath"
Write-Host "히스토리 경로: $historyPath"
Write-Host ""

# 오늘 수정된 파일 목록
$filesToRestore = Get-ChildItem -Path "$projectPath\src" -Recurse -File | 
    Where-Object { $_.LastWriteTime -gt (Get-Date "2025-11-10 00:00:00") }

Write-Host "복구할 파일 수: $($filesToRestore.Count)"
Write-Host ""

# 히스토리 디렉토리 스캔
Write-Host "히스토리 스캔 중..."
$historyMap = @{}

$historyDirs = Get-ChildItem -Path $historyPath -Directory | 
    Where-Object { $_.LastWriteTime -gt (Get-Date "2025-11-10 00:00:00") }

foreach ($dir in $historyDirs) {
    $entriesFile = Join-Path $dir.FullName "entries.json"
    if (Test-Path $entriesFile) {
        try {
            $jsonContent = Get-Content $entriesFile -Raw -Encoding UTF8
            $entries = $jsonContent | ConvertFrom-Json -ErrorAction Stop
            
            if ($entries -and $entries.resource) {
                # file:///c%3A/... 형식을 일반 경로로 변환
                $resourcePath = $entries.resource -replace "file:///", "" -replace "%3A", ":" -replace "/", "\"
                # 대소문자 정규화
                $resourcePath = $resourcePath.ToLower()
                $projectPathLower = $projectPath.ToLower()
                
                if ($resourcePath -like "*copydrum_site*") {
                    # 상대 경로로 변환 (대소문자 무시)
                    if ($resourcePath.StartsWith($projectPathLower)) {
                        $relativePath = $resourcePath.Substring($projectPathLower.Length).TrimStart('\')
                    } else {
                        # 전체 경로에서 프로젝트 경로 부분 추출
                        $match = [regex]::Match($resourcePath, "copydrum_site[\\/](.+)")
                        if ($match.Success) {
                            $relativePath = $match.Groups[1].Value
                        } else {
                            continue
                        }
                    }
                    
                    if (-not $historyMap.ContainsKey($relativePath)) {
                        $historyMap[$relativePath] = @()
                    }
                    
                    # 각 엔트리의 타임스탬프와 파일명 저장
                    $versions = @()
                    foreach ($entry in $entries.entries) {
                        $versionFile = Join-Path $dir.FullName $entry.id
                        if (Test-Path $versionFile) {
                            $fileInfo = Get-Item $versionFile
                            $versions += [PSCustomObject]@{
                                File = $versionFile
                                Timestamp = $entry.timestamp
                                DateTime = Convert-Timestamp $entry.timestamp
                                Name = $entry.id
                            }
                        }
                    }
                    
                    if ($versions.Count -gt 0) {
                        $historyMap[$relativePath] += $versions
                    }
                }
            }
        } catch {
            # JSON 파싱 실패 시 무시
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
    
    if ($historyMap.ContainsKey($relativePath)) {
        $versions = $historyMap[$relativePath]
        
        # 오늘 날짜의 최신 버전 찾기
        $todayVersions = $versions | Where-Object { 
            $_.DateTime -gt (Get-Date "2025-11-10 00:00:00") -and 
            $_.DateTime -lt (Get-Date "2025-11-10 23:59:59")
        } | Sort-Object DateTime -Descending
        
        if ($todayVersions.Count -gt 0) {
            $latestVersion = $todayVersions[0]
            try {
                $content = Get-Content $latestVersion.File.FullName -Raw -Encoding UTF8 -ErrorAction Stop
                if ($content -and $content.Length -gt 0) {
                    # 백업 생성
                    $backupPath = "$($file.FullName).backup"
                    Copy-Item -Path $file.FullName -Destination $backupPath -ErrorAction SilentlyContinue
                    
                    # 파일 복구
                    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline -ErrorAction Stop
                    Write-Host "  [OK] 복구 완료: $($latestVersion.DateTime) (버전: $($latestVersion.Name))" -ForegroundColor Green
                    $restoredCount++
                    $found = $true
                }
            } catch {
                Write-Host "  [ERROR] 파일 읽기 실패: $($latestVersion.File)" -ForegroundColor Red
            }
        } else {
            # 오늘 날짜 버전이 없으면 가장 최신 버전 사용
            $latestVersion = $versions | Sort-Object DateTime -Descending | Select-Object -First 1
            if ($latestVersion) {
                try {
                    $content = Get-Content $latestVersion.File.FullName -Raw -Encoding UTF8 -ErrorAction Stop
                    if ($content) {
                        $backupPath = "$($file.FullName).backup"
                        Copy-Item -Path $file.FullName -Destination $backupPath -ErrorAction SilentlyContinue
                        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline -ErrorAction Stop
                        Write-Host "  [OK] 복구 완료 (최신 버전): $($latestVersion.DateTime)" -ForegroundColor Yellow
                        $restoredCount++
                        $found = $true
                    }
                } catch {
                    Write-Host "  [ERROR] 파일 읽기 실패" -ForegroundColor Red
                }
            }
        }
    }
    
    if (-not $found) {
        Write-Host "  [SKIP] 히스토리를 찾을 수 없음" -ForegroundColor Gray
        $failedCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "복구 완료" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "성공: $restoredCount 개" -ForegroundColor Green
Write-Host "실패: $failedCount 개" -ForegroundColor Red
Write-Host ""

if ($restoredCount -gt 0) {
    Write-Host "백업 파일은 .backup 확장자로 저장되었습니다." -ForegroundColor Yellow
    Write-Host "필요시 백업 파일을 확인하세요." -ForegroundColor Yellow
}

