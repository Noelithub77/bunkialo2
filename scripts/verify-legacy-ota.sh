#!/usr/bin/env bash
set -euo pipefail
APP_ID=com.codialo.Bunkialo2
EVIDENCE=artifacts/legacy-emulator/evidence
mkdir -p "$EVIDENCE"
adb root
adb wait-for-device
adb install --no-incremental artifacts/legacy-emulator/universal.apk
adb logcat -c
# Build 59 keeps its native modules, manifest, channel and runtime. Only the
# universal APK's signature is changed to a disposable test key for installation.
adb shell am start -n "$APP_ID/.MainActivity"
python3 - <<'PY'
import subprocess, time, pathlib, sqlite3
out=pathlib.Path('artifacts/legacy-emulator/evidence')
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
            # Expo Updates status READY=1; embedded update has status=2.
            if any(runtime=='1.4.1' and status==1 for _,runtime,status in rows):
                print('Production SDK 54 OTA downloaded and ready:',rows)
                raise SystemExit(0)
        except sqlite3.Error:
            pass
    time.sleep(5)
raise SystemExit('No ready production OTA for runtime 1.4.1 downloaded')
PY
adb shell am force-stop "$APP_ID"
adb shell am start -n "$APP_ID/.MainActivity"
sleep 30
adb logcat -d > "$EVIDENCE/logcat.txt"
adb shell uiautomator dump /sdcard/legacy-layout.xml
adb pull /sdcard/legacy-layout.xml "$EVIDENCE/layout.xml"
adb exec-out screencap -p > "$EVIDENCE/old-runtime-login.png"
python3 - <<'PY'
from pathlib import Path
p=Path('artifacts/legacy-emulator/evidence')
log=(p/'logcat.txt').read_text()
layout=(p/'layout.xml').read_text()
if 'FATAL EXCEPTION' in log or 'ReactNativeJS: Error:' in log:
    raise SystemExit('Native or JavaScript crash; inspect logcat artifact')
if 'LMS' not in layout and 'Sign in' not in layout and 'Roll' not in layout:
    raise SystemExit('Expected sign-in UI after launching downloaded OTA')
print('Old build 59 successfully launches the downloaded production OTA')
PY
