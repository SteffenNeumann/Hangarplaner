# Deployment (SSH + rsync)

Prerequisites
- SSH access to your web server (hangarplaner.de)
- PHP enabled on the server
- Document root path (e.g., /var/www/html or ~/public_html)
- SSH key or agent configured (no passwords in files)

One-time server prep
- Ensure PHP endpoints are deployed under <docroot>/sync/
- The "sync" directory must be writable by the web server user

Protecting runtime data
- The deploy config protects <docroot>/sync/data.json from deletion/overwrite.
- The app will create sync/data.json after the first Master write if it doesn’t exist.

Deploy commands

1) Set environment variables and run a dry run first:

   DEPLOY_HOST=hangarplaner.de \
   DEPLOY_USER=your_ssh_user \
   DEPLOY_PATH=/path/to/webroot \
   DRY_RUN=1 bash scripts/deploy.sh

2) If output looks correct, run the real deploy:

   DEPLOY_HOST=hangarplaner.de \
   DEPLOY_USER=your_ssh_user \
   DEPLOY_PATH=/path/to/webroot \
   bash scripts/deploy.sh

Seeding server data (optional)
- Option A: copy a seed file on the server as sync/data.json
- Option B: issue a single Master POST to create it:

  curl -X POST https://hangarplaner.de/sync/data.php \
    -H 'Content-Type: application/json' \
    -H 'X-Sync-Role: master' \
    -H 'X-Sync-Session: init' \
    --data '{"metadata":{"timestamp":0},"settings":{}}'

Troubleshooting
- 404 on /sync/data.php: PHP or path not configured; verify that <docroot>/sync/data.php exists and is executable by the web server.
- Parse error in storage-browser.js: the page now feature-detects and falls back to js/storage-browser.legacy.js automatically; make sure both files were deployed.
- Permissions: if writes fail, ensure the sync directory is writable by the web server user.
