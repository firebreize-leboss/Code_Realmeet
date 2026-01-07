import os
import shutil
import subprocess
import sys

PROJECT_PATH = r"C:\Users\Noa\Code_Realmeet"

def find_claude():
    for name in ("claude", "claude.cmd", "claude.exe", "claude.bat"):
        p = shutil.which(name)
        if p:
            return p
    return None

def main():
    claude_path = find_claude()
    if not claude_path:
        print("❌ Claude introuvable dans le PATH")
        sys.exit(1)

    prompt = """
envoies moi le pourcentage restant d'utilisation de la session UNIQUEMENT, je ne veux que le nombre en pourcentage

"""

    result = subprocess.run(
        [
            claude_path,
            "--print",
            "--model", "opus",                 # ✅ Opus 4 (dernière version)
            "--tools", "default",
            "--permission-mode", "acceptEdits",
            "--add-dir", PROJECT_PATH,
        ],
        input=prompt,
        text=True,
        cwd=PROJECT_PATH,
        capture_output=True
    )

    if result.returncode != 0:
        print("❌ Erreur Claude")
        print(result.stderr)
        sys.exit(result.returncode)

    print(result.stdout)

if __name__ == "__main__":
    main()