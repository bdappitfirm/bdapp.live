import fs from 'fs';

const src = fs.readFileSync('frontend/src/pages/ClassResultsPage.jsx', 'utf8');
const line = src.split('\n').find(l => l.includes('const is2 ='));
console.log('SOURCE LINE:', JSON.stringify(line));

// extract regex literal
const m = line.match(/const is2 = (\/.*?\/i)\.test/);
const pat = eval(m[1]);
console.log('is2 regex source:', pat.source);
console.log('is2 regex codepoints:', [...pat.source].map(c => c.codePointAt(0).toString(16)).join(' '));

const names = ['ইংরেজি-২য় পত্র', 'ইংরেজি-২য় পত্র', 'ইংরেজি প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'বাংলা প্রথম পত্র'];
for (const n of names) {
    const low = n.toLowerCase().trim();
    console.log(n, '| codepoints=', [...n].map(c => c.codePointAt(0).toString(16)).join(' '), '| is2=', pat.test(low));
}
