const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'privacy-check.cjs')], { stdio: 'inherit' });
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const output = path.join(root, 'open-source', 'Flowline');
if (fs.existsSync(output)) throw new Error('Export already exists; move it before exporting again.');
for (const file of files) {
  const source = path.resolve(root, file);
  if (!source.startsWith(root + path.sep) || fs.lstatSync(source).isSymbolicLink()) throw new Error('Unsafe source path');
}
fs.mkdirSync(output, { recursive: true });
for (const file of files) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
console.log(`Exported ${files.length} source files to open-source/Flowline. No Git history or local data copied.`);
