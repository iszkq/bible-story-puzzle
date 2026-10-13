"""Generate a dependency-free Xcode project and deterministic sound assets."""
from pathlib import Path
import json, hashlib, plistlib, wave, struct, math

root = Path(__file__).resolve().parents[1]
ios = root/'ios'
app = ios/'BibleStoryPuzzle'
proj = ios/'BibleStoryPuzzle.xcodeproj'
proj.mkdir(parents=True, exist_ok=True)
objects = {}
def ident(name): return hashlib.sha1(name.encode()).hexdigest()[:24].upper()
def obj(key_name, kind, **values):
    key=ident(key_name); objects[key]={'isa':kind, **values}; return key
def config(name, values): return obj(name,'XCBuildConfiguration',name=name.split('/')[-1],buildSettings=values)
def configs(name, release, debug=None):
    refs=[config(name+'/Debug',debug or release),config(name+'/Release',release)]
    return obj(name+'/list','XCConfigurationList',buildConfigurations=refs,defaultConfigurationIsVisible=0,defaultConfigurationName='Release')

group_children=[]; build_sources=[]; build_resources=[]
for name in ['App.swift','LocalAssetServer.swift','PuzzleViewController.swift']:
    f=obj('file/'+name,'PBXFileReference',lastKnownFileType='sourcecode.swift',path=name,sourceTree='<group>')
    group_children.append(f); build_sources.append(obj('build/'+name,'PBXBuildFile',fileRef=f))
for name,kind in [('Assets.xcassets','folder.assetcatalog'),('Web','folder'),('place.wav','audio.wav'),('complete.wav','audio.wav')]:
    f=obj('file/'+name,'PBXFileReference',lastKnownFileType=kind,path=name,sourceTree='<group>')
    group_children.append(f); build_resources.append(obj('build/'+name,'PBXBuildFile',fileRef=f))
