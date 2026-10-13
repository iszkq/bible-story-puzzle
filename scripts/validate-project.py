from pathlib import Path
import json, plistlib, re, xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
app=root/'ios/BibleStoryPuzzle'
for p in [app/'Info.plist',app/'PrivacyInfo.xcprivacy']: plistlib.loads(p.read_bytes())
scheme=ET.parse(root/'ios/BibleStoryPuzzle.xcodeproj/xcshareddata/xcschemes/BibleStoryPuzzle.xcscheme')
project=(root/'ios/BibleStoryPuzzle.xcodeproj/project.pbxproj').read_text()
ids=re.findall(r'^\t{2}"([A-F0-9]{24})" = \{',project,re.MULTILINE)
assert len(ids)==len(set(ids)), 'Duplicate PBX object'
for ref in scheme.findall('.//BuildableReference'): assert ref.attrib['BlueprintIdentifier'] in ids
for name in ['App.swift','LocalAssetServer.swift','PuzzleViewController.swift','Info.plist','PrivacyInfo.xcprivacy','place.wav','complete.wav']:
    assert (app/name).is_file(), 'Missing '+name
for name in ['index.html','native.js','mobile.css','故事集.js']:
    assert (app/'Web'/name).read_bytes()==(root/'web'/name).read_bytes(), 'Stale packaged '+name
for name in ['moses','noah','david','ruth','daniel','esther','welcome']: assert (app/'Web/assets'/f'{name}.jpg').is_file()
assert not (app/'Web/assets/originals').exists(), 'App should omit large source masters'
icons=json.loads((app/'Assets.xcassets/AppIcon.appiconset/Contents.json').read_text())
for icon in icons['images']: assert (app/'Assets.xcassets/AppIcon.appiconset'/icon['filename']).is_file()
info=plistlib.loads((app/'Info.plist').read_bytes())
assert info['NSAppTransportSecurity'].get('NSAllowsArbitraryLoads') is not True
manifest=json.loads((root/'docs/design-system/manifest.json').read_text(encoding='utf-8'))
assert manifest['product']['github_repository']=='https://github.com/iszkq/bible-story-puzzle'
print(f'Validated {len(ids)} Xcode objects, shared scheme, plists, icon, exact offline resource copies and design contract.')
