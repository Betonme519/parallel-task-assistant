const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Scan tracked AND untracked publication candidates. Never print matched values.
const project = path.resolve(__dirname, '..');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: project, encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = /(?:^|\/)(?:data|work|release(?:-v2|-public)?|node_modules|verification)\/|(?:^|\/)(?:\.env(?:\..+)?|\.npmrc|ai-credentials\.json|workspace[^/]*\.json[^/]*)$|\.(?:flowline|pem|key|p12|pfx|log)$/i;
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['access-token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})/],
  ['credential-assignment', /(?:api[_-]?key|secret|password|token)\s*["']?\s*[:=]\s*["'][A-Za-z0-9_.+\/-]{24,}["']/i],
  ['credential-url', /https?:\/\/[^\s/:'"@]+:[^\s/'"@]+@/],
  ['personal-path', /[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\s/\\"']+/i]
];
let findings = 0;
for (const file of new Set(files)) {
  if (forbidden.test(file) && !file.endsWith('.env.example')) {
    console.error(`${file}: excluded-publication-file`); findings++;
  }
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const bytes = fs.readFileSync(absolute);
  if (bytes.includes(0)) continue; // Binary screenshots require manual inspection.
  const lines = bytes.toString('utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [label, pattern] of rules) {
      if (pattern.test(line)) { console.error(`${file}:${index + 1}: ${label}`); findings++; }
    }
  });
}
console.log(`Scanned ${new Set(files).size} publication candidates; ${findings} findings. Matched values are never printed.`);
console.log('This heuristic scan does not inspect Git history or image contents.');
process.exitCode = findings ? 1 : 0;
