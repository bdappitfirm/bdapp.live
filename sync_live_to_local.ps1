# ====================================================================
# sync_live_to_local.ps1  -  LIVE -> LOCAL  (DATA ONLY)
# ====================================================================
# Purpose:
#   Pull ONLY user/admin-entered DATA from the live server database.
#   NO code, NO logic, NO schema, NO migration files, NO settings
#   are ever downloaded from LIVE to LOCAL.
#
# Design rules:
#   1. LIVE db is READ-ONLY to us: only SELECT / pg_dump --data-only
#   2. MIRROR MODE: for every synced table the LOCAL rows are DELETEd and
#      reloaded from LIVE, so LOCAL becomes an EXACT copy of LIVE.
#      LIVE is the single source of truth - local-only rows are NOT preserved.
#   3. The delete + reload runs as ONE transaction (psql -1 with ON_ERROR_STOP=1),
#      so any error rolls the whole thing back and LOCAL is left untouched.
#   4. NO DROP / TRUNCATE / CREATE TABLE / ALTER TABLE anywhere
#   5. Tables are emptied/reloaded in REVERSE foreign-key order, then inserted
#      in forward FK order
#   6. Only the tables listed in $SYNC_TABLES are touched - every other table
#      (fees_*, schools_advertisement, users_task, auth_*, django_*, ...) is left alone
#   7. Media files: only referenced profile/school photos, skip if local exists
# ====================================================================

# ---------------- CONFIGURATION  (edit these as needed) ----------------
$VPS_IP          = "103.112.62.72"
$SSH_USER        = "root"
$REMOTE_DB_NAME  = "local_pg_db"
$REMOTE_DB_USER  = "postgres"
$LOCAL_DB_NAME   = "local_pg_db"
$LOCAL_DB_USER   = "local_pg_user"
# Password is read from .env (repo root) or the environment - never hardcode it here.
$LOCAL_DB_PASS   = $env:PG_PASSWORD
if (-not $LOCAL_DB_PASS) {
    $__env = Join-Path $PSScriptRoot '.env'
    if (Test-Path $__env) {
        $__l = Get-Content $__env | Where-Object { $_ -match '^PG_PASSWORD=' } | Select-Object -First 1
        if ($__l) { $LOCAL_DB_PASS = ($__l -replace '^PG_PASSWORD=','').Trim() }
    }
}
if (-not $LOCAL_DB_PASS) { Write-Error "PG_PASSWORD not found in .env or the environment."; exit 1 }
$REMOTE_APP_DIR  = "/var/www/bdapp"

# Tables to sync - ORDER MATTERS (parents before children for FKs)
# Each entry = "schema.table_name"
$SYNC_TABLES = @(
    "public.schools_school",
    "public.users_user",
    "public.academics_classroom",
    "public.academics_section",
    "public.academics_subject",
    "public.academics_subject_classrooms",
    "public.academics_subject_sections",
    "public.users_profile",
    "public.academics_studentprofile",
    "public.attendance_attendancerecord",
    "public.attendance_studentattendancesummary",
    "public.academics_building",
    "public.academics_room",
    "public.results_examination",
    "public.results_examslot",
    "public.academics_examseatplan",
    "public.results_result",
    "public.results_studentoverallresult",
    "public.academics_teacherassignment",
    "public.academics_virtualclass"
)

