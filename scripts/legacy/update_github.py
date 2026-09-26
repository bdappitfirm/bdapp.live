
import subprocess
import sys
import os
from datetime import datetime

def get_timestamp():
    # Standard English timestamp format
    # Example: (29 July 2024 02:44 AM)
    now = datetime.now()
    return now.strftime("(%d %B %Y %I:%M %p)")

def run_command(command):
    try:
        # Running with default encoding since we removed Bengali
        result = subprocess.run(command, capture_output=True, text=True, check=True, shell=True)
        return result.stdout.strip() if result.stdout else ""
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr or ""
        if "nothing to commit" in err_msg:
            return "NOTHING_TO_COMMIT"
        print(f"Error executing: {command}")
        print(f"Details: {err_msg}")
        return None
    except Exception as e:
        print(f"Unexpected Error: {e}")
        return None

def generate_message():
    status = run_command("git status --short")
    if not status or status == "NOTHING_TO_COMMIT":
        return None

    lines = status.split('\n')
    changes = []
    for line in lines:
        # Extract folder/file names for a smart message
        parts = line.strip().split('/')
        if len(parts) > 1:
            # Get the module name (first folder)
            module = parts[0].split()[-1]
            changes.append(module)
        else:
            changes.append("root files")

    unique_changes = list(set(changes))
    msg = f"Updated {', '.join(unique_changes[:3])}"
    if len(unique_changes) > 3:
        msg += " and other modules"

    # Append English Timestamp
    msg += f" {get_timestamp()}"
    return msg

def update():
    print("Checking for changes...")

    # Stage all changes
    run_command("git add .")

    # Generate Intelligent Message
    message = generate_message()
    if not message:
        print("Everything is already up to date.")
        return

    print(f"Commit Message: {message}")

    # Commit with escaped message
    safe_message = message.replace('"', '\\"')
    commit_res = run_command(f'git commit -m "{safe_message}"')

    if commit_res is None:
        print("Commit failed.")
        return

    if commit_res == "NOTHING_TO_COMMIT":
        print("No new changes to commit.")
        return

    # Push to GitHub
    print("Pushing to GitHub...")
    push_res = run_command("git push")

    if push_res is not None:
        print("Success! GitHub repository updated.")
    else:
        print("Push failed. Please check your internet or git credentials.")

if __name__ == "__main__":
    update()
