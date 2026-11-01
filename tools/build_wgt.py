"""Zip /public into Aniultimatium.wgt with config.xml and index.html at the archive root."""
import os, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub, out = os.path.join(root, "public"), os.path.join(root, "Aniultimatium.wgt")
WEB_ONLY = {"robots.txt", "sitemap.xml", "llms.txt", "og.png", "link.html", "about.html", "add.html", "adframe.html", "vastrelay.html"}      # served by the website only, not needed inside the TV app
WEB_ONLY_DIRS = {"omnirift", "classicube"}                                                             # Gamehub games: served by the website only (36 MB)
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d, dirs, files in os.walk(pub):
        dirs[:] = [x for x in dirs if x not in WEB_ONLY_DIRS]                       # games etc. are loaded from the website, not packed into the TV app
        for f in sorted(files):
            if f in WEB_ONLY or f.startswith('_t.'): continue
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, pub))
print(out, zipfile.ZipFile(out).namelist())
