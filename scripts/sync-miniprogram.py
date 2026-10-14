"""Build local WeChat packages from the shared roster without network calls."""
from pathlib import Path
from PIL import Image
import shutil, json, re
root=Path(__file__).resolve().parents[1]
mini=root/'miniprogram'
shutil.copy2(root/'web/shared.js',mini/'shared.js')
names=json.loads(re.search(r'const sceneNames=(\[[^;]+\]);',(root/'web/shared.js').read_text(encoding='utf-8')).group(1))
for i,name in enumerate(names):
    package=mini/('artworks-'+chr(97+i//2))
    (package/'assets').mkdir(parents=True,exist_ok=True)
    (package/'loader').mkdir(parents=True,exist_ok=True)
    with Image.open(root/'web/assets'/f'{name}.jpg') as image:
        image.thumbnail((1600,1200))
        image.save(package/'assets'/f'{name}.jpg',quality=89,optimize=True)
    for ext,body in [('js','Page({});'),('json','{"navigationBarTitleText":"图片资源"}'),('wxml','<view>图片资源</view>'),('wxss','')]:
        (package/'loader'/f'index.{ext}').write_text(body,encoding='utf-8')
    with Image.open(root/'web/assets'/f'{name}.jpg') as image:
        image.thumbnail((400,300))
        image.save(mini/'assets'/f'{name}.jpg',quality=85,optimize=True)
for name,size,ext in [('welcome',(800,600),'jpg'),('icon',(128,128),'png')]:
    with Image.open(root/'web/assets'/f'{name}.{ext}') as image:
        image.thumbnail(size)
        image.save(mini/'assets'/f'{name}.{ext}',optimize=True)
for name in ['place.wav','complete.wav']:
    shutil.copy2(root/'ios/BibleStoryPuzzle'/name,mini/'assets'/name)
packages=[mini/('artworks-'+chr(97+i)) for i in range((len(names)+1)//2)]
config=json.loads((mini/'app.json').read_text(encoding='utf-8'))
config['subpackages']=[dict(name=p.name,root=p.name,pages=['loader/index']) for p in packages]
(mini/'app.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
for package in packages:
    (package/'resources.js').write_text("'use strict';\nmodule.exports={ready:true};\n",encoding='utf-8')
    size=sum(f.stat().st_size for f in package.rglob('*') if f.is_file())
    assert size<2*1024*1024, f'{package.name} exceeds 2 MiB'
    print(package.name,round(size/1024),'KiB')
main=sum(f.stat().st_size for f in mini.rglob('*') if f.is_file() and not any(p in f.parents for p in packages))
assert main<2*1024*1024, 'main package exceeds 2 MiB'
print('main package',round(main/1024),'KiB')
total=main+sum(f.stat().st_size for p in packages for f in p.rglob('*') if f.is_file())
assert total<20*1024*1024, 'total package exceeds 20 MiB'
print('total package',round(total/1024),'KiB; scenes:',len(names))