# ---------------- UTILITY: find psql ----------------
$psql = "psql"
$commonPsqlPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe"
)
foreach ($p in $commonPsqlPaths) {
    if (Test-Path $p) { $psql = "`"$p`""; break }
}
$env:PGPASSWORD = $LOCAL_DB_PASS

# ---------------- TEMP FILES ----------------
$TMP_DIR       = Join-Path $PWD "tmp_sync_$(Get-Date -Format 'yyyyMMddHHmmss')"
$TMP_DUMP_SQL  = Join-Path $TMP_DIR "live_data_dump.sql"
$TMP_MEDIA_LIST= Join-Path $TMP_DIR "live_media_list.txt"
$TMP_REMOTE_DUMP = "/tmp/live_local_sync_$(Get-Date -Format 'yyyyMMddHHmmss').sql"
$TMP_REMOTE_MEDIA = "/tmp/live_local_sync_media_$(Get-Date -Format 'yyyyMMddHHmmss').txt"

$ERRORS = [System.Collections.Generic.List[string]]::new()
$MEDIA_COPIED = 0
$MEDIA_SKIPPED = 0

function Write-Step($msg, $color='Yellow') { Write-Host "`n==> $msg" -ForegroundColor $color }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor Gray }
function Write-Err($msg)  { Write-Host "  !! $msg" -ForegroundColor Red; $ERRORS.Add($msg) }

# ====================================================================
# STEP 0: Housekeeping
# ====================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   LIVE -> LOCAL  DATA SYNC  (DATA ONLY - NO CODE/LOGIC)"    -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

try {
    New-Item -ItemType Directory -Path $TMP_DIR -Force | Out-Null
} catch {
    Write-Err "Failed to create temp dir $TMP_DIR : $_"
    exit 1
}

# ====================================================================
# STEP 1: Pre-flight - ensure local schema exists, capture BEFORE counts
# ====================================================================
Write-Step "Step 1/6 : Pre-flight checks + BEFORE count snapshot"
try {
    Invoke-Expression "& cmd /c $psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -v ON_ERROR_STOP=1 -f live_db_sync.sql 2>&1" | Out-Null
} catch {
    Write-Err "Pre-flight check FAILED: $_"
    Write-Host "  -> Run `python manage.py migrate` in the backend to create tables first." -ForegroundColor Yellow
    exit 1
}

# Tables reported in the summary.
# NOTE: counts are kept in plain PowerShell hashtables, NOT in a TEMP table.
# A TEMP table lives inside ONE psql session only, and Step 6 runs in a NEW
# psql process - which is why the summary always printed 0 for every table.
$COUNT_TABLES = @(
    'schools_school','users_user','users_profile','academics_classroom','academics_section',
    'academics_subject','academics_studentprofile','attendance_attendancerecord','attendance_studentattendancesummary',
    'results_examination','results_examslot',
    'results_result','results_studentoverallresult'
)

function Get-TableCounts {
    # -A -t -F ','  => plain "table,count" lines (no CSV quoting / encoding surprises)
    $sel = ($COUNT_TABLES | ForEach-Object { "SELECT '$_', COUNT(*) FROM public.$_" }) -join " UNION ALL "
    $raw = @(& cmd /c "$psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -A -t -F `",`" -v ON_ERROR_STOP=1 -c `"$sel`"" 2>&1)
    $h = @{}
    foreach ($line in $raw) {
        $s = ("$line").Trim()
        if ($s -match '^([A-Za-z_][A-Za-z0-9_]*),(\d+)$') { $h[$Matches[1]] = [int]$Matches[2] }
    }
    return $h
}

$BEFORE_COUNTS = Get-TableCounts
if ($BEFORE_COUNTS.Count -eq 0) {
    Write-Err "Could not read BEFORE counts from the local database (is PostgreSQL running?)"
} else {
    Write-Info ("Schema OK, BEFORE counts recorded ({0} tables)." -f $BEFORE_COUNTS.Count)
}

# ====================================================================
# STEP 2: Dump ONLY the required tables (DATA ONLY - NO schema) from LIVE
# ====================================================================
Write-Step "Step 2/6 : Extracting DATA-ONLY dump from LIVE server (pg_dump, read-only)"

# Build pg_dump -t list
$tableArgs = ($SYNC_TABLES | ForEach-Object { "-t $_" }) -join " "

# FIX #1: DO NOT merge stderr into dump SQL file.
#   Old `2>&1 > dump.sql` caused pg_dump warnings like "pg_dump: could not..."
#   to be written INTO the .sql file, producing "syntax error at or near 'could'"
#   Now: stdout -> dump.sql, stderr -> separate .log file; then check exit code.
$TMP_REMOTE_DUMP_LOG = $TMP_REMOTE_DUMP + ".log"

$remoteCmd = "cd /tmp 2>/dev/null; sudo -u $REMOTE_DB_USER pg_dump --data-only --column-inserts --no-owner --no-privileges --no-tablespaces $tableArgs $REMOTE_DB_NAME > $TMP_REMOTE_DUMP 2> $TMP_REMOTE_DUMP_LOG; _DUMP_RC=`$?; if [ `$_DUMP_RC -eq 0 ]; then echo DUMP_EXITCODE:True; else echo DUMP_EXITCODE:False; fi; echo DUMP_RC:`$_DUMP_RC; wc -c < $TMP_REMOTE_DUMP | tr -d ' '"


# ---------------------------------------------------------------------------
# RETRY LOGIC for transient SSH failures (timeout, connection reset, etc.)
# ---------------------------------------------------------------------------
$maxRetries  = 3
$retryWait   = 8            # seconds, doubles each retry
$dumpOk      = $false
$dumpRes     = $null
$lastSshExit = -1

for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
    if ($attempt -gt 1) {
        Write-Info ("  Retry {0}/{1} after {2}s backoff ..." -f $attempt, $maxRetries, $retryWait)
        Start-Sleep -Seconds $retryWait
        $retryWait *= 2
    }
    # Use a real subshell so $LASTEXITCODE reflects ssh's actual exit code
    $ErrorActionPreference = 'Continue'
    $dumpRes = @( & ssh -n -o ConnectTimeout=15 -o ServerAliveInterval=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" $remoteCmd 2>&1 )
    $lastSshExit = $LASTEXITCODE
    $dumpFlat  = ($dumpRes | Out-String)
    Write-Info ("  SSH exit={0}; stdout/stderr snippet: {1}" -f $lastSshExit, $dumpFlat.Trim())

    # Classify success: SSH exit 0 AND DUMP_EXITCODE:True present AND a number present (size)
    if ($lastSshExit -eq 0 -and $dumpFlat -match 'DUMP_EXITCODE:True' -and $dumpFlat -match '\d') {
        $dumpOk = $true
        break
    }
    # Diagnose common SSH failures
    if ($dumpFlat -match 'Connection timed out') {
        Write-Info ("  [attempt $attempt] SSH: connection timed out (network / firewall / VPS down?)")
    } elseif ($dumpFlat -match 'Connection refused') {
        Write-Info ("  [attempt $attempt] SSH: connection refused (sshd stopped on VPS?)")
    } elseif ($dumpFlat -match 'Permission denied') {
        Write-Info ("  [attempt $attempt] SSH: auth failed (password/ssh key wrong?); RETRY WON'T FIX this.")
        break
    } elseif ($dumpFlat -match 'DUMP_EXITCODE:False') {
        Write-Info ("  [attempt $attempt] pg_dump itself failed on LIVE (NOT a network error).")
        break
    }
}

# ---------------------------------------------------------------------------
# HANDLE FAILURE
# ---------------------------------------------------------------------------
if (-not $dumpOk) {
    Write-Host ""
    Write-Host "  !!! FAILED TO REACH LIVE SERVER AFTER $maxRetries ATTEMPTS" -ForegroundColor Red
    Write-Host "      SSH exit code = $lastSshExit" -ForegroundColor Red
    Write-Host ""
    Write-Host "  TROUBLESHOOTING CHECKLIST:" -ForegroundColor Yellow
    Write-Host "  1. Internet active?  (browser theke 103.112.62.72 ping করুন)"
    Write-Host "  2. VPS LIVE (running)?  (Console/Replit দিয়ে check)"
    Write-Host "  3. Port 22 open?       (ISP/Corporate firewall বা GP block করতে পারে)"
    Write-Host "  4. SSH auth OK?        (ssh root@103.112.62.72 চালিয়ে দেখুন password/key prompt আসে কিনা)"
    Write-Host "  5. বিলম্বে আবার চেষ্টা করুন (VPS restart হলে 1-2 min লাগে)"
    Write-Host ""
    try {
        # Best-effort pull pg_dump error log if ssh recovered
        scp -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}:$TMP_REMOTE_DUMP_LOG" `
            (Join-Path $TMP_DIR "dump_error.log") 2>$null | Out-Null
        if (Test-Path (Join-Path $TMP_DIR "dump_error.log")) {
            Write-Host "  pg_dump remote ERROR LOG:" -ForegroundColor Red
            Get-Content (Join-Path $TMP_DIR "dump_error.log") | ForEach-Object { Write-Host ("    " + $_) -ForegroundColor DarkRed }
        }
    } catch {}
    # Cleanup anything left on the remote end (best-effort; ignore errors)
    & ssh -n -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" `
        "rm -f $TMP_REMOTE_DUMP $TMP_REMOTE_DUMP_LOG" 2>$null | Out-Null
    exit 1
}

Write-Info "LIVE dump completed remotely (after $attempt attempt(s))."

# Download the dump
try {
    scp -o ConnectTimeout=30 -o BatchMode=yes "${SSH_USER}@${VPS_IP}:$TMP_REMOTE_DUMP" $TMP_DUMP_SQL 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $TMP_DUMP_SQL) -or (Get-Item $TMP_DUMP_SQL).Length -eq 0) {
        throw "scp download failed or file is empty (scp exit=$LASTEXITCODE)."
    }
    Write-Info ("Dump downloaded: {0:N1} KB" -f ((Get-Item $TMP_DUMP_SQL).Length/1KB))
} catch {
    Write-Err "Failed to download dump: $_"
    & ssh -n -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" "rm -f $TMP_REMOTE_DUMP $TMP_REMOTE_DUMP_LOG" 2>$null | Out-Null
    exit 1
}

