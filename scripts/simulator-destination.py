import json, subprocess
data=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','--json']))
sdk=subprocess.check_output(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],text=True).strip()
matching='iOS-'+sdk.replace('.','-')
phones=[device for runtime,devices in data['devices'].items() if matching in runtime for device in devices if device.get('isAvailable') and device['name'].startswith('iPhone')]
if not phones: raise SystemExit('No available iPhone simulator runtime.')
preferred=next((device for device in phones if device['name']=='iPhone 16'),phones[0])
print('PUZZLE_SIMULATOR='+preferred['udid'])
