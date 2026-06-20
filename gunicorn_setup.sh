#!/bin/bash
cat <<EOF > /etc/systemd/system/gunicorn.socket
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
EOF

cat <<EOF > /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/bdapp
ExecStart=/var/www/bdapp/.venv/bin/gunicorn \\
          --access-logfile /var/log/gunicorn-access.log \\
          --error-logfile /var/log/gunicorn-error.log \\
          --workers 17 \\
          --timeout 120 \\
          --bind unix:/run/gunicorn.sock \\
          backend.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start gunicorn.socket
systemctl enable gunicorn.socket
systemctl restart gunicorn
