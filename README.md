# POC-ORG1

A small todo-list app built with HTML, CSS, and vanilla JavaScript. Create a
browser-local demo account, log in, and add, complete, or delete your own saved
tasks. No database, frontend framework, packages, or build step are required.

## Repository contents

- `index.html`: accessible task form and list.
- `styles.css`: responsive styling.
- `app.js`: browser interactions.
- `auth.js`: demo account validation, password derivation, and local storage.
- `todo.js`: task state shared with the tests.
- `tests`: task behavior and repository smoke tests.
- `.github\workflows\blank.yml`: automated tests on pushes and pull requests to
  `main`, plus manual runs. Existing CODEOWNERS rules are preserved.

## Getting started

Serve this folder with a static HTTP server, then open it in your browser. For
example, if Python 3 is available, run this from the repository root:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000>. A server is needed because the app uses JavaScript
modules.

Choose **Sign up**, enter a username and a made-up password, and confirm it.
Signup logs you in. Use **Log out** to return to the login form; logging back in
restores that account's tasks and completion state. Each account has its own
list, including when multiple demo accounts use the same browser.

## Demo-only storage and security

This is **not secure authentication for real users**. Browser-local checks can
be bypassed, and anyone with access to the browser can read or edit the stored
accounts and unencrypted tasks. Do not enter sensitive tasks or reuse a real
password. There is no server, email verification, password recovery, or remote
authorization.

Accounts are stored under `poc-org1.demo-accounts.v1` in `localStorage` for the
current origin. Passwords are not stored in plaintext: Web Crypto derives a
256-bit hash using PBKDF2-HMAC-SHA-256, 600,000 iterations, and a random 128-bit
salt per account. These hashes are still subject to offline guessing, and
client-side password hashing does not make this a secure login system.

Tasks persist across reloads, but login sessions are kept only in memory:
reloading requires logging in again. Data does not sync between browsers,
devices, or site addresses. Clearing site data deletes all accounts and tasks.
Private browsing may discard them when the browser closes.

Use HTTPS or localhost in a modern browser with Web Crypto and browser storage
enabled. Storage failures, unsupported cryptography, and invalid saved data are
shown as errors; failed writes do not change the displayed task list. Corrupt
data is never silently reset. To recover from corrupt demo data, inspect or
export the site storage first, then explicitly clear this site's demo data if
you accept losing all its demo accounts and tasks. Changes from other tabs
refresh the list; removing or changing the active account returns it to login.

## Running the checks

Use Node.js 20 or later and Git. From the repository root, run:

```powershell
npm test
```

No dependency installation is needed. GitHub Actions runs the same test command.
In Windows PowerShell, use `npm.cmd test` if the `npm.ps1` launcher is blocked by
your script execution policy.

| Test case | Expected result |
| --- | --- |
| Sign up with a valid username and matching demo passwords | Store a salted derived hash and log in |
| Invalid username, short password, mismatch, or duplicate username | Show an error without changing saved data |
| Log out, reload, then log in | Require credentials and restore the account's saved tasks |
| Wrong username or password | Reject login without exposing another account's tasks |
| Two accounts using the same browser | Keep their saved lists separate |
| Full or blocked storage, malformed saved data, or unavailable Web Crypto | Report failure without silent resets or success-shaped updates |
| Add a task | Trim its text and create an incomplete task with a unique ID |
| Add empty or whitespace-only text | Reject it without changing the list |
| Toggle a task twice | Mark it complete, then incomplete again |
| Delete a task | Remove only that task; deleting the last task leaves an empty list |
| Duplicate task text | Give each task its own ID, completion state, and delete action |
| Mutate a returned task or snapshot | Do not change the stored task state |
| Toggle or delete an unknown ID | Report an error without changing the list |
| Required app and repository files exist and are nonempty | Pass; a missing or empty file fails |
| Tracked text files contain no unresolved merge-conflict markers | Pass; a conflict marker fails |
| Tracked text files contain no trailing spaces or tabs | Pass; trailing whitespace fails |

The repository text checks support LF and CRLF line endings and skip binary
files. Stage new files before running the suite so they are included.

For a browser smoke test, sign up with a made-up password, add a task with the
keyboard, check and uncheck it, delete it, and try whitespace-only text. Log
out, try an incorrect password, then log in correctly and confirm the remaining
tasks are restored. Create a second account and verify its list is separate.
Confirm the task count, empty state, validation messages, and keyboard focus.
Task text should display literally, including text that looks like HTML.

## Optional demo recording tools

The demo video is a recording of actual browser interactions made with
Playwright. Recording tools are separate from the app and its normal test
suite; neither requires Playwright.

On Windows with Node.js 24 or later, if optional browser or video-encoder
downloads fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, enable the system's
trusted certificate store before retrying the recording-tool installation:

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
```

This resolved the download failure in the demo recording environment without
disabling TLS certificate verification.
