# Login Function (handleLogin) — Hangar Planner

This document explains the login flow implemented in `login.html`.

## Location
- File: `/login.html`
- Primary function: `handleLogin(event)`
- Related helpers (same file): `showMessage`, `hideMessage`, `switchTab`
- Related backend endpoint: `/sync/auth.php`

## UI Trigger
- The login form `<form id="loginForm" onsubmit="handleLogin(event)">` calls `handleLogin` on submit.

## Inputs
- Email: `#loginEmail` (type=email, required)
- Password: `#loginPassword` (type=password, required, minlength=8)

## Network Request
- Method: `POST`
- URL: `sync/auth.php`
- Headers: `Content-Type: application/json`
- Body (JSON):
  ```json
  {
    "action": "login",
    "email": "<email>",
    "password": "<password>"
  }
  ```

## Expected Response (from backend)
- On success:
  ```json
  {
    "success": true,
    "user": {
      "email": "user@example.com",
      "displayName": "Optional Display Name" // optional
    }
  }
  ```
- On failure:
  ```json
  {
    "success": false,
    "error": "Reason for failure"
  }
  ```

## Success Path
1. Parses JSON response.
2. If `data.success` is true:
   - Determines a display name for the presence system:
     - If `data.user.displayName` exists: uses that.
     - Otherwise: uses the local-part of `data.user.email` (before `@`).
   - Persists to `localStorage` under key `presence.displayName`.
   - Shows a success message via `showMessage(...)`.
   - Redirects to `index.html` after ~1 second.

## Failure and Error Handling
- If `data.success` is false: shows `data.error` (or `"Login failed"`) via `showMessage(..., 'error')`.
- If fetch or parsing throws: shows a generic `"Connection error. Please try again."` and logs the error to console.

## Side Effects
- `localStorage.setItem('presence.displayName', ...)` is written on successful login.
- Browser navigation to `index.html` after success.

## Related Behavior (Same Page)
- Registration: `handleRegister(event)` posts to `sync/auth.php` with `action: 'register'` and similar JSON body.
- Session check on load:
  - On `DOMContentLoaded`, performs `fetch('sync/auth.php?action=session')`.
  - If already logged in (`data.success && data.user`), redirects to `/index.html` immediately.

## Known Considerations
- Fallback display name logic:
  - Current code path uses `data.user.email` in the fallback branch, which assumes `data.user` exists. If `data.user` is missing, this would throw. A safe variant would check `data.user` before accessing its fields or fall back to the entered email value.
- Redirect consistency:
  - Success redirect uses `index.html` (relative), session check uses `/index.html` (absolute). Consider standardizing.
- Security:
  - Ensure the app is served over HTTPS so credentials are protected in transit.
  - Backend should enforce password policy and rate limiting regardless of frontend constraints.

## Testing Instructions
1. Open `/login.html` in the browser.
2. Enter a valid email and password (≥8 chars) for a known user.
3. Submit and verify:
   - Success: green message shows; `localStorage.presence.displayName` is set; redirect to `index.html` occurs.
   - Failure: red error message shows with backend-provided reason.
4. With an active session, refresh `login.html` and confirm immediate redirect to `/index.html`.

## Account approval notifications
- When an admin approves a user via the approval link, the backend now sends the user a confirmation email with a direct link to `/login.html`.
- If email cannot be sent, the message is logged to `sync/mail_outbox.txt`.

## Admin unapprove (revoke approval)
- Endpoint: `sync/auth.php`
- Method: `POST`
- Body:
```json path=null start=null
{
  "action": "admin_unapprove",
  "email": "user@example.com"
}
```
- Requires `admin_login` (secret in `sync/config.php`).
- Sets `approved` to false, clears `approvedAt`, and regenerates a new `approvalToken` so the user can be approved again later.

## Admin approve (manual)
- Endpoint: `sync/auth.php`
- Method: `POST`
- Body:
```json path=null start=null
{
  "action": "admin_approve",
  "email": "user@example.com"
}
```
- Immediately approves the user, clears their token, and emails the user a login link.

## Admin resend approval (pending users)
- Endpoint: `sync/auth.php`
- Method: `POST`
- Body:
```json path=null start=null
{
  "action": "admin_resend_approval",
  "email": "user@example.com"
}
```
- Re-sends the admin approval link email (uses configured admin address). If no token exists yet, a new one is generated.

## File Snippet (handleLogin)
```html
<script>
  async function handleLogin(event) {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const response = await fetch('sync/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
      });
      const data = await response.json();

      if (data.success) {
        if (data.user && data.user.displayName) {
          localStorage.setItem('presence.displayName', data.user.displayName);
        } else {
          localStorage.setItem('presence.displayName', data.user.email.split('@')[0]);
        }
        showMessage('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
      } else {
        showMessage(data.error || 'Login failed', 'error');
      }
    } catch (error) {
      showMessage('Connection error. Please try again.', 'error');
      console.error('Login error:', error);
    }
  }
</script>
```
