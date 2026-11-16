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
const androidBuild = fs.readFileSync(path.join(root, 'app/build.gradle'), 'utf8');
const webIndex = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const androidVersion = androidBuild.match(/^\s*versionName\s+['"]([^'"]+)['"]/m)?.[1];
const webVersion = webIndex.match(/class="version">Phiên bản ([\d.]+)\s/)?.[1];
assert.ok(androidVersion, 'Missing versionName in app/build.gradle');
assert.ok(webVersion, 'Missing application version in site/index.html');
assert.equal(androidVersion, webVersion, 'Android versionName must match the Web/iPhone version');
console.log('OK: latest Web/iPhone assets and features are included in Android APK source.');
