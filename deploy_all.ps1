# ====================================================================
#  deploy_all.ps1  -  LOCAL -> LIVE : এক কমান্ডে কোড ডিপ্লয়
# ====================================================================
#
#  চালানোর নিয়ম (প্রজেক্ট রুট থেকে):
#      .\deploy_all.ps1
#
#  এই স্ক্রিপ্ট যা করবে:
#    1. React ফ্রন্টএন্ড বিল্ড (npm run build)
#    2. build/index.html -> templates/index.html সিঙ্ক
#    3. কোড + বিল্ড প্যাক করে লাইভ সার্ভারে আপলোড (scp)
#    4. লাইভে: পুরোনো frontend/build সাফ করে ফ্রেশ এক্সট্রাক্ট,
#       Django migrate + collectstatic, পারমিশন ঠিক, সার্ভিস রিস্টার্ট
#    5. শেষে লাইভ index.html যাচাই করে দেখাবে কোন main.js চলছে
#
#  স্পর্শ করা হয় না (ইচ্ছাকৃতভাবে):
#    - লাইভের .env  (লোকাল/dev .env কখনো লাইভে যায় না)
#    - লাইভ ডাটাবেস (কোনো pg_dump/restore/password পরিবর্তন নেই)
#    - nginx কনফিগ (SSL সহ বর্তমান কনফ অপরিবর্তিত থাকে)
# ====================================================================

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

# বাংলা টেক্সট টার্মিনালে সঠিকভাবে দেখানোর জন্য কনসোল এনকোডিং UTF-8 করা
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$VPS_IP     = "103.112.62.72"
$VPS_USER   = "root"
$REMOTE_DIR = "/var/www/bdapp"
$SITE_URL   = "https://bdapp.live/"
$TAR_NAME   = "deploy_latest.tar.gz"

$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = (Get-Location).Path }
Set-Location $ROOT

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   BDEDU   LOCAL -> LIVE   (one-command deploy)"     -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ---------------- 0) Preflight ----------------
Write-Host "`n[0/6] প্রি-ফ্লাইট চেক..." -ForegroundColor Yellow
foreach ($tool in @('tar', 'scp', 'ssh', 'node', 'npm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "  [X] প্রয়োজনীয় টুল পাওয়া যায়নি: $tool" -ForegroundColor Red
        exit 1
    }
}
ssh -o BatchMode=yes -o ConnectTimeout=15 "$VPS_USER@$VPS_IP" "echo ok" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [X] SSH লগইন ব্যর্থ ($VPS_USER@$VPS_IP)। SSH কী / নেটওয়ার্ক পরীক্ষা করুন।" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] টুল ও SSH সংযোগ ঠিক আছে।" -ForegroundColor Green

# ---------------- 1) Frontend build ----------------
Write-Host "`n[1/6] React ফ্রন্টএন্ড বিল্ড হচ্ছে (একটু সময় লাগবে)..." -ForegroundColor Yellow
$env:NODE_ENV = 'production'
Push-Location (Join-Path $ROOT 'frontend')
& npm.cmd run build
$buildExit = $LASTEXITCODE
Pop-Location
if ($buildExit -ne 0) {
    Write-Host "  [X] npm run build ব্যর্থ হয়েছে (exit $buildExit)। ডিপ্লয় বাতিল।" -ForegroundColor Red
    exit 1
}
$buildIndex = Join-Path $ROOT 'frontend\build\index.html'
if (-not (Test-Path $buildIndex)) {
    Write-Host "  [X] build/index.html পাওয়া যায়নি। ডিপ্লয় বাতিল।" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] ফ্রন্টএন্ড বিল্ড সম্পন্ন।" -ForegroundColor Green

# ---------------- 2) index.html সিঙ্ক (Django fallback) ----------------
Write-Host "`n[2/6] build/index.html -> templates/index.html সিঙ্ক..." -ForegroundColor Yellow
Copy-Item -Path $buildIndex -Destination (Join-Path $ROOT 'templates\index.html') -Force
Write-Host "  [OK] সিঙ্ক সম্পন্ন।" -ForegroundColor Green

# ---------------- 3) প্যাকেজিং ----------------
Write-Host "`n[3/6] কোড + বিল্ড প্যাক করা হচ্ছে..." -ForegroundColor Yellow
if (Test-Path $TAR_NAME) { Remove-Item $TAR_NAME -Force }
$tarArgs = @(
    "-czf", $TAR_NAME,
    "--exclude=staticfiles",
    "--exclude=__pycache__",
    "--exclude=*.pyc",
    "--exclude=node_modules",
    "--exclude=.venv",
    "--exclude=venv",
    "--exclude=.git",
    "--exclude=backups",
    "--exclude=scratch",
    "backend", "users", "schools", "academics", "attendance", "fees", "results", "software_accounts", "employees",
    "manage.py", "requirements.txt",
    "templates", "frontend/build"
)
& tar @tarArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $TAR_NAME)) {
    Write-Host "  [X] প্যাকেজ তৈরি ব্যর্থ।" -ForegroundColor Red
    exit 1
}
$sizeMB = [math]::Round((Get-Item $TAR_NAME).Length / 1MB, 1)
Write-Host "  [OK] প্যাকেজ তৈরি ($TAR_NAME, $sizeMB MB)।" -ForegroundColor Green