# Cleanup remote dump immediately
& ssh -n -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" "rm -f $TMP_REMOTE_DUMP $TMP_REMOTE_DUMP_LOG" 2>$null | Out-Null

# ====================================================================
# STEP 3: Post-process dump -> inject UPSERT (ON CONFLICT ... DO UPDATE)
# ====================================================================
Write-Step "Step 3/6 : Post-processing dump (inject upsert / ON CONFLICT DO UPDATE)"

# ---------------------------------------------------------------------
# STATEFUL PARSER (FIX 2 -> multi-line INSERTs + sequence restores)
#
# Rules (anything not explicitly allowed is dropped):
#   (1) Empty line, pg_dump standard SET commands, pg_catalog.set_config -> KEEP
#   (2) \restrict ... / \unrestrict ... (pg_dump ACL blobs) -> DROP (noise)
#   (3) SELECT pg_catalog.setval(...) (sequence restores) -> KEEP (ESSENTIAL
#       so future Django PK inserts don't collide)
#   (4) Lines starting with a Bangla/other Unicode glyphs that CONTINUE a
#       previous INSERT INTO ... VALUES(  clause: ACCUMULATE (NOT DROP).
#       pg_dump --column-inserts nominally writes 1 row per INSERT, but
#       when values contain embedded newlines (or very long Bangla text
#       wrapped by the COPY/send layer), VALUES( spans several PHYSICAL
#       lines until `);` terminator.  Our old filter dropped these and
#       produced SQL like "NULL 1," (missing comma).
#   (5) Lines inside a VALUES(...) block are joined into the INSERT, then
#       the terminating `);` is replaced with the UPSERT clause (see Get-UpsertClause).
#   (6) Everything not matching the above -> DROP and log.
# ---------------------------------------------------------------------
$filteredSqlLines = New-Object System.Collections.Generic.List[string]
$inInsert       = $false          # currently inside a VALUES( block?
$insertBuffer   = [System.Text.StringBuilder]::new()
$keptSetvals    = 0
$droppedCount   = 0

