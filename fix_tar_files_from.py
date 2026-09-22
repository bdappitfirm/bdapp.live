with open('sync_live_to_local.ps1', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if '$buildTarCmd =' in line:
        new_lines.append('    $buildTarCmd = "cd \\"$REMOTE_APP_DIR/media\\" 2>/dev/null && tar -czf \\"$TMP_REMOTE_TAR\\" --files-from=\\"$TMP_REMOTE_MISSING\\" --ignore-failed-read && echo TAR_OK:0 || echo TAR_FAIL:1"\n')
        skip = True
        continue
    if skip:
        if '"@' in line or "'" in line and '=' not in line: # end of here string or old block
            skip = False
        continue
    new_lines.append(line)

with open('sync_live_to_local.ps1', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully updated $buildTarCmd to use tar --files-from")
