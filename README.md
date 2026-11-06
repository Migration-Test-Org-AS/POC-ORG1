# POC-ORG1

A small todo-list app built with HTML, CSS, and vanilla JavaScript. Add a task,
check it off, or delete it. No frontend framework, packages, or build step are
required.

## Repository contents

- `index.html`: accessible task form and list.
- `styles.css`: responsive styling.
- `app.js`: browser interactions.
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

Tasks are kept in memory for the current page session. Reloading the page clears
the list.

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

For a browser smoke test, add a task with the keyboard, check and uncheck it,
delete it, and try submitting whitespace-only text. Confirm the task count,
empty state, validation message, and keyboard focus update correctly. Task text
should display literally, including text that looks like HTML.
