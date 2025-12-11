import os
import json
import shutil
from pathlib import Path
from datetime import datetime

# 설정
project_path = Path(r"C:\copydrum_site")
history_path = Path(os.path.expanduser(r"~\AppData\Roaming\Cursor\User\History"))

def get_file_hash(file_path):
    """파일 경로의 해시값 계산 (Cursor가 사용하는 방식)"""
    import hashlib
    normalized_path = str(file_path).replace('\\', '/')
    hash_obj = hashlib.md5(normalized_path.encode())
    return hash_obj.hexdigest()

def find_latest_version(history_dir, target_file):
    """히스토리 디렉토리에서 가장 최신 버전 찾기"""
    if not history_dir.exists():
        return None
    
    # entries.json 확인
    entries_file = history_dir / "entries.json"
    if entries_file.exists():
        try:
            with open(entries_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'source' in data:
                    source_path = data['source']
                    # 경로가 일치하는지 확인
                    if target_file.as_posix().lower() in source_path.lower() or source_path.lower() in target_file.as_posix().lower():
                        # 가장 최신 파일 찾기
                        files = list(history_dir.glob("*"))
                        files = [f for f in files if f.is_file() and f.name != "entries.json"]
                        if files:
                            latest_file = max(files, key=lambda x: x.stat().st_mtime)
                            return latest_file
        except Exception as e:
            print(f"Error reading entries.json: {e}")
    
    return None

def restore_file_from_history(target_file):
    """히스토리에서 파일 복구"""
    if not history_path.exists():
        print(f"History path not found: {history_path}")
        return False
    
    # 모든 히스토리 디렉토리 확인
    history_dirs = [d for d in history_path.iterdir() if d.is_dir()]
    
    # 오늘 날짜의 히스토리만 필터링
    today = datetime.now().date()
    today_dirs = []
    for d in history_dirs:
        try:
            dir_time = datetime.fromtimestamp(d.stat().st_mtime)
            if dir_time.date() == today:
                today_dirs.append((d, dir_time))
        except:
            continue
    
    # 최신 순으로 정렬
    today_dirs.sort(key=lambda x: x[1], reverse=True)
    
    # 각 디렉토리에서 파일 찾기
    for history_dir, dir_time in today_dirs:
        latest_version = find_latest_version(history_dir, target_file)
        if latest_version:
            try:
                # 파일 복사
                shutil.copy2(latest_version, target_file)
                print(f"✓ 복구 완료: {target_file.name} (시간: {dir_time.strftime('%Y-%m-%d %H:%M:%S')})")
                return True
            except Exception as e:
                print(f"✗ 복구 실패: {target_file.name} - {e}")
    
    return False

def restore_all_src_files():
    """src 폴더의 모든 파일 복구"""
    src_path = project_path / "src"
    if not src_path.exists():
        print(f"src 폴더를 찾을 수 없습니다: {src_path}")
        return
    
    # 모든 소스 파일 찾기
    source_files = []
    for ext in ['*.tsx', '*.ts', '*.css', '*.json']:
        source_files.extend(src_path.rglob(ext))
    
    print(f"총 {len(source_files)}개 파일 발견")
    print("=" * 60)
    
    restored_count = 0
    for file_path in source_files:
        # node_modules 제외
        if 'node_modules' in str(file_path):
            continue
        
        relative_path = file_path.relative_to(project_path)
        print(f"\n처리 중: {relative_path}")
        
        if restore_file_from_history(file_path):
            restored_count += 1
    
    print("\n" + "=" * 60)
    print(f"복구 완료: {restored_count}/{len(source_files)} 파일")

if __name__ == "__main__":
    print("Cursor 히스토리에서 파일 복구 시작...")
    print(f"프로젝트 경로: {project_path}")
    print(f"히스토리 경로: {history_path}")
    print("=" * 60)
    
    restore_all_src_files()






































