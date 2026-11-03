const normalizeSubjKey = (n) => {
    const low = String(n).toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const is2 = /([- ](২য়|২য়|২য়|2nd|second|ii|দ্বি[তত]ীয|দ্বিতীয়|দ্বিতীয়)(\s|$))|(\bii\b)/i.test(low);
    const has1 = /([- ]([১1]ম|1st|first|i|প্রথম)(\s|$))|(\bi\b)/i.test(low);
    if (low.includes('bangla') || low.includes('বাংলা')) {
        if (is2 && !has1) return 'bangla_p2';
        if (has1 && !is2) return 'bangla_p1';
        if (is2 && has1) return 'bangla_combined';
        return 'bangla';
    }
    return low;
};
const names = ['বাংলা প্রথম পত্র','বাংলা দ্বিতীয় পত্র','ইংরেজি প্রথম পত্র','ইংরেজি দ্বিতীয় পত্র','ইংরেজি-২য় পত্র','তথ্য ও যোগাযোগ প্রযুক্তি','ইসলাম ও নৈতিক শিক্ষা'];
for (const n of names) console.log(JSON.stringify(n), '->', normalizeSubjKey(n), '| is2=', /([- ](২য়|২য়|2nd|second|ii|দ্বি[তত]ীয|দ্বিতীয়|দ্বিতীয়)(\s|$))|(\bii\b)/i.test(n.toLowerCase()), '| has1=', /([- ]([১1]ম|1st|first|i|প্রথম)(\s|$))|(\bi\b)/i.test(n.toLowerCase()));
