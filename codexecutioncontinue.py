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
erreur : RPC get_activities_with_slots error: {"code": "42804", "details": "Returned type numeric does not match expected type bigint in column 21.", "hint": null, "message": "structure of query does not match function result type"}
pour chaque modification, corriges toi meme le fichier en question au
bon endroit et de la bonne façon. Je veux qu'absolument tout soit 
opérationnel quand tu as fini de tourner. 

"""

    result = subprocess.run(
        [
            claude_path,
            "--print",
            "--model", "sonnet",                 # ✅ Opus 4 (dernière version)
            "--tools", "default",
            "--permission-mode", "acceptEdits",
            "--add-dir", PROJECT_PATH,
        ],
        input=prompt,
        text=True,
        encoding="utf-8",          # ✅ force UTF-8 au lieu de cp1252
        errors="strict",           # ou "replace" si tu veux jamais planter
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