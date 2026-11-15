import os, re

src = open(os.path.join('frontend', 'src', 'pages', 'ResultCardGenerator.jsx'), encoding='utf-8').read()
s = open(os.path.join('frontend', 'build', 'static', 'js', '2080.b20a408b.chunk.js'), encoding='utf-8', errors='ignore').read()


def esc(t):
    return ''.join('\\u%04x' % ord(c) for c in t)


# extract the exact literal used by every toast.* call in the source
pattern = re.compile(r"toast\.\w+\(\s*(['\"])(.*?)\1", re.S)
for m in pattern.finditer(src):
    lit = m.group(2)
    if not lit or all(ord(c) < 128 for c in lit):
        continue
    line_no = src[:m.start()].count('\n') + 1
    print(line_no, '| in build:', esc(lit) in s, '|', lit[:40])
