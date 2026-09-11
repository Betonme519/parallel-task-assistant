const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const source = files(path.resolve(__dirname,'../src')).filter(f => /\.(cjs|js)$/.test(f));
for (const file of source) execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
console.log(`Syntax checked ${source.length} source files.`);
