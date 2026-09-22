with open('sync_live_to_local.ps1', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('$remoteCmd = @"')
if start != -1:
    end = text.find('"@', start) + 2
    old_block = text[start:end]
    new_block = r'''$remoteCmd = "cd /tmp 2>/dev/null; sudo -u $REMOTE_DB_USER pg_dump --data-only --column-inserts --no-owner --no-privileges --no-tablespaces $tableArgs $REMOTE_DB_NAME > $TMP_REMOTE_DUMP 2> $TMP_REMOTE_DUMP_LOG; _DUMP_RC=`$?; if [ `$_DUMP_RC -eq 0 ]; then echo DUMP_EXITCODE:True; else echo DUMP_EXITCODE:False; fi; echo DUMP_RC:`$_DUMP_RC; wc -c < $TMP_REMOTE_DUMP | tr -d ' '"'''
    text = text.replace(old_block, new_block)
    with open('sync_live_to_local.ps1', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully converted $remoteCmd to single line")
else:
    print("Could not find remoteCmd block")
