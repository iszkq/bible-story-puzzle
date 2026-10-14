from pathlib import Path, PurePosixPath
import zipfile, json
root=Path(__file__).resolve().parents[1]
out=root/'outputs'
out.mkdir(exist_ok=True)
mini=out/'拾光拼图册-微信小程序.zip'
with zipfile.ZipFile(mini,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'miniprogram').rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(root))
    for p in [root/'project.config.json',root/'docs/微信小程序交付与导入.md',root/'docs/新增图片检查与命名.md']:
        z.write(p,p.relative_to(root))
full=out/'拾光拼图册-完整源码-iOS与微信.zip'
excluded={'.git','node_modules','test-results','work','outputs','originals','__pycache__'}
with zipfile.ZipFile(full,'w',zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if p.is_file() and not excluded.intersection(p.relative_to(root).parts): z.write(p,p.relative_to(root))
for p in [mini,full]:
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        assert 'project.config.json' in z.namelist()
        assert 'miniprogram/pages/index/index.wxml' in z.namelist()
    print(p.name,round(p.stat().st_size/1024/1024,1),'MiB')
game=out/'拾光拼图册-微信小游戏.zip'
with zipfile.ZipFile(game,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'minigame-project').rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(root/'minigame-project'))
with zipfile.ZipFile(game) as z:
    assert z.testzip() is None
    for name in ['game.js','game.json','engine.js','shared.js','store.js','project.config.json']:
        assert name in z.namelist()
    config=json.loads(z.read('project.config.json'))
    assert config['compileType']=='game'
    code=PurePosixPath(config.get('miniprogramRoot','./'))
    for name in ['game.js','game.json']:
        assert str(code/name) in z.namelist(), 'Game archive import root cannot resolve '+name
print(game.name,round(game.stat().st_size/1024/1024,1),'MiB')
print('Source image masters remain in workspace web/assets/originals; omitted from delivery archives.')
