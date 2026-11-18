#!/bin/bash
cat <<EOF > /etc/nginx/sites-available/bdapp.live
server {
    listen 80;
    server_name bdapp.live www.bdapp.live;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name bdapp.live www.bdapp.live;

    ssl_certificate /etc/letsencrypt/live/bdapp.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bdapp.live/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location = /favicon.ico {
        alias /var/www/bdapp/frontend/build/logo192.png;
        access_log off;
        log_not_found off;
    }
    
    location /static/ {
        root /var/www/bdapp/frontend/build;
        try_files \$uri @django_static;
    }

    location @django_static {
        root /var/www/bdapp/staticfiles;
        rewrite ^/static/(.*)$ /\$1 break;
    }

    location /media/ {
        alias /var/www/bdapp/media/;
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

    location /admin {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

    location / {
        root /var/www/bdapp/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t
systemctl restart nginx
