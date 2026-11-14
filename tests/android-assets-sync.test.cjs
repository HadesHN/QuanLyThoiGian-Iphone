const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'site');
const assets = path.join(root, 'app', 'src', 'main', 'assets');
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    const abs = path.join(dir,e.name);
    return e.isDirectory() ? walk(abs) : e.name === '.nojekyll' ? [] : [abs];
  });
}
for (const f of walk(site)) {
  const rel = path.relative(site, f);
  const target = path.join(assets, rel);
  assert.ok(fs.existsSync(target), `APK assets missing ${rel}`);
  assert.deepEqual(fs.readFileSync(target),fs.readFileSync(f),`APK assets differ from site/${rel}`);
}
assert.match(fs.readFileSync(path.join(root, 'app/build.gradle'),'utf8'), /versionName '1\.3\.1'/);
console.log('OK: latest Web/iPhone assets and features are included in Android APK source.');
