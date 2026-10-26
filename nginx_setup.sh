#!/bin/bash
cat <<'EOF' > /etc/nginx/sites-available/bdapp.live
server {
    listen 80;
    server_name bdapp.live www.bdapp.live;

    client_max_body_size 200M;
    client_body_timeout 300s;
    client_header_timeout 300s;
    keepalive_timeout 300s;
    send_timeout 300s;

    location = /favicon.ico { access_log off; log_not_found off; }

    # CRITICAL: Service Worker + PWA Cache Buster
    # Force the service worker script to always re-validate + instruct browser to clear its
    # cache/storage when the service worker file changes. This is the #1 cause of "stuck UI"
    # when new front-end code is deployed but browser keeps showing old code.
    location = /service-worker.js {
        alias /var/www/bdapp/frontend/build/service-worker.js;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Expires "0";
        add_header Pragma "no-cache";
    }

    # CRITICAL: path must match Django settings STATIC_ROOT
    # STATIC_ROOT = BASE_DIR / 'staticfiles'  where BASE_DIR = /var/www/bdapp
    # So files live at /var/www/bdapp/staticfiles/
    location /static/ {
        alias /var/www/bdapp/staticfiles/;
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Expires "0";
        add_header Pragma "no-cache";
    }

    location /backend-static/ {
        alias /var/www/bdapp/staticfiles/;
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Expires "0";
        add_header Pragma "no-cache";
    }

    location /media/ {
        alias /var/www/bdapp/media/;
        expires 30d;
        add_header Cache-Control "public";
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    location /admin/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # React SPA - serve static files from frontend/build, then fall back to index.html
    location / {
        root /var/www/bdapp/frontend/build;
        index index.html index.htm;

        # EXTREMELY IMPORTANT: index.html must NEVER be cached long-term.
        # If index.html is cached for hours, the browser keeps loading the OLD
        # hashed filenames (main.50c3f1dd.js) which 404 / serve stale content.
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Expires "0";
        add_header Pragma "no-cache";

        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bdapp.live /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && echo "nginx restarted OK"
