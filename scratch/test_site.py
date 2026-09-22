import urllib.request, re

url = 'https://bdapp.live/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req).read().decode('utf-8')
matches = re.findall(r'src="(/static/js/[^"]+)"', html)
print("JS files in index.html:", matches)
for js in matches:
    u = 'https://bdapp.live' + js
    try:
        r = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        resp = urllib.request.urlopen(r)
        print("Loaded OK:", js, "Status:", resp.status)
    except Exception as e:
        print("Error loading:", js, e)
