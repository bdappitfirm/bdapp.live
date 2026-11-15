import fs from 'fs';

const srcPath = 'f:/bdedu/frontend/src/pages/ResultCardGenerator.jsx';
const chunkPath = 'f:/bdedu/frontend/build/static/js/2080.b20a408b.chunk.js';

const src = fs.readFileSync(srcPath, 'utf8');
const chunk = fs.readFileSync(chunkPath, 'utf8');

const escapeU = (s) => Array.from(s).map(c => (c.codePointAt(0) > 0x7e ? '\\u' + c.codePointAt(0).toString(16).padStart(4, '0') : c)).join('');
const escapeUUpper = (s) => Array.from(s).map(c => (c.codePointAt(0) > 0x7e ? '\\u' + c.codePointAt(0).toString(16).padStart(4, '0').toUpperCase() : c)).join('');

// sanity: does the chunk store Bangla raw at all?
const sample = 'শিক্ষার্থী';
console.log('raw sample present:', chunk.includes(sample));
console.log('esc sample present:', chunk.includes(escapeU(sample)), chunk.includes(escapeUUpper(sample)));

const re = /'([^'\\\n]{6,120})'/g;
let m;
const seen = new Set();
const out = [];
while ((m = re.exec(src))) {
  const lit = m[1];
  if (!/[\u0980-\u09FF]/.test(lit)) continue;
  if (seen.has(lit)) continue;
  seen.add(lit);
  const raw = chunk.includes(lit);
  const esc = chunk.includes(escapeU(lit));
  const escU = chunk.includes(escapeUUpper(lit));
  out.push({ lit, raw, esc, escU });
}
console.log('\ntotal distinct bengali literals:', out.length);
console.log('present raw:', out.filter(o => o.raw).length, ' escaped-lower:', out.filter(o => o.esc).length, ' escaped-upper:', out.filter(o => o.escU).length);
console.log('\n--- NOT present in any form ---');
out.filter(o => !o.raw && !o.esc && !o.escU).forEach(o => console.log('  ', JSON.stringify(o.lit)));
console.log('\n--- literals containing min-3 / no-result toast ---');
out.filter(o => /ন্যূনতম|রেজাল্ট|তিনটি/.test(o.lit)).forEach(o => console.log('  ', JSON.stringify(o.lit), 'raw=', o.raw, 'esc=', o.esc));
