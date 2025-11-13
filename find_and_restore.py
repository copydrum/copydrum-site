import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from urllib.parse import unquote

# 설정
project_path = Path(r"C:\copydrum_site")
history_path = Path(os.path.expanduser(r"~\AppData\Roaming\Cursor\User\History"))

def decode_file_uri(uri):
    """file:// URI를 일반 경로로 변환"""
    if uri.startswith("file:///"):
        # Windows 경로 처리
        path = unquote(uri[8:])  # file:/// 제거하고 디코딩
        return Path(path)
    return None

def find_copydrum_files_in_history():
    """히스토리에서 copydrum_site 관련 파일 찾기"""
    if not history_path.exists():
        print(f"히스토리 경로를 찾을 수 없습니다: {history_path}")
        return []
    
    found_files = []
    history_dirs = [d for d in history_path.iterdir() if d.is_dir()]
    
    print(f"총 {len(history_dirs)}개 히스토리 디렉토리 스캔 중...")
    
    for history_dir in history_dirs:
        entries_file = history_dir / "entries.json"
        if not entries_file.exists():
            continue
        
        try:
            with open(entries_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            if isinstance(data, dict) and 'resource' in data:
                resource_uri = data['resource']
                file_path = decode_file_uri(resource_uri)
                
                if file_path and 'copydrum' in str(file_path).lower():
                    # entries 배열에서 최신 버전 찾기
                    if 'entries' in data and isinstance(data['entries'], list) and len(data['entries']) > 0:
                        latest_entry = max(data['entries'], key=lambda x: x.get('timestamp', 0))
                        entry_id = latest_entry.get('id', '')
                        
                        # 실제 파일 찾기
                        history_files = list(history_dir.glob("*"))
                        history_files = [f for f in history_files if f.is_file() and f.name != "entries.json"]
                        
                        if history_files:
                            # entry_id와 일치하는 파일 찾기
                            matching_file = None
                            for hf in history_files:
                                if entry_id in hf.name or hf.name.startswith(entry_id.split('.')[0]):
                                    matching_file = hf
                                    break
                            
                            if not matching_file:
                                # 가장 최신 파일 사용
                                matching_file = max(history_files, key=lambda x: x.stat().st_mtime)
                            
                            dir_time = datetime.fromtimestamp(history_dir.stat().st_mtime)
                            
                            found_files.append({
                                'history_dir': history_dir,
                                'file_path': file_path,
                                'history_file': matching_file,
                                'timestamp': dir_time,
                                'entry': latest_entry
                            })
        except Exception as e:
            continue
    
    # 타임스탬프로 정렬 (최신순)
    found_files.sort(key=lambda x: x['timestamp'], reverse=True)
    return found_files

def restore_file(file_info, target_path):
    """히스토리 파일을 대상 경로로 복구"""
    try:
        # 대상 디렉토리 생성
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 파일 복사
        shutil.copy2(file_info['history_file'], target_path)
        
        # 파일 수정 시간을 히스토리 시간으로 설정
        timestamp = file_info['timestamp'].timestamp()
        os.utime(target_path, (timestamp, timestamp))
        
        return True
    except Exception as e:
        print(f"  오류: {e}")
        return False

def main():
    print("=" * 70)
    print("Cursor 히스토리에서 copydrum_site 파일 검색 및 복구")
    print("=" * 70)
    
    found_files = find_copydrum_files_in_history()
    
    if not found_files:
        print("\n[오류] copydrum_site 관련 파일을 찾을 수 없습니다.")
        return
    
    print(f"\n[성공] {len(found_files)}개 파일 발견!")
    print("\n발견된 파일 목록:")
    print("-" * 70)
    
    # 파일별로 그룹화
    file_groups = {}
    for file_info in found_files:
        file_key = str(file_info['file_path'])
        if file_key not in file_groups:
            file_groups[file_key] = []
        file_groups[file_key].append(file_info)
    
    restored_count = 0
    for file_key, versions in file_groups.items():
        # 가장 최신 버전 선택
        latest = max(versions, key=lambda x: x['timestamp'])
        
        # 프로젝트 내 상대 경로 계산
        try:
            relative_path = Path(file_key).relative_to(Path("C:/copydrum_site"))
            target_path = project_path / relative_path
        except:
            # 절대 경로에서 파일명만 추출
            file_name = Path(file_key).name
            # src 폴더에서 찾기
            target_path = project_path / "src" / file_name
            if not target_path.exists():
                continue
        
        print(f"\n[파일] {relative_path if 'relative_path' in locals() else file_name}")
        print(f"   히스토리 시간: {latest['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   히스토리 파일: {latest['history_file'].name}")
        
        if restore_file(latest, target_path):
            print(f"   [복구 완료]")
            restored_count += 1
        else:
            print(f"   [복구 실패]")
    
    print("\n" + "=" * 70)
    print(f"복구 완료: {restored_count}/{len(file_groups)} 파일")

if __name__ == "__main__":
    main()