# ---------------------------------------------------------------------
# UPSERT CLAUSE BUILDER
#   ON CONFLICT DO NOTHING made this sync INSERT-ONLY, which silently dropped
#   (a) every mark/grade change made on LIVE, and
#   (b) the ENTIRE results_studentoverallresult table: its local rows are
#       regenerated by Django signals under NEW ids, so the natural key
#       (examination_id, student_id) collided on every INSERT and DO NOTHING
#       swallowed the row. We now upsert on each table's REAL unique key.
# ---------------------------------------------------------------------
$NATURAL_CONFLICT_KEYS = @{
    'results_studentoverallresult'       = @('examination_id', 'student_id')
    'results_result'                     = @('examination_id', 'student_id', 'subject_id')
    'attendance_attendancerecord'        = @('student_id', 'date')
    'attendance_studentattendancesummary' = @('student_id', 'year')
}

function Get-UpsertClause([string]$stmt) {
    # Read the column list straight out of: INSERT INTO public.<table> (<cols>) VALUES (
    $m = [regex]::Match($stmt, '(?is)^\s*INSERT\s+INTO\s+(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([^)]*)\)\s*VALUES\s*\(')
    if (-not $m.Success) { return ' ON CONFLICT DO NOTHING' }

    $table = $m.Groups[1].Value

    # Keep the ORIGINAL token (pg_dump quotes identifiers that need it, e.g. the reserved
    # word "group" in academics_studentprofile). Emitting the unquoted name produced
    # `syntax error at or near "group"`. Name = unquoted form, used only for key matching.
    $cols = @()
    foreach ($tok in ($m.Groups[2].Value -split ',')) {
        $raw = $tok.Trim()
        if (-not $raw) { continue }
        $cols += [pscustomobject]@{ Raw = $raw; Name = $raw.Trim('"') }
    }
    if ($cols.Count -eq 0) { return ' ON CONFLICT DO NOTHING' }

    if ($NATURAL_CONFLICT_KEYS.ContainsKey($table)) { $want = @($NATURAL_CONFLICT_KEYS[$table]) }
    else                                            { $want = @('id') }

    $keys = @($cols | Where-Object { $want -contains $_.Name })
    if ($keys.Count -eq 0) { return ' ON CONFLICT DO NOTHING' }
    $keyNames = @($keys | ForEach-Object { $_.Name })

    # Never rewrite the surrogate id: for natural-key tables the row keeps its LOCAL id, so a
    # live id that already belongs to a different local row can never cause a PK collision.
    $setCols = @($cols | Where-Object { $_.Name -ne 'id' -and $keyNames -notcontains $_.Name })
    if ($setCols.Count -eq 0) { return ' ON CONFLICT DO NOTHING' }

    $keyList = ($keys    | ForEach-Object { $_.Raw }) -join ', '
    $setList = ($setCols | ForEach-Object { "$($_.Raw) = EXCLUDED.$($_.Raw)" }) -join ', '
    return (' ON CONFLICT ({0}) DO UPDATE SET {1}' -f $keyList, $setList)
}