# ---------------- 4) আপলোড ----------------
Write-Host "`n[4/6] লাইভ সার্ভারে আপলোড হচ্ছে..." -ForegroundColor Yellow
& scp $TAR_NAME "${VPS_USER}@${VPS_IP}:/tmp/$TAR_NAME"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [X] scp আপলোড ব্যর্থ।" -ForegroundColor Red
    Remove-Item $TAR_NAME -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  [OK] আপলোড সম্পন্ন।" -ForegroundColor Green

# ---------------- 5) লাইভে প্রয়োগ ----------------
Write-Host "`n[5/6] লাইভে কোড প্রয়োগ + সার্ভিস রিস্টার্ট..." -ForegroundColor Yellow

$remoteScript = @'
set -e
cd /var/www/bdapp

if [ ! -f .env ]; then
  echo "ERROR: /var/www/bdapp/.env নেই। নিরাপত্তার জন্য ডিপ্লয় বন্ধ করা হলো।"
  exit 1
fi

echo "-- পুরোনো frontend/build সাফ করা হচ্ছে (stale asset মুক্ত রাখতে)..."
rm -rf frontend/build
mkdir -p frontend/build

echo "-- আর্কাইভ এক্সট্রাক্ট..."
tar -xzf /tmp/deploy_latest.tar.gz -C /var/www/bdapp/

echo "-- Django migrate + collectstatic..."
if [ -d ".venv" ]; then . .venv/bin/activate; elif [ -d "venv" ]; then . venv/bin/activate; fi
python manage.py migrate --noinput
rm -rf staticfiles
python manage.py collectstatic --clear --noinput

echo "-- পারমিশন ঠিক করা হচ্ছে..."
chown -R www-data:www-data /var/www/bdapp || true
chmod -R 755 /var/www/bdapp || true
if [ -d "/var/www/bdapp/.venv/bin" ]; then chmod +x /var/www/bdapp/.venv/bin/* 2>/dev/null || true; fi

echo "-- gunicorn / daphne / nginx রিস্টার্ট..."
systemctl restart gunicorn daphne 2>/dev/null || systemctl restart gunicorn
systemctl reload nginx 2>/dev/null || systemctl restart nginx

rm -f /tmp/deploy_latest.tar.gz
echo "REMOTE_DEPLOY_OK"
'@

# রিমোট স্ক্রিপ্ট base64 করে পাঠানো হয় — যাতে PowerShell-এর pipe encoding বা
# BOM কোনোভাবেই স্ক্রিপ্টের প্রথম লাইনটি (set -e) নষ্ট না করে।
$cleanScript = $remoteScript -replace "`r", ""
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($cleanScript))
ssh "${VPS_USER}@${VPS_IP}" "echo $b64 | base64 -d | bash"
$remoteExit = $LASTEXITCODE

Remove-Item $TAR_NAME -Force -ErrorAction SilentlyContinue

if ($remoteExit -ne 0) {
    Write-Host "  [X] লাইভ ডিপ্লয় ব্যর্থ (exit $remoteExit)।" -ForegroundColor Red
    exit 1
}

# ---------------- 6) যাচাই ----------------
Write-Host "`n[6/6] লাইভ যাচাই..." -ForegroundColor Yellow
$localMain = ([regex]::Match((Get-Content $buildIndex -Raw), '/static/js/main\.[a-f0-9]+\.js')).Value
$liveMain  = $null
try {
    $liveHtml = (Invoke-WebRequest -Uri $SITE_URL -UseBasicParsing -TimeoutSec 30).Content
    $liveMain = ([regex]::Match($liveHtml, '/static/js/main\.[a-f0-9]+\.js')).Value
} catch {
    Write-Host "  [!] লাইভ পাতা যাচাই করা যায়নি: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
Write-Host "      লোকাল বিল্ড : $localMain" -ForegroundColor Gray
Write-Host "      লাইভ সাইট   : $liveMain"  -ForegroundColor Gray
if ($localMain -and $liveMain -and $localMain -eq $liveMain) {
    Write-Host "  [OK] লাইভে নতুন বিল্ডই চলছে।" -ForegroundColor Green
} else {
    Write-Host "  [!] মিলছে না — ব্রাউজারে Ctrl+Shift+R (hard reload) করুন।" -ForegroundColor DarkYellow
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "   deployed to LIVE  ✅   (ব্রাউজারে Ctrl+Shift+R)"  -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
