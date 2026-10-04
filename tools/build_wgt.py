"""Zip /public into app.wgt with config.xml and index.html at the archive root."""
import os, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub, out = os.path.join(root, "public"), os.path.join(root, "app.wgt")
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(pub):
        for f in sorted(files):
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, pub))
print(out, zipfile.ZipFile(out).namelist())