foreach ($rawLine in [System.IO.File]::ReadLines($TMP_DUMP_SQL)) {
    if ($rawLine -eq $null) { continue }
    $trim = $rawLine.Trim()

    # ---------- (A) Simple keepers (not inside an INSERT) ----------
    if (-not $inInsert) {
        if ($trim -eq '')                             { $filteredSqlLines.Add($rawLine); continue }
        if ($trim.StartsWith('--') -and
            -not $trim.StartsWith('--,') -and
            -not $trim.StartsWith('--,,') -and
            -not $trim.StartsWith('--\') -and
            -not ($trim -match '^--[^ \-A-Za-z].*VALUES\b|^--.*''')) {
            # Real pg_dump comment lines (header comments start with -- + space)
            $filteredSqlLines.Add($rawLine); continue
        }
        if ($trim -match '(?i)^SET\b')                { $filteredSqlLines.Add($rawLine); continue }
        if ($trim -match '(?i)^SELECT\s+pg_catalog\.set_config\b') { $filteredSqlLines.Add($rawLine); continue }
        if ($trim -match '(?i)^SELECT\s+pg_catalog\.setval\b')     {
            $filteredSqlLines.Add($rawLine)
            $keptSetvals++
            continue
        }
        if ($trim -match '^\\restrict\b' -or $trim -match '^\\unrestrict\b') {
            Write-Info ("  dropped noise line (\restrict/unrestrict blob)")
            $droppedCount++
            continue
        }

        # ---------- (B) Start of a new INSERT statement ----------
        if ($trim -match '(?is)^\s*INSERT\s+INTO\b') {
            # Does this INSERT end on the SAME physical line?
            if ($trim -match '\);\s*$') {
                $done = [regex]::Replace($rawLine, '\)\s*;\s*$', { param($m) ')' + (Get-UpsertClause $rawLine) + ';' })
                $filteredSqlLines.Add($done)
            } else {
                # Multi-line INSERT: start buffering
                $null = $insertBuffer.Clear()
                $null = $insertBuffer.Append($rawLine)
                $inInsert = $true
            }
            continue
        }

        # ---------- (C) Anything else -> noise ----------
        Write-Info ("  dropped noise line: " + $rawLine)
        $droppedCount++
        continue
    }
    # -----------------------------------------------------------------
    # inside an INSERT buffer (continuation lines)
    # -----------------------------------------------------------------
    else {
        $null = $insertBuffer.AppendLine().Append($rawLine)
        # Did we just reach the terminator?
        if ($trim -match '\);\s*$') {
            $fullStmt = $insertBuffer.ToString()
            # Replace the VERY LAST ); with our conflict clause
            $done = [regex]::Replace($fullStmt, '\)\s*;\s*$', { param($m) ')' + (Get-UpsertClause $fullStmt) + ';' })
            $filteredSqlLines.Add($done)
            $inInsert = $false
            $null = $insertBuffer.Clear()
        }
        # (otherwise keep accumulating)
        continue
    }
}

# Safety net: if parser finished while still inside INSERT, flush buffer as-is
# (shouldn't happen, but prevents losing rows)
if ($inInsert -and $insertBuffer.Length -gt 0) {
    $fullStmt = $insertBuffer.ToString()
    $done = [regex]::Replace($fullStmt, '\)\s*;?\s*$', { param($m) ')' + (Get-UpsertClause $fullStmt) + ';' })
    $filteredSqlLines.Add($done)
    Write-Err "Parser finished while still inside INSERT block - may be truncated (last stmt appended anyway)."
}

Write-Info ("Stateful parser: kept {0} setval restores, dropped {1} noise lines." -f $keptSetvals, $droppedCount)

# Write processed file
$PROCESSED_SQL = Join-Path $TMP_DIR "live_data_processed.sql"

# ---------------------------------------------------------------------
# MIRROR MODE: make the LOCAL synced tables an EXACT copy of LIVE.
#   The import below is DELETE-all + INSERT-all inside ONE transaction, so rows
#   that were deleted or cleared on LIVE also disappear locally (before this,
#   they lingered forever because the import was insert/update only).
#   Deletes run in REVERSE $SYNC_TABLES order => children before parents (FK safe).
# ---------------------------------------------------------------------
$reverseTables = if ($SYNC_TABLES.Count -gt 1) { $SYNC_TABLES[($SYNC_TABLES.Count - 1)..0] } else { $SYNC_TABLES }
$mirrorDeletes = New-Object System.Collections.Generic.List[string]
$mirrorDeletes.Add("-- ===== MIRROR MODE: local == live for the synced tables =====")
foreach ($t in $reverseTables) { $mirrorDeletes.Add("DELETE FROM $t;") }
$mirrorDeletes.Add("-- ===== end of mirror deletes =====")

$processedContent = ($mirrorDeletes -join [Environment]::NewLine) + [Environment]::NewLine + ($filteredSqlLines -join [Environment]::NewLine)
Set-Content -LiteralPath $PROCESSED_SQL -Value $processedContent -Encoding UTF8 -NoNewline
Write-Info ("Mirror mode: {0} synced tables will be emptied and reloaded from LIVE." -f $SYNC_TABLES.Count)

$insertsCnt = ([regex]::Matches($processedContent, 'ON CONFLICT \(')).Count
$nothingCnt = ([regex]::Matches($processedContent, 'ON CONFLICT DO NOTHING')).Count
Write-Info ("Processed {0} INSERT statements with UPSERT (key-targeted DO UPDATE); {1} fell back to DO NOTHING." -f $insertsCnt, $nothingCnt)

# Small safety: dump first 20 + last 5 lines for forensic audit
$debugFirst = @(Get-Content -LiteralPath $PROCESSED_SQL -TotalCount 20)
Write-Info "First 20 lines of processed file for audit:"
$debugFirst | ForEach-Object { Write-Info ("  | " + $_) }
Write-Info "..."
$debugLast = @(Get-Content -LiteralPath $PROCESSED_SQL)
if ($debugLast.Count -gt 5) { $debugLast = $debugLast[($debugLast.Count-5)..($debugLast.Count-1)] }
$debugLast | ForEach-Object { Write-Info ("  | " + $_) }

# ====================================================================
# STEP 4: Import into LOCAL db
# ====================================================================
Write-Step "Step 4/6 : Importing into LOCAL PostgreSQL (MIRROR: local becomes identical to LIVE)"
# MIRROR MODE: the whole file runs in ONE transaction (psql -1) with ON_ERROR_STOP=1.
#   - the processed SQL starts with DELETE FROM <table> for every synced table
#     (reverse FK order), then re-inserts LIVE's rows
#   - if ANY statement fails the entire transaction rolls back, so local is never
#     left half-empty - it either becomes live's exact copy or keeps its old data
try {
    $output = @(& cmd /c "$psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -v ON_ERROR_STOP=1 -1 -f `"$($PROCESSED_SQL.Replace('\','/'))`" 2>&1")
    $errorHits = 0
    foreach ($line in $output) {
        if ($line -match 'ERROR' -or $line -match 'FATAL' -or $line -match 'PANIC') {
            Write-Err ("SQL: " + $line)
            $errorHits++
            if ($errorHits -eq 1) {
                Write-Info "  --- BEGIN FIRST 40 LINES OF PROCESSED SQL (forensic) ---"
                Get-Content -LiteralPath $PROCESSED_SQL -TotalCount 40 | ForEach-Object { Write-Info ("  SQL> " + $_) }
                Write-Info "  --- END FORENSIC DUMP ---"
            }
        }
    }
    # psql prints one command tag per statement. With upserts a row that already exists
    # reports "INSERT 0 1" (updated), so counting these tags is the only honest measure of
    # how much data was actually written - the row COUNT stays flat when nothing is added.
    $ROWS_WRITTEN = 0
    $ROWS_SKIPPED = 0
    foreach ($line in $output) {
        $s = ("$line").Trim()
        if ($s -match '^INSERT \d+ (\d+)') {
            if ([int]$Matches[1] -gt 0) { $ROWS_WRITTEN += [int]$Matches[1] } else { $ROWS_SKIPPED++ }
        } elseif ($s -match '^UPDATE (\d+)') {
            $ROWS_WRITTEN += [int]$Matches[1]
        }
    }
    if ($errorHits -gt 0) {
        Write-Err "Import FAILED inside the single transaction -> EVERYTHING was rolled back; local data is unchanged."
    } else {
        Write-Info ("Import phase done  (rows written: {0}). Local now mirrors LIVE for the synced tables." -f $ROWS_WRITTEN)
    }
} catch {
    Write-Err "Import crashed: $_"
}

# ====================================================================
# STEP 5: MEDIA SYNC  (selective - only referenced photos, skip if local exists)
# APPROACH: BATCH TAR  (1-2 SSH connections TOTAL, not 3668 per-file connections)
#   1. Query LIVE for distinct referenced media paths  (1 SSH)
#   2. Locally compute which are MISSING  (no SSH)
#   3. Upload missing list to LIVE, build a tar.gz of ONLY missing files  (1 SSH)
#   4. scp the single tar.gz  (1 SCP)
#   5. Extract locally  (no SSH)
# ====================================================================
Write-Step "Step 5/6 : Syncing ONLY referenced MEDIA files (photos, logos, signatures) [BATCH TAR mode]"

$mediaListOk = $false
try {
    Write-Info "Querying LIVE database for media references via Python..."
    $listCmd = "cd '$REMOTE_APP_DIR' && ./venv/bin/python get_media_list.py"
    & ssh -n -o ConnectTimeout=30 -o ServerAliveInterval=15 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" $listCmd 2>&1 | Out-Null
    scp -o ConnectTimeout=30 -o BatchMode=yes "${SSH_USER}@${VPS_IP}:/tmp/live_media_list.txt" $TMP_MEDIA_LIST 2>&1 | Out-Null
    & ssh -n -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" "rm -f /tmp/live_media_list.txt" 2>$null | Out-Null

    if (Test-Path $TMP_MEDIA_LIST) { $mediaListOk = $true }
} catch {
    Write-Err "LIVE media list query failed: $_"
}
if (-not $mediaListOk -and -not (Test-Path $TMP_MEDIA_LIST)) {
    Write-Err "Media list could not be obtained from LIVE."
}

# ---------------- 5b: Compute MISSING set (local-only, no SSH) ----------------
$missingPaths  = New-Object System.Collections.Generic.List[string]
$staleMissing  = New-Object System.Collections.Generic.List[string]
$mediaRoot = Join-Path $PWD.Path "media"
try { [void][IO.Directory]::CreateDirectory($mediaRoot) } catch {
    Write-Err ("Failed to create media root: " + $_.Exception.Message)
}

if (Test-Path -LiteralPath $TMP_MEDIA_LIST) {
    $mediaPaths = @(Get-Content -LiteralPath $TMP_MEDIA_LIST -Encoding UTF8 | Where-Object {
        $v = $null
        if ($_) { $v = $_.Trim(" `t`r`n") }
        ($v) -and ($v -ne '\N') -and ($v -notmatch '^\\') -and (-not $v.StartsWith("could not"))
    })
    Write-Info ("Discovered {0} distinct media references on LIVE." -f $mediaPaths.Count)

    foreach ($relPath in $mediaPaths) {
        $rel = $relPath.Trim(" `t`r`n")
        if (-not $rel -or $rel.StartsWith("could not")) { continue }
        $localPath = [IO.Path]::Combine($mediaRoot, $rel)
        try {
            $localPath = [IO.Path]::GetFullPath($localPath)
            if (-not $localPath.StartsWith($mediaRoot, [StringComparison]::OrdinalIgnoreCase)) {
                Write-Err ("Media path outside media root (skipped): $rel")
                continue
            }
            if ([IO.File]::Exists($localPath)) {
                $MEDIA_SKIPPED++
            } else {
                # Fetch all missing media including user_thumbnails from LIVE
                $missingPaths.Add($rel)
            }
        } catch {
            Write-Err ("Media path check error for $rel : " + $_.Exception.Message)
        }
    }
}

Write-Info ("Already on local (skipped): {0}" -f $MEDIA_SKIPPED)
Write-Info ("Auto-thumbs (stale; Django regenerates): {0}" -f $staleMissing.Count)
Write-Info ("To fetch from LIVE: {0}" -f $missingPaths.Count)

if ($staleMissing.Count -gt 0) {
    Write-Info "LIVE stale media (auto-thumbnails / missing on disk; ignored - Django will regenerate):"
    $staleMissing | Select-Object -First 20 | ForEach-Object { Write-Info ("    - $_\") }
    if ($staleMissing.Count -gt 20) { Write-Info ("    ... and {0} more." -f ($staleMissing.Count - 20)) }
}

# ---------------- 5c: BATCH TAR download (1 SCP + 1 SSH + 1 SCP) ----------------
if ($missingPaths.Count -gt 0) {
    $TMP_MISSING_LIST   = Join-Path $TMP_DIR "missing_media.txt"
    $TMP_PY_SCRIPT      = Join-Path $TMP_DIR "build_tar.py"
    $TMP_REMOTE_MISSING = "/tmp/missing_media_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
    $TMP_REMOTE_PY      = "/tmp/build_tar_$(Get-Date -Format 'yyyyMMddHHmmss').py"
    $TMP_REMOTE_TAR     = "/tmp/live_media_batch_$(Get-Date -Format 'yyyyMMddHHmmss').tar.gz"
    $TMP_LOCAL_TAR      = Join-Path $TMP_DIR "live_media_batch.tar.gz"

    # Write missing list
    $missingContent = ($missingPaths.ToArray() -join "`n") + "`n"
    Set-Content -LiteralPath $TMP_MISSING_LIST -Value $missingContent -Encoding UTF8 -NoNewline

    # Write remote python builder script
    $pyScriptContent = @"
import os, sys
missing_file = sys.argv[1]
valid_file = sys.argv[2]
try:
    with open(missing_file, 'r', encoding='utf-8-sig', errors='ignore') as f:
        lines = [line.strip().lstrip('\ufeff') for line in f if line.strip()]
    valid = [l for l in lines if os.path.isfile(l)]
    with open(valid_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(valid) + ('\n' if valid else ''))
    print('TAR_FILES:' + str(len(valid)))
except Exception as e:
    print('TAR_PYTHON_ERR:' + str(e))
"@
    Set-Content -LiteralPath $TMP_PY_SCRIPT -Value $pyScriptContent -Encoding UTF8 -NoNewline

    Write-Info ("Uploading missing-file list ({0} entries) and builder script..." -f $missingPaths.Count)

    try {
        scp -o ConnectTimeout=30 -o BatchMode=yes $TMP_MISSING_LIST "${SSH_USER}@${VPS_IP}:$TMP_REMOTE_MISSING" 2>&1 | Out-Null
        scp -o ConnectTimeout=30 -o BatchMode=yes $TMP_PY_SCRIPT "${SSH_USER}@${VPS_IP}:$TMP_REMOTE_PY" 2>&1 | Out-Null
    } catch {
        Write-Err "Failed to upload missing-media files: $_"
        $missingPaths.Clear()
    }
}

if ($missingPaths.Count -gt 0) {
    Write-Info ("Building batch tar.gz on LIVE for {0} missing files ..." -f $missingPaths.Count)
    $remoteTarCmd = "cd '$REMOTE_APP_DIR/media' && python3 '$TMP_REMOTE_PY' '$TMP_REMOTE_MISSING' /tmp/_valid_media.txt && tar -czf '$TMP_REMOTE_TAR' -T /tmp/_valid_media.txt 2>/dev/null && echo 'TAR_OK:0' && echo 'TAR_PATH:$TMP_REMOTE_TAR' ; rm -f '$TMP_REMOTE_MISSING' '$TMP_REMOTE_PY' /tmp/_valid_media.txt"

    $tarRes = & ssh -n -o ConnectTimeout=60 -o ServerAliveInterval=15 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" $remoteTarCmd 2>&1
    $tarFlat = ($tarRes | Out-String)
    Write-Info ("  Remote tar log snippet: " + ($tarFlat.Trim() -replace '\r?\n',' | '))

    $tarEmpty = ($tarFlat -match 'TAR_FILES:0')
    $tarOk    = ($tarFlat -match 'TAR_OK:')
    $remoteTarPath = $TMP_REMOTE_TAR
    $fileCnt  = 0
    if ($tarFlat -match 'TAR_FILES:(\d+)') { $fileCnt = [int]$matches[1] }

    if (-not $tarOk -or $fileCnt -eq 0) {
        Write-Info "  (No valid missing files found on LIVE disk to tar.)"
    } else {
        Write-Info ("  {0} valid files packed on LIVE; downloading batch tar.gz ..." -f $fileCnt)
        try {
            $scpOutput = scp -o ConnectTimeout=120 -o BatchMode=yes "${SSH_USER}@${VPS_IP}:$remoteTarPath" $TMP_LOCAL_TAR 2>&1
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $TMP_LOCAL_TAR) -or (Get-Item $TMP_LOCAL_TAR).Length -eq 0) {
                Write-Err "scp output: $scpOutput"
                throw "scp of tar.gz failed (exit=$LASTEXITCODE)."
            }
            Write-Info ("  Tar.gz downloaded: {0:N1} KB" -f ((Get-Item $TMP_LOCAL_TAR).Length/1KB))

            # Extract to media root
            $listEntries = & tar -tzf $TMP_LOCAL_TAR 2>$null
            $entryCount = @($listEntries).Count
            Write-Info ("  Extracting {0} entries to {1} ..." -f $entryCount, $mediaRoot)

            Push-Location -LiteralPath $mediaRoot
            try {
                & tar -xzf $TMP_LOCAL_TAR
                if ($LASTEXITCODE -ne 0) { throw "tar -xzf exited with $LASTEXITCODE" }
                $MEDIA_COPIED = $entryCount
            } finally {
                Pop-Location
            }
            Write-Info ("  Extraction done. Copied = {0}." -f $MEDIA_COPIED)
        } catch {
            Write-Err ("Batch tar download/extract FAILED: {0}" -f $_.Exception.Message)
        } finally {
            # Cleanup remote tar file
            & ssh -n -o ConnectTimeout=10 -o BatchMode=yes "${SSH_USER}@${VPS_IP}" "rm -f '$remoteTarPath'" 2>$null | Out-Null
        }
    }
}

# ====================================================================
# STEP 6: Build SUMMARY by querying BEFORE vs AFTER counts
# ====================================================================
Write-Step "Step 6/6 : Computing SYNC SUMMARY"

# AFTER counts are read exactly like BEFORE (Step 1) - no TEMP table involved, so this
# works in a fresh psql session. The BEFORE/AFTER diff is computed in PowerShell below.
$AFTER_COUNTS = Get-TableCounts
if ($AFTER_COUNTS.Count -eq 0) {
    Write-Err "Could not read AFTER counts from the local database."
}

# ====================================================================
# STEP 7: Cleanup temp files
# ====================================================================
Write-Step "Cleanup : removing temp files"
try {
    if (Test-Path $TMP_DIR) { Remove-Item $TMP_DIR -Recurse -Force }
} catch {
    Write-Info "Could not clean up temp dir (may be in use): $TMP_DIR"
}

# ====================================================================
# FINAL: Print summary
# ====================================================================
Write-Host ""
Write-Host "--------------------------------" -ForegroundColor Cyan
Write-Host "       SYNC SUMMARY             " -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$totalInserted = 0
$totalSkipped  = 0
$cntProfiles   = 0
$cntStudents   = 0
$cntExams      = 0
$cntResults    = 0

Write-Host ""
Write-Host ("{0,-35} {1,10} {2,10} {3,10}" -f "TABLE","BEFORE","AFTER","DELTA") -ForegroundColor Gray
Write-Host ("-" * 70) -ForegroundColor Gray
foreach ($t in $COUNT_TABLES) {
    $b = if ($BEFORE_COUNTS.ContainsKey($t)) { [int]$BEFORE_COUNTS[$t] } else { 0 }
    $a = if ($AFTER_COUNTS.ContainsKey($t))  { [int]$AFTER_COUNTS[$t] }  else { 0 }
    $d = $a - $b
    if ($d -gt 0) { $totalInserted += $d }
    switch ($t) {
        "users_profile"            { $cntProfiles = $a }
        "academics_studentprofile" { $cntStudents = $a }
        "results_examination"      { $cntExams    = $a }
        "results_result"           { $cntResults  = $a }
    }
    Write-Host ("{0,-35} {1,10} {2,10} {3,10}" -f $t, $b, $a, $d)
}

Write-Host ""
Write-Host ("{0,-28} {1}" -f "Rows written (INSERT/UPDATE):", $ROWS_WRITTEN) -ForegroundColor Green
Write-Host ("{0,-28} {1}" -f "New rows added (count delta):", $totalInserted) -ForegroundColor Green
Write-Host ("{0,-28} {1}" -f "Statements skipped (no-op):", $ROWS_SKIPPED)  -ForegroundColor DarkYellow
Write-Host ("{0,-28} {1}" -f "Profiles (total):",   $cntProfiles)   -ForegroundColor Cyan
Write-Host ("{0,-28} {1}" -f "Students (total):",   $cntStudents)   -ForegroundColor Cyan
Write-Host ("{0,-28} {1}" -f "Examinations:",       $cntExams)      -ForegroundColor Cyan
Write-Host ("{0,-28} {1}" -f "Results:",            $cntResults)    -ForegroundColor Cyan
Write-Host ("{0,-28} {1}" -f "Media copied:",       $MEDIA_COPIED)  -ForegroundColor Green
Write-Host ("{0,-28} {1}" -f "Media skipped:",      $MEDIA_SKIPPED) -ForegroundColor DarkYellow
Write-Host ("{0,-28} {1}" -f "Errors:",             $ERRORS.Count)  -ForegroundColor $(if ($ERRORS.Count) { 'Red' } else { 'Green' })
if ($ERRORS.Count) {
    Write-Host ""
    Write-Host "ERROR DETAILS:" -ForegroundColor Red
    $ERRORS | ForEach-Object { Write-Host ("  * " + $_) -ForegroundColor Red }
}
Write-Host "--------------------------------" -ForegroundColor Cyan
Write-Host "  DONE - only DATA synced (NO code/logic/schema)." -ForegroundColor Green
Write-Host ""
