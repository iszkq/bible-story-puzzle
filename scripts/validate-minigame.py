"""Check game structure, complete roster, self-contained imports and package sizes."""
from pathlib import Path
import json, re, subprocess
root=Path(__file__).resolve().parents[1]
game=root/'minigame-project'
project=json.loads((game/'project.config.json').read_text(encoding='utf-8'))
assert project['compileType']=='game' and project['miniprogramRoot']=='./'
config=json.loads((game/'game.json').read_text(encoding='utf-8'))
packages=[game/p['root'] for p in config['subpackages']]
assert len(packages)==12
for p in packages:
    assert (p/'game.js').exists()
    size=sum(f.stat().st_size for f in p.rglob('*') if f.is_file())
    assert size<2*1024*1024,(p.name,size)
main=sum(p.stat().st_size for p in game.rglob('*') if p.is_file() and not any(pack in p.parents for pack in packages))
total=sum(p.stat().st_size for p in game.rglob('*') if p.is_file())
assert main<2*1024*1024 and total<20*1024*1024
assert (game/'shared.js').read_bytes()==(root/'web/shared.js').read_bytes()
names=json.loads(re.search(r'const sceneNames=(\[[^;]+\]);',(game/'shared.js').read_text(encoding='utf-8')).group(1))
for i,name in enumerate(names):
    assert (game/'assets'/f'{name}.jpg').exists()
    p=game/('artworks-'+chr(97+i//2))/'assets'/f'{name}.jpg'
    assert p.read_bytes()==(root/'miniprogram'/p.relative_to(game)).read_bytes()
for p in game.rglob('*.js'):
    result=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    source=p.read_text(encoding='utf-8-sig')
    for dependency in re.findall(r"require\(['\"]([^'\"]+)['\"]\)",source):
        target=(p.parent/dependency).with_suffix('.js').resolve()
        assert target.is_relative_to(game.resolve()) and target.exists(),(p,dependency)
    assert not re.search(r'\b(Page\(|document\.|createSelectorQuery\()',source),p
assert 'picture-puzzle-minigame-v1' in (game/'store.js').read_text(encoding='utf-8')
print(f'Validated independent game root; {len(names)} scenes; main {main/1024:.0f} KiB; total {total/1024/1024:.1f} MiB; all 12 subpackages below 2 MiB.')
