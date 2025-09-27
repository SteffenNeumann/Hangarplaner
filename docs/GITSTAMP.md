# Dynamic Gitstamp (commit info in UI)

This project can display the current commit (date and short SHA) in the header automatically, without manual edits.

How it works
- On every page load, the app fetches gitinfo.json and updates the header’s gitstamp element.
- The value is then formatted to dd.mmm HH:MM by an existing formatter.

Commands
- Update the metadata file manually at any time:
  scripts/update-gitinfo.sh

Automation options
1) Pre-commit hook (local, not versioned):
   Create .git/hooks/pre-commit with:

   #!/usr/bin/env bash
   set -e
   scripts/update-gitinfo.sh
   git add gitinfo.json

   chmod +x .git/hooks/pre-commit

   This ensures gitinfo.json always matches your commit.

2) CI (e.g., GitHub Actions):
   Run the same script in your build job, commit the file or inject it into build artifacts.

Notes
- gitinfo.json is served from the site root (same origin).
- If the fetch fails, the UI falls back to the static text in index.html.
