#!/usr/bin/env bash
set -euo pipefail
APP_ID=com.codialo.Bunkialo2
EVIDENCE=artifacts/legacy-emulator/evidence
mkdir -p "$EVIDENCE"
adb root
adb wait-for-device
adb install --no-incremental artifacts/legacy-emulator/universal.apk
adb logcat -c
# The original release keeps its native modules, manifest, channel and runtime. Only the
# universal APK's signature is changed to a disposable test key for installation.
adb shell am start -n "$APP_ID/.MainActivity"
python3 - <<'PY'
import subprocess, time, pathlib, sqlite3, os
out=pathlib.Path('artifacts/legacy-emulator/evidence')
expected=os.environ['EXPECTED_UPDATE_ID'].replace('-', '').upper()
for attempt in range(90):
    paths=subprocess.check_output(['adb','shell','find','/data/user/0/com.codialo.Bunkialo2','-name','*.db'],text=True).splitlines()
    for path in paths:
        if 'updates' not in path.lower(): continue
        target=out/'updates.db'
        result=subprocess.run(['adb','pull',path,str(target)],capture_output=True)
        if result.returncode: continue
        # Copy WAL too when present so the downloaded update is visible.
        subprocess.run(['adb','pull',path+'-wal',str(target)+'-wal'],capture_output=True)
        try:
            con=sqlite3.connect(target)
            rows=con.execute('SELECT hex(id), runtime_version, status FROM updates').fetchall()
            con.close()
            (out/'update-rows.txt').write_text(repr(rows))
            # Expo Updates status READY=1; embedded update has status=5.
            if any(update_id==expected and runtime==os.environ['EXPECTED_RUNTIME'] and status==1 for update_id,runtime,status in rows):
                print('Production OTA downloaded and ready:',rows)
                raise SystemExit(0)
        except sqlite3.Error:
            pass
    time.sleep(5)
raise SystemExit('Expected production OTA did not download')
PY
adb shell am force-stop "$APP_ID"
adb logcat -c
adb shell am start -n "$APP_ID/.MainActivity"
sleep 30
adb logcat -d > "$EVIDENCE/logcat.txt"
adb shell uiautomator dump /sdcard/legacy-layout.xml
adb pull /sdcard/legacy-layout.xml "$EVIDENCE/layout.xml"
adb exec-out screencap -p > "$EVIDENCE/old-runtime-login.png"
python3 - <<'PY'
from pathlib import Path
import os, sqlite3, subprocess
p=Path('artifacts/legacy-emulator/evidence')
log=(p/'logcat.txt').read_text()
layout=(p/'layout.xml').read_text()
if 'FATAL EXCEPTION' in log or 'ReactNativeJS: Error:' in log:
    raise SystemExit('Native or JavaScript crash; inspect logcat artifact')
if 'LMS' not in layout and 'Sign in' not in layout and 'Roll' not in layout:
    raise SystemExit('Expected sign-in UI after launching downloaded OTA')
dbpath=subprocess.check_output(['adb','shell','find','/data/user/0/com.codialo.Bunkialo2','-name','updates.db'],text=True).strip()
subprocess.run(['adb','pull',dbpath,str(p/'launched.db')],check=True)
subprocess.run(['adb','pull',dbpath+'-wal',str(p/'launched.db')+'-wal'],capture_output=True)
con=sqlite3.connect(p/'launched.db')
row=con.execute('SELECT successful_launch_count, failed_launch_count FROM updates WHERE hex(id)=?',(os.environ['EXPECTED_UPDATE_ID'].replace('-','').upper(),)).fetchone()
if row is None or row[0]<1 or row[1]!=0:
    raise SystemExit(f'Expected update did not launch successfully: {row}')
print('Native app successfully launches the exact production OTA:',os.environ['EXPECTED_UPDATE_ID'],row)
PY

# Confirm that default wardens were cached in persistent Documents storage.
python3 - <<'PYTEST'
import json, pathlib, subprocess, time
expected=set(json.loads(pathlib.Path('artifacts/legacy-emulator/expected-photo-files.json').read_text()))
base='/data/user/0/com.codialo.Bunkialo2/files/faculty-photos-v1'
for attempt in range(36):
    result=subprocess.run(['adb','shell','ls',base],capture_output=True,text=True)
    cached=set(result.stdout.split())
    if expected <= cached:
        break
    time.sleep(5)
else:
    raise SystemExit(f'Default warden photo cache missing: {expected-cached}')
print('Default warden photos cached in persistent storage:', sorted(expected))
subprocess.run(['adb','shell','am','force-stop','com.codialo.Bunkialo2'],check=True)
subprocess.run(['adb','shell','am','start','-n','com.codialo.Bunkialo2/.MainActivity'],check=True)
time.sleep(15)
after=set(subprocess.check_output(['adb','shell','ls',base],text=True).split())
if not expected <= after: raise SystemExit('Photo cache did not survive app restart')
print('Persistent photo cache survives app restart')
pathlib.Path('artifacts/legacy-emulator/evidence/photo-cache.txt').write_text('Default wardens cached; retained after restart.\n'+repr(sorted(after)))
PYTEST

# Validate the same OS activity used by Settings > Battery. Do not whitelist the
# app here: users retain control of battery exemptions on their own devices.
adb shell am start -a android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS > "$EVIDENCE/battery-settings.txt" 2>&1
if rg -qi 'error:|exception' "$EVIDENCE/battery-settings.txt"; then
  cat "$EVIDENCE/battery-settings.txt"
  exit 1
fi
adb shell uiautomator dump /sdcard/battery-layout.xml
adb pull /sdcard/battery-layout.xml "$EVIDENCE/battery-layout.xml"
adb exec-out screencap -p > "$EVIDENCE/battery-settings.png"
adb shell dumpsys deviceidle > "$EVIDENCE/device-idle.txt"
adb shell am start -n "$APP_ID/.MainActivity"
