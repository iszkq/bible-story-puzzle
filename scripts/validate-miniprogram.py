from pathlib import Path
import json, subprocess
root=Path(__file__).resolve().parents[1]
mini=root/'miniprogram'
project=json.loads((root/'project.config.json').read_text(encoding='utf-8'))
assert project['miniprogramRoot']=='miniprogram/'
config=json.loads((mini/'app.json').read_text(encoding='utf-8'))
for p in mini.rglob('*.json'): json.loads(p.read_text(encoding='utf-8'))
for p in mini.rglob('*.js'): subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
packages=[mini/p['root'] for p in config['subpackages']]
for page in config['pages']:
    for ext in ['js','json','wxml','wxss']: assert (mini/(page+'.'+ext)).is_file()
for package in config['subpackages']:
    for page in package['pages']:
        for ext in ['js','json','wxml','wxss']: assert (mini/package['root']/(page+'.'+ext)).is_file()
sizes={p.name:sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) for p in packages}
main=sum(f.stat().st_size for f in mini.rglob('*') if f.is_file() and not any(p in f.parents for p in packages))
assert main<2*1024*1024 and all(s<2*1024*1024 for s in sizes.values())
assert main+sum(sizes.values())<20*1024*1024
assert (mini/'shared.js').read_bytes()==(root/'web/shared.js').read_bytes()
print('Validated JS syntax, JSON, all page resources, shared copies and package limits.')
print('Main:',round(main/1024),'KiB; total:',round((main+sum(sizes.values()))/1024),'KiB')
