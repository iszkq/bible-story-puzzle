from pathlib import Path, PurePosixPath
import zipfile, json
root=Path(__file__).resolve().parents[1]
out=root/'outputs'
out.mkdir(exist_ok=True)
def add_source(z,p,rel):
    if p.name=='project.config.json':
        config=json.loads(p.read_text(encoding='utf-8'))
        config['appid']='touristappid'
        z.writestr(str(rel).replace('\\','/'),json.dumps(config,ensure_ascii=False,indent=2))
    else: z.write(p,rel)
mini=out/'拾光拼图册-微信小程序.zip'
with zipfile.ZipFile(mini,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'miniprogram').rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(root))
    for p in [root/'project.config.json',root/'docs/微信小程序交付与导入.md',root/'docs/新增图片检查与命名.md',root/'docs/小程序完整回归验收.md',root/'docs/微信版本上传与发布.md']:
        add_source(z,p,p.relative_to(root))
full=out/'拾光拼图册-完整源码-iOS与微信.zip'
excluded={'.git','node_modules','test-results','work','outputs','originals','__pycache__','.agents','.codex','.aws','xcuserdata'}
with zipfile.ZipFile(full,'w',zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if not p.is_file() or excluded.intersection(p.relative_to(root).parts): continue
        if p.name=='project.private.config.json' or p.name.startswith('.env') or p.suffix in {'.ipa','.p12','.mobileprovision'}: continue
        add_source(z,p,p.relative_to(root))
for p in [mini,full]:
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        assert 'project.config.json' in z.namelist()
        assert 'miniprogram/pages/index/index.wxml' in z.namelist()
    print(p.name,round(p.stat().st_size/1024/1024,1),'MiB')
game=out/'拾光拼图册-微信小游戏.zip'
with zipfile.ZipFile(game,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'minigame-project').rglob('*'):
        if p.is_file() and p.name!='project.private.config.json': add_source(z,p,p.relative_to(root/'minigame-project'))
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
