"""Zip /public into Aniultimatium.wgt with config.xml and index.html at the archive root.
--lite: AniultimatiumLite.wgt (AniUltimatium Lite): lite.html becomes index.html, with its own app id and name."""
import os, sys, zipfile, subprocess
LITE = "--lite" in sys.argv
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub, out = os.path.join(root, "public"), os.path.join(root, "AniultimatiumLite.wgt" if LITE else "Aniultimatium.wgt")
WEB_ONLY = {"robots.txt", "sitemap.xml", "llms.txt", "og.png", "link.html", "about.html", "about-lite.html", "add.html", "adframe.html", "vastrelay.html", "lite.html"}      # served by the website only, not needed inside the TV app
WEB_ONLY_DIRS = {"omnirift", "classicube"}                                                             # Gamehub games: served by the website only (36 MB)
if LITE: subprocess.check_call([sys.executable, os.path.join(root, "tools", "gen_lite.py")])
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d, dirs, files in os.walk(pub):
        dirs[:] = [x for x in dirs if x not in WEB_ONLY_DIRS]                       # games etc. are loaded from the website, not packed into the TV app
        for f in sorted(files):
            if f in WEB_ONLY or f.startswith('_t.'): continue
            p = os.path.join(d, f)
            rel = os.path.relpath(p, pub)
            if LITE and rel == "index.html":
                z.writestr("index.html", open(os.path.join(pub, "lite.html"), encoding="utf-8").read()); continue
            if LITE and rel == "config.xml":
                c = open(p, encoding="utf-8").read().replace("http://yourdomain/Aniultimatium", "http://yourdomain/AniultimatiumLite").replace('id="oXabc12345.EnglishAnime" package="oXabc12345"', 'id="AnUltLite1.AniUltimatiumLite" package="AnUltLite1"').replace("<name>Aniultimatium</name>", "<name>AniUltimatium Lite</name>")
                assert "AniUltimatium Lite" in c and "AnUltLite1" in c
                z.writestr("config.xml", c); continue
            z.write(p, rel)
print(out, zipfile.ZipFile(out).namelist())
