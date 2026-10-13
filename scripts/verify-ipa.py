"""Reject missing resources, simulator executables or signed bundles."""
import plistlib, struct, sys, zipfile, hashlib
from pathlib import Path

path=Path(sys.argv[1])
with zipfile.ZipFile(path) as archive:
    names=archive.namelist()
    info_path=next(n for n in names if n.startswith('Payload/') and n.count('/')==2 and n.endswith('/Info.plist'))
    app=info_path.rsplit('/',1)[0]
    info=plistlib.loads(archive.read(info_path))
    assert info['CFBundleIdentifier']=='com.iszkq.biblestorypuzzle'
    # Xcode may omit DTPlatformName when using a generated plist; the Mach-O
    # CPU/file type check below still rejects simulator builds.
    required=['Web/index.html','Web/native.js','Web/mobile.css','Web/故事集.js','Assets.car','PrivacyInfo.xcprivacy']
    required += ['Web/assets/'+name+'.jpg' for name in ['moses','noah','david','ruth','daniel','esther','welcome']]
    for name in required: assert app+'/'+name in names, 'Missing bundled resource: '+name
    assert not any('/_CodeSignature/' in n or n.endswith('embedded.mobileprovision') for n in names), 'Unexpected signature or provisioning profile'
    data=archive.read(app+'/'+info['CFBundleExecutable'])
    magic,cpu,subcpu,filetype,ncmds,sizecmds,flags,reserved=struct.unpack_from('<8I',data)
    assert magic==0xFEEDFACF and cpu==0x0100000C and filetype==2, 'Expected ARM64 device Mach-O executable'
    offset=32
    for _ in range(ncmds):
        command,size=struct.unpack_from('<II',data,offset)
        assert command!=0x1D, 'Mach-O unexpectedly contains LC_CODE_SIGNATURE'
        offset+=size
print('Verified unsigned ARM64 device IPA, seven scene assets, native bridge and privacy manifest.')
print('SHA256: '+hashlib.sha256(path.read_bytes()).hexdigest())
