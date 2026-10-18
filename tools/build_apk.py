"""Build the Android TV / Fire TV app (Aniultimatium.apk) from public/ + android/.
Needs a JDK (17+) and the Android SDK (platform 34, build-tools 34): set ANDROID_HOME (or android/local.properties: sdk.dir=...).
Usage:  python3 tools/build_apk.py            -> Aniultimatium.apk in the repository root
The web app inside is exactly the Samsung .wgt content (same public/ files, minus the website-only pages)."""
import json, os, re, shutil, subprocess, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub, droid = os.path.join(root, 'public'), os.path.join(root, 'android')
assets = os.path.join(droid, 'app', 'src', 'main', 'assets')
WEB_ONLY = {'robots.txt', 'sitemap.xml', 'llms.txt', 'og.png', 'link.html', 'about.html', 'add.html', 'config.xml'}   # config.xml is the Samsung manifest

ver = json.load(open(os.path.join(root, 'package.json')))['version']                         # e.g. 1.7.0-beta.1
m = re.match(r'^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$', ver)
if not m: sys.exit('package.json version must look like 1.7.0 or 1.7.0-beta.1, got ' + ver)
major, minor, patch, beta = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4)
code = major * 10000 + minor * 100 + patch * 1 + (int(beta) if beta else 99)                    # betas sort before the stable release of the same number

if os.path.isdir(assets): shutil.rmtree(assets)
os.makedirs(assets)
n = 0
for f in sorted(os.listdir(pub)):
    if f in WEB_ONLY or f.startswith('_t.') or not os.path.isfile(os.path.join(pub, f)): continue
    shutil.copy2(os.path.join(pub, f), os.path.join(assets, f)); n += 1
first = open(os.path.join(assets, 'main.js'), encoding='utf-8').readline()
assert first.startswith('const VERCEL_API_URL = '), 'main.js must start with the VERCEL_API_URL line'
print('assets: %d files copied, version %s (code %d)' % (n, ver, code))

env = dict(os.environ)
if not env.get('ANDROID_HOME') and not os.path.exists(os.path.join(droid, 'local.properties')):
    sys.exit('Set ANDROID_HOME to your Android SDK (platform 34 + build-tools 34).')
gradle = os.path.join(droid, 'gradlew')
cmd = [gradle if os.path.exists(gradle) else 'gradle', 'assembleRelease', '--no-daemon', '-q', '-PappVersionName=' + ver, '-PappVersionCode=' + str(code)]
subprocess.check_call(cmd, cwd=droid, env=env)
apk = os.path.join(droid, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
out = os.path.join(root, 'Aniultimatium.apk')
shutil.copy2(apk, out)
print('built', out, '%.1f MB' % (os.path.getsize(out) / 1048576))
