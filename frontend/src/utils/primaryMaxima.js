// PRIMARY (শিশু–পঞ্চম) subject maxima - shared by every screen that computes marks or GPA.
//
// Scheme (same as the backend: results/utils.py get_subject_maxima + Result.save()):
//   written  = 100 for every subject, 50 for drawing (অংকন)
//   tutorial = 30, stored separately in the mcq_marks column
//
// The টিউটোরিয়াল must never be added into the subject mark, must never decide pass/fail and must
// never change the GPA - it is added once to the grand total (মোট / সর্বমোট). The generic
// getSubjectMaxima() helpers describe classes 6-8 (English there has mcq 0 and drawing is not
// special-cased), so using them for primary under-scored subjects and produced wrong CGPA/merit.

export const primaryWrittenMax = (name) =>
  (/অংকন|drawing|চিত্রাংকন/i.test(String(name || '')) ? 50 : 100);

export const primarySpecForSubject = (name) => ({ cq: primaryWrittenMax(name), mcq: 30, pr: 0 });

// Primary classes are everything that is NOT 6-10.
export const isPrimaryClassName = (name) =>
  !/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b|ssc|ix|x/i
    .test(String(name || '').toLowerCase());
