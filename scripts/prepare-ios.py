from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
web = root / 'web'
target = root / 'ios/BibleStoryPuzzle/Web'
target.mkdir(parents=True, exist_ok=True)
# Synchronize exactly, but operate only inside this known generated directory.
for entry in target.iterdir():
    if entry.is_dir(): shutil.rmtree(entry)
    else: entry.unlink()
for entry in web.iterdir():
    if entry.is_dir():
        shutil.copytree(entry, target / entry.name, ignore=shutil.ignore_patterns('originals', '*-crop.jpg', 'asset-manifest.json'))
    else: shutil.copy2(entry, target / entry.name)
print('Staged offline iOS resources (source masters remain in repository).')
