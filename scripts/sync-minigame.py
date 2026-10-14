"""Generate a self-contained game root; no remote resources."""
from pathlib import Path
import shutil, json, re
root = Path(__file__).resolve().parents[1]
game = root/'minigame-project'
shutil.copy2(root/'web/shared.js', game/'shared.js')
store = (root/'miniprogram/store.js').read_text(encoding='utf-8')
(game/'store.js').write_text(store.replace('picture-puzzle-wechat-v1', 'picture-puzzle-minigame-v1'), encoding='utf-8')
names = json.loads(re.search(r'const sceneNames=(\[[^;]+\]);', (root/'web/shared.js').read_text(encoding='utf-8')).group(1))
(game/'assets').mkdir(exist_ok=True)
for path in (root/'miniprogram/assets').iterdir():
    if path.is_file(): shutil.copy2(path, game/'assets'/path.name)
packages = []
for i, name in enumerate(names):
    package = 'artworks-'+chr(97+i//2)
    dest = game/package
    (dest/'assets').mkdir(parents=True, exist_ok=True)
    shutil.copy2(root/'miniprogram'/package/'assets'/f'{name}.jpg', dest/'assets'/f'{name}.jpg')
    (dest/'game.js').write_text('// Local image resource subpackage.\n', encoding='utf-8')
    if package not in packages: packages.append(package)
config = {'deviceOrientation':'portrait', 'showStatusBar':False,
          'subpackages':[{'name':p,'root':p+'/'} for p in packages]}
(game/'game.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
print('Synced',len(names),'scenes and',len(packages),'game subpackages')
