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

def find_design_files():
    """디자인 관련 파일 찾기 (CSS, TSX, TS 등)"""
    if not history_path.exists():
        print(f"히스토리 경로를 찾을 수 없습니다: {history_path}")
        return []
    
    found_files = []
    history_dirs = [d for d in history_path.iterdir() if d.is_dir()]
    
    # 11월 3일 이후 ~ 11월 10일 오후 2시 30분 이전
    start_time = datetime(2025, 11, 3, 23, 59, 0)
    end_time = datetime(2025, 11, 10, 14, 30, 0)
    
    print(f"디자인 파일 검색 중...")
    print(f"시간 범위: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    design_extensions = ['.tsx', '.ts', '.css', '.html']
    design_keywords = ['home', 'page', 'index', 'style', 'design', 'component']
    
    for history_dir in history_dirs:
        try:
            dir_time = datetime.fromtimestamp(history_dir.stat().st_mtime)
            
            if dir_time <= start_time or dir_time >= end_time:
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
                    # 디자인 관련 파일인지 확인
                    file_str = str(file_path).lower()
                    is_design_file = any(ext in file_str for ext in design_extensions) and \
                                   any(keyword in file_str for keyword in design_keywords)
                    
                    if is_design_file:
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
    print("디자인 파일 복구")
    print("=" * 70)
    
    found_files = find_design_files()
    
    if not found_files:
        print("\n[오류] 디자인 파일을 찾을 수 없습니다.")
        return
    
    print(f"\n[성공] {len(found_files)}개 파일 발견!")
    
    # 파일별로 그룹화
    file_groups = {}
    for file_info in found_files:
        file_key = str(file_info['file_path'])
        if file_key not in file_groups:
            file_groups[file_key] = []
        file_groups[file_key].append(file_info)
    
    restored_count = 0
    for file_key, versions in file_groups.items():
        latest = max(versions, key=lambda x: x['timestamp'])
        
        try:
            relative_path = Path(file_key).relative_to(Path("C:/copydrum_site"))
            target_path = project_path / relative_path
        except:
            file_name = Path(file_key).name
            if 'home' in file_key.lower() or 'page' in file_key.lower():
                target_path = project_path / "src" / "pages" / "home" / file_name
            else:
                target_path = project_path / "src" / file_name
        
        print(f"\n[파일] {relative_path if 'relative_path' in locals() else file_name}")
        print(f"   히스토리 시간: {latest['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
        
        if restore_file(latest, target_path):
            print(f"   [복구 완료]")
            restored_count += 1
        else:
            print(f"   [복구 실패]")
    
    print("\n" + "=" * 70)
    print(f"복구 완료: {restored_count}/{len(file_groups)} 파일")

if __name__ == "__main__":
    main()






























