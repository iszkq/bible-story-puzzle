"""Reject missing resources, simulator executables or signed bundles."""
import plistlib, struct, sys, zipfile, hashlib, json, re
from pathlib import Path

path=Path(sys.argv[1])
root=Path(__file__).resolve().parents[1]
source_shared=(root/'web/shared.js').read_bytes()
scenes=json.loads(re.search(r'const sceneNames=(\[[^;]+\]);',source_shared.decode('utf-8')).group(1))
assert len(scenes)==24, 'Expected 24 official scenes'
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
with zipfile.ZipFile(path) as archive:
    names=archive.namelist()
    info_path=next(n for n in names if n.startswith('Payload/') and n.count('/')==2 and n.endswith('/Info.plist'))
    app=info_path.rsplit('/',1)[0]
    info=plistlib.loads(archive.read(info_path))
    assert info['CFBundleIdentifier']=='com.iszkq.biblestorypuzzle', info.get('CFBundleIdentifier')
    assert info['CFBundleDisplayName']=='拾光拼图册', 'Unexpected app display name'
    assert info['CFBundleShortVersionString']==version, 'Unexpected app version'
    assert info['CFBundleVersion']=='2', 'Unexpected build number'
    assert info.get('DTPlatformName')=='iphoneos', 'Expected device platform metadata'
    required=['Web/index.html','Web/native.js','Web/mobile.css','Web/故事集.js','Web/shared.js','Assets.car','PrivacyInfo.xcprivacy']
    required += ['Web/assets/'+name+'.jpg' for name in scenes+['welcome']]
    required += ['Web/assets/'+name+'-thumb.jpg' for name in scenes]
    for name in required: assert app+'/'+name in names, 'Missing bundled resource: '+name
    assert archive.read(app+'/Web/shared.js')==source_shared, 'Bundled game roster differs from source'
    assert not any('/_CodeSignature/' in n or n.endswith('embedded.mobileprovision') for n in names), 'Unexpected signature or provisioning profile'
    data=archive.read(app+'/'+info['CFBundleExecutable'])
    magic,cpu,subcpu,filetype,ncmds,sizecmds,flags,reserved=struct.unpack_from('<8I',data)
    assert magic==0xFEEDFACF and cpu==0x0100000C and filetype==2, 'Expected ARM64 device Mach-O executable'
    offset=32
    for _ in range(ncmds):
        command,size=struct.unpack_from('<II',data,offset)
        assert command!=0x1D, 'Mach-O unexpectedly contains LC_CODE_SIGNATURE'
        offset+=size
print(f'Verified {version} build 2 unsigned ARM64 device IPA, 24 scenes and thumbnails, welcome image, native bridge and privacy manifest.')
print('SHA256: '+hashlib.sha256(path.read_bytes()).hexdigest())
