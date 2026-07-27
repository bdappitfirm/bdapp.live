#!/bin/bash
cat <<EOF > /etc/systemd/system/gunicorn.socket
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock
SocketUser=www-data
SocketGroup=www-data
SocketMode=0660

[Install]
WantedBy=sockets.target
EOF

# Create log files and set permissions
touch /var/log/gunicorn-access.log /var/log/gunicorn-error.log
chown www-data:www-data /var/log/gunicorn-access.log /var/log/gunicorn-error.log
chmod 644 /var/log/gunicorn-access.log /var/log/gunicorn-error.log

cat <<EOF > /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/bdapp
ExecStart=/var/www/bdapp/.venv/bin/gunicorn \
          --access-logfile /var/log/gunicorn-access.log \
          --error-logfile /var/log/gunicorn-error.log \
          --workers 4 \
          --timeout 120 \
          --bind unix:/run/gunicorn.sock \
          backend.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl stop gunicorn.service || true
systemctl stop gunicorn.socket || true
systemctl start gunicorn.socket
systemctl enable gunicorn.socket
sleep 2
systemctl start gunicorn
systemctl status gunicorn.service --no-pager
