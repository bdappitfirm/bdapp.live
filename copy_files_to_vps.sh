
#!/bin/bash
VPS_IP="103.112.62.72"
USER="root"

# Copy the restore command and student data
scp academics/management/commands/restore_school19_students.py ${USER}@${VPS_IP}:/var/www/bdapp/academics/management/commands/
scp school_19_students.json ${USER}@${VPS_IP}:/var/www/bdapp/

# Now run the restore command on the server
ssh ${USER}@${VPS_IP} "cd /var/www/bdapp && source venv/bin/activate && python manage.py restore_school19_students"
