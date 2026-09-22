import urllib.request
import re

main_js_url = 'https://bdapp.live/static/js/main.05294a6d.js'
req = urllib.request.Request(main_js_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        print('main.js loaded OK, size:', len(content))
        # Find chunk references like "static/js/" + e + "." + {123:"abc"}[e] + ".chunk.js"
        chunks = re.findall(r'(\d+):"([a-f0-9]+)"', content)
        print(f'Found {len(chunks)} chunk references in main.js:')
        errors = 0
        for chunk_id, chunk_hash in chunks:
            chunk_url = f'https://bdapp.live/static/js/{chunk_id}.{chunk_hash}.chunk.js'
            try:
                c_req = urllib.request.Request(chunk_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(c_req) as c_resp:
                    pass
            except Exception as e:
                print(f'  Chunk {chunk_id}.{chunk_hash}.chunk.js => 404 ERROR!')
                errors += 1
        if errors == 0:
            print('ALL CHUNKS LOADED SUCCESSFULLY (200 OK)!')
        else:
            print(f'Total chunk errors: {errors}')
except Exception as e:
    print('ERROR:', e)