group_children.append(obj('Info.plist','PBXFileReference',lastKnownFileType='text.plist.xml',path='Info.plist',sourceTree='<group>'))
group_children.append(obj('PrivacyInfo.xcprivacy','PBXFileReference',lastKnownFileType='text.xml',path='PrivacyInfo.xcprivacy',sourceTree='<group>'))
build_resources.append(obj('build/privacy','PBXBuildFile',fileRef=ident('PrivacyInfo.xcprivacy')))
app_group=obj('app-group','PBXGroup',children=group_children,path='BibleStoryPuzzle',sourceTree='<group>')
test_file=obj('test-file','PBXFileReference',lastKnownFileType='sourcecode.swift',path='LaunchTests.swift',sourceTree='<group>')
test_group=obj('test-group','PBXGroup',children=[test_file],path='BibleStoryPuzzleUITests',sourceTree='<group>')
product=obj('app-product','PBXFileReference',explicitFileType='wrapper.application',includeInIndex=0,path='BibleStoryPuzzle.app',sourceTree='BUILT_PRODUCTS_DIR')
test_product=obj('test-product','PBXFileReference',explicitFileType='wrapper.cfbundle',includeInIndex=0,path='BibleStoryPuzzleUITests.xctest',sourceTree='BUILT_PRODUCTS_DIR')
products=obj('products','PBXGroup',children=[product,test_product],name='Products',sourceTree='<group>')
main_group=obj('main-group','PBXGroup',children=[app_group,test_group,products],sourceTree='<group>')
base={'IPHONEOS_DEPLOYMENT_TARGET':'16.0','SDKROOT':'iphoneos','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
project_configs=configs('project',dict(base,SWIFT_COMPILATION_MODE='wholemodule'),dict(base,SWIFT_OPTIMIZATION_LEVEL='-Onone',DEBUG_INFORMATION_FORMAT='dwarf'))
app_settings={'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'com.iszkq.biblestorypuzzle','INFOPLIST_FILE':'BibleStoryPuzzle/Info.plist','GENERATE_INFOPLIST_FILE':'NO','TARGETED_DEVICE_FAMILY':'1','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','CODE_SIGN_STYLE':'Automatic','MARKETING_VERSION':'0.5.0','CURRENT_PROJECT_VERSION':'1','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','SUPPORTS_MACCATALYST':'NO','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks'}
app_configs=configs('app',app_settings)
def phase(name,kind,files): return obj(name,kind,buildActionMask=2147483647,files=files,runOnlyForDeploymentPostprocessing=0)
app_target=obj('app-target','PBXNativeTarget',buildConfigurationList=app_configs,buildPhases=[phase('app-sources','PBXSourcesBuildPhase',build_sources),phase('app-frameworks','PBXFrameworksBuildPhase',[]),phase('app-resources','PBXResourcesBuildPhase',build_resources)],buildRules=[],dependencies=[],name='BibleStoryPuzzle',productName='BibleStoryPuzzle',productReference=product,productType='com.apple.product-type.application')
test_settings={'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'com.iszkq.biblestorypuzzle.uitests','GENERATE_INFOPLIST_FILE':'YES','TARGETED_DEVICE_FAMILY':'1','TEST_TARGET_NAME':'BibleStoryPuzzle','CODE_SIGN_STYLE':'Automatic','LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'}
proxy=obj('test-proxy','PBXContainerItemProxy',containerPortal=ident('project'),proxyType=1,remoteGlobalIDString=app_target,remoteInfo='BibleStoryPuzzle')
dependency=obj('test-dependency','PBXTargetDependency',target=app_target,targetProxy=proxy)
test_target=obj('test-target','PBXNativeTarget',buildConfigurationList=configs('tests',test_settings),buildPhases=[phase('test-sources','PBXSourcesBuildPhase',[obj('test-build','PBXBuildFile',fileRef=test_file)]),phase('test-frameworks','PBXFrameworksBuildPhase',[]),phase('test-resources','PBXResourcesBuildPhase',[])],buildRules=[],dependencies=[dependency],name='BibleStoryPuzzleUITests',productName='BibleStoryPuzzleUITests',productReference=test_product,productType='com.apple.product-type.bundle.ui-testing')
project=obj('project','PBXProject',attributes={'LastUpgradeCheck':'1600','TargetAttributes':{app_target:{'CreatedOnToolsVersion':'16.0'},test_target:{'CreatedOnToolsVersion':'16.0','TestTargetID':app_target}}},buildConfigurationList=project_configs,compatibilityVersion='Xcode 14.0',developmentRegion='zh-Hans',hasScannedForEncodings=0,knownRegions=['en','zh-Hans','Base'],mainGroup=main_group,productRefGroup=products,projectDirPath='',projectRoot='',targets=[app_target,test_target])
def serialize(value,indent=0):
    if isinstance(value,dict): return '{\n'+''.join('\t'*(indent+1)+json.dumps(str(k))+ ' = '+serialize(v,indent+1)+';\n' for k,v in value.items())+'\t'*indent+'}'
    if isinstance(value,list): return '('+', '.join(serialize(v,indent) for v in value)+')'
    if isinstance(value,int): return str(value)
    return json.dumps(str(value),ensure_ascii=True)
(proj/'project.pbxproj').write_text('// !$*UTF8*$!\n'+serialize({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':project})+'\n',encoding='utf-8')
scheme=proj/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
ref=lambda target,name:f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="{name}" BlueprintName="{name.split(".")[0]}" ReferencedContainer="container:BibleStoryPuzzle.xcodeproj"/>'
(scheme/'BibleStoryPuzzle.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
  <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref(app_target,'BibleStoryPuzzle.app')}</BuildActionEntry>
 </BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables>
  <TestableReference skipped="NO">{ref(test_target,'BibleStoryPuzzleUITests.xctest')}</TestableReference>
 </Testables></TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref(app_target,'BibleStoryPuzzle.app')}</BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref(app_target,'BibleStoryPuzzle.app')}</BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''',encoding='utf-8')
info={'CFBundleDevelopmentRegion':'zh-Hans','CFBundleDisplayName':'拼见圣经','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleInfoDictionaryVersion':'6.0','CFBundleName':'$(PRODUCT_NAME)','CFBundlePackageType':'APPL','CFBundleShortVersionString':'$(MARKETING_VERSION)','CFBundleVersion':'$(CURRENT_PROJECT_VERSION)','LSRequiresIPhoneOS':True,'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':False,'UISceneConfigurations':{}},'UILaunchScreen':{},'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait'],'NSAppTransportSecurity':{'NSAllowsLocalNetworking':True,'NSExceptionDomains':{'127.0.0.1':{'NSExceptionAllowsInsecureHTTPLoads':True,'NSIncludesSubdomains':False}}}}
(app/'Info.plist').write_bytes(plistlib.dumps(info))
(app/'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps({'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],'NSPrivacyCollectedDataTypes':[],'NSPrivacyAccessedAPITypes':[]}))
assets=app/'Assets.xcassets';assets.mkdir(exist_ok=True)
(assets/'Contents.json').write_text(json.dumps({'info':{'author':'xcode','version':1}}),encoding='utf-8')
icons=assets/'AppIcon.appiconset';icons.mkdir(exist_ok=True)
import shutil
shutil.copy2(root/'web/assets/icon.png',icons/'AppIcon.png')
(icons/'Contents.json').write_text(json.dumps({'images':[{'filename':'AppIcon.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}},indent=2),encoding='utf-8')
# Original synthesized sound cues; no third-party sound licensing.
for name,duration,tones in [('place',.09,[520]),('complete',.38,[523.25,659.25,783.99])]:
    rate=22050
    with wave.open(str(app/(name+'.wav')),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate)
        frames=[]
        for i in range(int(rate*duration)):
            t=i/rate; envelope=math.sin(math.pi*t/duration)**2
            value=sum(math.sin(2*math.pi*hz*t) for hz in tones)/len(tones)*envelope*.18
            frames.append(struct.pack('<h',int(value*32767)))
        f.writeframes(b''.join(frames))
print('Generated Xcode project, shared scheme, metadata, app icon and original sound cues.')
