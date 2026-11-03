import os

for fname in ['deploy_all.ps1', 'deploy_rsync.ps1', 'run_deploy.bat', 'deploy_rsync_vps.sh']:
    path = os.path.join('F:/bdedu', fname)
    if os.path.exists(path):
        print(f"=== {fname} ===")
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            print(f.read())
        print("\n")
