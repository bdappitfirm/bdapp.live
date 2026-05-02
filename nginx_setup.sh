#!/bin/bash
cat <<EOF > /etc/nginx/sites-available/bdapp.live
server {
    listen 80;
    server_name bdapp.live www.bdapp.live;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        alias /var/www/bdapp/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/bdapp/backend/media/;
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

    location /admin/ {
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

ln -sf /etc/nginx/sites-available/bdapp.live /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
