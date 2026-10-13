"""Package a device .app with UTF-8 ZIP names, preserving executable modes."""
from pathlib import Path
import sys, zipfile

app=Path(sys.argv[1]).resolve()
assert app.is_dir() and app.suffix=='.app', 'Expected compiled .app directory'
destination=Path(sys.argv[2]).resolve()
with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(app.rglob('*')):
        assert not path.is_symlink(), 'Unexpected application symlink: '+str(path)
        archive.write(path,'Payload/'+app.name+'/'+path.relative_to(app).as_posix())
print('Packaged IPA with valid UTF-8 resource names.')
