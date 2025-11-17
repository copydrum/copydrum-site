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
        path = unquote(uri[8:])
        return Path(path)
    return None

def find_files_nov7_to_nov9():
    """11월 7일~9일 작업 파일 찾기"""
    if not history_path.exists():
        print(f"히스토리 경로를 찾을 수 없습니다: {history_path}")
        return []
    
    found_files = []
    history_dirs = [d for d in history_path.iterdir() if d.is_dir()]
    
    # 11월 7일 00:00 ~ 11월 9일 23:59:59
    start_time = datetime(2025, 11, 7, 0, 0, 0)
    end_time = datetime(2025, 11, 10, 0, 0, 0)
    
    print(f"11월 7일~9일 작업 파일 검색 중...")
    print(f"시간 범위: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    for history_dir in history_dirs:
        try:
            dir_time = datetime.fromtimestamp(history_dir.stat().st_mtime)
            
            if dir_time < start_time or dir_time >= end_time:
                continue
            
            entries_file = history_dir / "entries.json"
            if not entries_file.exists():
                continue
            
            with open(entries_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, dict) and 'resource' in data:
                resource_uri = data['resource']
                file_path = decode_file_uri(resource_uri)
                
                if file_path and 'copydrum' in str(file_path).lower():
                    if 'entries' in data and isinstance(data['entries'], list) and len(data['entries']) > 0:
                        latest_entry = max(data['entries'], key=lambda x: x.get('timestamp', 0))
                        entry_id = latest_entry.get('id', '')
                        
                        history_files = list(history_dir.glob("*"))
                        history_files = [f for f in history_files if f.is_file() and f.name != "entries.json"]
                        
                        if history_files:
                            matching_file = None
                            for hf in history_files:
                                if entry_id in hf.name or hf.name.startswith(entry_id.split('.')[0]):
                                    matching_file = hf
                                    break
                            
                            if not matching_file:
                                matching_file = max(history_files, key=lambda x: x.stat().st_mtime)
                            
                            found_files.append({
                                'history_dir': history_dir,
                                'file_path': file_path,
                                'history_file': matching_file,
                                'timestamp': dir_time,
                                'entry': latest_entry
                            })
        except Exception as e:
            continue
    
    found_files.sort(key=lambda x: x['timestamp'], reverse=True)
    return found_files

def restore_file(file_info, target_path):
    """히스토리 파일을 대상 경로로 복구"""
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_info['history_file'], target_path)
        timestamp = file_info['timestamp'].timestamp()
        os.utime(target_path, (timestamp, timestamp))
        return True
    except Exception as e:
        print(f"  오류: {e}")
        return False

def main():
    print("=" * 70)
    print("11월 7일~9일 작업물 복구")
    print("=" * 70)
    
    found_files = find_files_nov7_to_nov9()
    
    if not found_files:
        print("\n[오류] 11월 7일~9일 작업 파일을 찾을 수 없습니다.")
        return
    
    print(f"\n[성공] {len(found_files)}개 파일 발견!")
    
    # 날짜별로 그룹화
    date_groups = {}
    for file_info in found_files:
        date_str = file_info['timestamp'].strftime('%Y-%m-%d')
        if date_str not in date_groups:
            date_groups[date_str] = []
        date_groups[date_str].append(file_info)
    
    print("\n날짜별 파일 수:")
    for date_str in sorted(date_groups.keys(), reverse=True):
        print(f"  {date_str}: {len(date_groups[date_str])}개 파일")
    
    print("\n발견된 파일 목록 (최신순):")
    print("-" * 70)
    
    # 파일별로 그룹화 (가장 최신 버전 선택)
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
            file_name = Path(file_key).name
            if 'src' in file_key:
                parts = file_key.split('src/')
                if len(parts) > 1:
                    target_path = project_path / "src" / parts[1].replace('/', '\\')
                else:
                    target_path = project_path / "src" / file_name
            else:
                target_path = project_path / file_name
        
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










