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
if minor > 99 or patch > 99 or (beta and int(beta) > 98): sys.exit('version parts must be below 100 (beta below 99), got ' + ver)
# Each part has its own two digits, so no two versions can share a code: 1.10.2 -> 1100299, 1.11.0-beta.1 -> 1110001, 1.11.0 -> 1110099.
# A beta sorts just below its own stable release and above every older release. (The earlier formula mixed patch and beta: 1.10.2 and 1.11.0-beta.1 were both 11101.)
code = major * 1000000 + minor * 10000 + patch * 100 + (int(beta) if beta else 99)

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
