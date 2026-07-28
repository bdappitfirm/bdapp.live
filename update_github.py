
import subprocess
import sys
import os
from datetime import datetime

def get_bengali_timestamp():
    # English month names written in Bengali script
    months_bn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]

    now = datetime.now()
    day = now.day
    month = months_bn[now.month - 1]
    year = now.year
    hour = now.hour
    minute = now.minute

    # Period markers (রাত, সকাল, দুপুর etc)
    period_bn = ""
    if 0 <= hour < 6: period_bn = "রাত"
    elif 6 <= hour < 12: period_bn = "সকাল"
    elif 12 <= hour < 15: period_bn = "দুপুর"
    elif 15 <= hour < 18: period_bn = "বিকাল"
    elif 18 <= hour < 20: period_bn = "সন্ধ্যা"
    else: period_bn = "রাত"

    # AM/PM and 12-hour format
    am_pm = "A.M." if hour < 12 else "P.M."
    display_hour = hour % 12
    if display_hour == 0: display_hour = 12

    # Using English digits for date, year and time as requested
    timestamp = f"({day} {month} {year} {period_bn} {display_hour}:{minute:02d} {am_pm})"
    return timestamp

def run_command(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, shell=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        if "nothing to commit" in e.stderr:
            return "NOTHING_TO_COMMIT"
        print(f"Error: {e.stderr}")
        return None

def generate_message():
    status = run_command("git status --short")
    if not status or status == "NOTHING_TO_COMMIT":
        return None

    lines = status.split('\n')
    changes = []
    for line in lines:
        parts = line.strip().split('/')
        if len(parts) > 1:
            changes.append(parts[0].split()[-1])
        else:
            changes.append("root files")

    unique_changes = list(set(changes))
    msg = f"Updated {', '.join(unique_changes[:3])}"
    if len(unique_changes) > 3:
        msg += " and other modules"

    # Append Bengali Timestamp
    msg += f" {get_bengali_timestamp()}"
    return msg

def update():
    print("🔍 Checking for changes...")

    # Add changes
    run_command("git add .")

    # Generate Message
    message = generate_message()
    if not message:
        print("✅ Everything is already up to date.")
        return

    print(f"📝 Intelligent Commit: {message}")

    # Commit
    commit_res = run_command(f'git commit -m "{message}"')
    if commit_res == "NOTHING_TO_COMMIT":
        print("✅ No new changes to commit.")
        return

    # Push
    print("📤 Pushing to GitHub...")
    push_res = run_command("git push")

    if push_res is not None:
        print("🚀 Success! GitHub repository updated.")
    else:
        print("❌ Push failed. Please check your internet or git credentials.")

if __name__ == "__main__":
    update()
