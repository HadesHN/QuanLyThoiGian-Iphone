const fs=require('fs'),path=require('path'),assert=require('assert');
const site=path.join(__dirname,'../site');
const manifest=JSON.parse(fs.readFileSync(path.join(site,'manifest.webmanifest'),'utf8'));
assert.strictEqual(manifest.scope,'./');
assert.strictEqual(manifest.start_url,'./');
for(const name of ['index.html','styles.css','app.js','events.js','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png']){
 assert.ok(fs.statSync(path.join(site,name)).size>0,`${name} missing or empty`);
}
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const js=fs.readFileSync(path.join(site,'app.js'),'utf8');
assert.ok(html.includes('apple-touch-icon.png'));
assert.ok(html.includes('Designed by Hoàng ĐC'));
assert.ok(js.includes('share-backup'));
assert.ok(js.includes("form.getAttribute('id')"),'form ID collision must be fixed');
assert.ok(js.includes('data-action="save-task"'),'task save uses explicit button');
for(const page of ['events','contacts','finance','notes'])assert.ok(html.includes(`data-page="${page}"`),`${page} tab missing`);
for(const paper of ['paper-grid','paper-lined','paper-blank'])assert.ok(fs.readFileSync(path.join(site,'styles.css'),'utf8').includes(paper));
assert.ok(js.includes("if(e.target.id==='modal-backdrop'){return;}"));
for(const entry of manifest.icons)assert.ok(fs.existsSync(path.join(site,entry.src)));
console.log('OK: v1.3 web assets, iOS icons, fixed task form, finance, relationships, creative notes.');
