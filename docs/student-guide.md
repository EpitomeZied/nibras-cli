# Nibras CLI — Complete Setup Guide

> **Platforms covered:** macOS · Linux · Windows (PowerShell & Git Bash)

This guide takes you from a brand-new machine to a working Nibras submission in the shortest path possible. Follow the section that matches your operating system, then continue with the shared workflow steps.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
   - [macOS](#macos)
   - [Linux](#linux)
   - [Windows](#windows)
2. [Install the Nibras CLI](#2-install-the-nibras-cli)
3. [Verify the Installation](#3-verify-the-installation)
4. [Log In](#4-log-in)
5. [Join a Course](#5-join-a-course)
6. [Set Up a Project](#6-set-up-a-project)
7. [Work on the Task](#7-work-on-the-task)
8. [Run Local Tests](#8-run-local-tests)
9. [Submit Your Work](#9-submit-your-work)
10. [Check Session & Project Status](#10-check-session--project-status)
11. [Update & Uninstall](#11-update--uninstall)
12. [Troubleshooting](#12-troubleshooting)
13. [FAQ](#13-faq)

---

## 1. Prerequisites

You need **Node.js ≥ 18**, **npm ≥ 9**, and **git** before installing the CLI. Pick your OS below.

---

### macOS

#### Option A — nvm (recommended, avoids permission issues)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload your shell (or open a new terminal)
source ~/.zshrc        # zsh (default on macOS 10.15+)
# source ~/.bashrc     # bash

# Install the latest LTS release of Node.js
nvm install --lts
nvm use --lts
nvm alias default node
```

#### Option B — Homebrew

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (includes npm)
brew install node
```

> **Apple Silicon (M1/M2/M3):** Homebrew installs to `/opt/homebrew/bin`. If `node` is not found after install, add `/opt/homebrew/bin` to your PATH:
>
> ```bash
> echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
> ```

#### Install git (macOS)

git ships with Xcode Command Line Tools. If not already installed:

```bash
xcode-select --install
```

Or via Homebrew: `brew install git`

#### Verify (macOS)

```bash
node --version    # must show v18.x or higher
npm --version     # must show 9.x or higher
git --version
```

---

### Linux

#### Option A — nvm (recommended)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc    # or ~/.zshrc if you use zsh

# Install Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default node
```

#### Option B — Package manager

**Debian / Ubuntu:**

```bash
# Add NodeSource repo for Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Fedora / RHEL / CentOS:**

```bash
sudo dnf install -y nodejs npm
```

**Arch Linux:**

```bash
sudo pacman -S nodejs npm
```

#### Install git (Linux)

```bash
# Debian / Ubuntu
sudo apt-get install -y git

# Fedora
sudo dnf install -y git

# Arch
sudo pacman -S git
```

#### Fix npm global permissions without sudo (Linux)

If you used a system package manager (not nvm), running `npm install -g` may require sudo or fail with `EACCES`. Fix it once:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Verify (Linux)

```bash
node --version    # v18.x or higher
npm --version     # 9.x or higher
git --version
```

---

### Windows

> **Recommended shell:** Use **Windows Terminal** with PowerShell 7+ or **Git Bash** (bundled with Git for Windows). Avoid the legacy `cmd.exe` — it lacks features needed by some CLI output.

#### Step 1 — Install Node.js

**Option A — winget (Windows 10 1709+ / Windows 11):**

```powershell
winget install OpenJS.NodeJS.LTS
```

**Option B — Official installer:**

Download and run the `.msi` from [nodejs.org](https://nodejs.org/en/download) (choose the **LTS** version). The installer adds Node.js and npm to PATH automatically.

**Option C — nvm-windows (allows multiple Node versions):**

1. Download the latest `nvm-setup.exe` from [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Run the installer
3. Open a **new** PowerShell window as **Administrator**:

```powershell
nvm install lts
nvm use lts
```

#### Step 2 — Install Git for Windows

Download and run the installer from [git-scm.com](https://git-scm.com/download/win).

During setup:

- **Default editor:** choose your preference
- **Adjusting PATH:** select _Git from the command line and also from 3rd-party software_
- **Line ending conversions:** select _Checkout as-is, commit Unix-style line endings_

#### Step 3 — Set PowerShell execution policy (if needed)

If scripts are blocked, run once in PowerShell as Administrator:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Verify (Windows)

Open a **new** PowerShell or Git Bash window (important — PATH changes need a fresh shell):

```powershell
node --version    # v18.x or higher
npm --version     # 9.x or higher
git --version
```

---

## 2. Install the Nibras CLI

Install the pinned release directly from the Git tag. Run this in your terminal (all platforms):

```bash
npm install -g git+https://github.com/NibrasPlatform/nibras-cli.git#v1.0.2
```

> **Behind a corporate proxy?** Set `npm_config_https_proxy` and `npm_config_proxy` before running, or configure them in `.npmrc`.

### Upgrade an existing install

If you already have a different version installed:

```bash
npm install -g git+https://github.com/NibrasPlatform/nibras-cli.git#v1.0.2
```

npm will overwrite the existing global link automatically.

### EEXIST / ENOTDIR errors (macOS / Linux)

These happen when a stale symlink exists from a previous install:

```bash
# Find and remove the old link
npm uninstall -g nibras 2>/dev/null || true
npm uninstall -g @nibras/cli 2>/dev/null || true

# Then reinstall
npm install -g git+https://github.com/NibrasPlatform/nibras-cli.git#v1.0.2
```

### EACCES permission error (macOS / Linux — system npm)

If npm tries to write to `/usr/local/lib` and fails, you have two choices:

1. **Switch to nvm** (recommended — no sudo ever needed): follow the nvm steps in §1.
2. Fix the global prefix as described in the _Fix npm global permissions_ step above, then re-run the install.

Do **not** use `sudo npm install -g` — it installs as root and causes further permission problems.

### Windows: `nibras` not found after install

1. Close and reopen PowerShell / Git Bash.
2. If still missing, check where npm puts global binaries:

```powershell
npm config get prefix
# Typical output: C:\Users\<you>\AppData\Roaming\npm
```

Make sure that folder is in your PATH:

```powershell
$env:PATH -split ';' | Select-String 'npm'
```

If it is not present, add it permanently:

```powershell
[Environment]::SetEnvironmentVariable(
  'Path',
  "$([Environment]::GetEnvironmentVariable('Path','User'));$(npm config get prefix)",
  'User'
)
```

Then open a new terminal.

---

## 3. Verify the Installation

```bash
nibras --version
```

Expected output (version number may differ):

```
v1.0.2-499d7f9
```

If you see `command not found` / `is not recognized`, revisit §2 for your platform.

---

## 4. Log In

Your instructor or admin will give you the **API base URL** for your school's hosted Nibras deployment.

```bash
nibras login --api-base-url https://nibras.yourschool.edu
```

The CLI will:

1. Print a short **device code** and a URL (e.g. `https://github.com/login/device`).
2. Attempt to open the URL in your browser automatically.
3. Wait while you enter the code on GitHub and authorize the app.
4. Save your session locally once authorization succeeds.

> Pass `--no-open` if you prefer to copy the URL manually:
>
> ```bash
> nibras login --api-base-url https://nibras.yourschool.edu --no-open
> ```

### Where is the session saved?

| OS      | Config path                                        |
| ------- | -------------------------------------------------- |
| macOS   | `~/Library/Application Support/nibras/config.json` |
| Linux   | `~/.config/nibras/config.json`                     |
| Windows | `%APPDATA%\nibras\config.json`                     |

### Confirm login

```bash
nibras whoami
```

This prints your GitHub username, linked account, and the active API URL. If you see `AUTH_REQUIRED`, re-run the login command.

---

## 5. Join a Course

Your instructor shares a one-time **invite link**. Open it in a browser where you are already signed into GitHub. After accepting:

- Your account is enrolled in the course.
- Course projects will become visible via `nibras setup`.

---

## 6. Set Up a Project

Your instructor gives you a **project key** (e.g. `cs161/lab1`).

```bash
nibras setup --project cs161/lab1
```

`nibras setup` will:

- Create the project directory if it does not exist.
- Write `.nibras/project.json` (manifest) and `.nibras/task.md` (instructions).
- Initialize git and set `origin` to your student repository.
- Download and extract starter files when the project provides a bundle.

### Set up in a specific directory

**macOS / Linux:**

```bash
nibras setup --project cs161/lab1 --dir ~/projects/lab1
```

**Windows PowerShell:**

```powershell
nibras setup --project cs161/lab1 --dir C:\projects\lab1
```

**Windows Git Bash:**

```bash
nibras setup --project cs161/lab1 --dir /c/projects/lab1
```

### Re-running setup

Safe to run again on an existing directory. It refreshes `.nibras` metadata without re-extracting starter files or overwriting your work.

---

## 7. Work on the Task

Read the assignment instructions at any time:

```bash
nibras task
```

The CLI prints the contents of `.nibras/task.md`. If the file is missing it fetches it from the API.

Edit your project files with any editor — VS Code, Vim, Nano, Notepad++, etc.

---

## 8. Run Local Tests

```bash
nibras test
```

Runs the test command defined in `.nibras/project.json` for your operating system. A **non-zero exit code** means the tests failed — read the output to see which tests are failing.

Run tests against the previous milestone (if supported by your project):

```bash
nibras test --previous
```

> Tests failing locally does not block submission — the CLI still records the result and submits. Fix what you can, then submit.

---

## 9. Submit Your Work

```bash
nibras submit
```

The CLI performs these steps automatically:

| Step | What happens                                                         |
| ---- | -------------------------------------------------------------------- |
| 1    | Runs the local test command and records the result                   |
| 2    | Stages only the files listed in `.nibras/project.json` (allowed set) |
| 3    | Creates a commit with a submission message                           |
| 4    | Pushes the commit to `origin`                                        |
| 5    | Registers the submission with the API                                |
| 6    | Polls for server-side verification and prints the final result       |

> **Deadline enforcement:** submissions after the milestone due date are rejected with a `VALIDATION_ERROR`. Contact your instructor if you need an extension.

> **Nothing staged?** If no allowed files have changed since the last commit, the CLI will still push and register a submission using the existing HEAD commit.

---

## 10. Check Session & Project Status

```bash
nibras whoami    # Active user, GitHub account, API base URL
nibras ping      # Full connectivity check
```

`nibras ping` verifies:

- API reachability
- Auth token validity
- GitHub account linkage
- GitHub App installation status
- Project key and `origin` remote (when run inside a project directory)

Run it first whenever something seems wrong.

---

## 11. Update & Uninstall

### Check for updates

```bash
nibras update --check
```

Compares the installed CLI version against the latest GitHub release.

### Install a specific version

```bash
nibras update --version v1.0.2
```

### Force-reinstall the same version

```bash
nibras update --force --version v1.0.2
```

### Uninstall

```bash
nibras uninstall
```

Removes the global CLI binary. Your local config (`~/.config/nibras/` etc.) is preserved. To also wipe config, delete the directory manually after uninstalling.

### Log out

```bash
nibras logout
```

Clears the saved session. Does not remove the CLI binary. Run `nibras login` again when you need a new session.

---

## 12. Troubleshooting

### Error reference

| Error code         | Cause                                                   | Fix                                                                 |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `AUTH_REQUIRED`    | Not logged in or wrong API URL saved                    | `nibras login --api-base-url <url>`                                 |
| `INVALID_SESSION`  | Token expired or revoked                                | `nibras login --api-base-url <url>`                                 |
| `NOT_FOUND`        | Wrong project key or resource missing                   | Double-check the key with your instructor                           |
| `VALIDATION_ERROR` | Invalid input, duplicate submission, or missed deadline | Read the full error message; contact instructor for deadline issues |
| `RATE_LIMITED`     | Too many requests                                       | Wait 60 seconds and retry                                           |
| `NETWORK_ERROR`    | API unreachable                                         | `nibras ping`; check VPN / firewall; verify the API URL is correct  |

---

### macOS / Linux issues

#### `command not found: nibras` after install

```bash
# Check where npm installs global binaries
npm config get prefix
# Output example: /Users/you/.nvm/versions/node/v20.x.x

# That path + /bin should already be in PATH if you use nvm.
# If not:
export PATH="$(npm config get prefix)/bin:$PATH"
# Add that line to ~/.zshrc or ~/.bashrc to make it permanent.
```

#### `EACCES: permission denied` during install

You are using a system Node.js that requires root for global installs. Do one of:

1. Switch to nvm (installs to your home directory, no sudo needed).
2. `npm config set prefix ~/.npm-global` then add `~/.npm-global/bin` to PATH.

#### Git not found

```bash
# macOS
xcode-select --install
# or
brew install git

# Ubuntu/Debian
sudo apt-get install git

# Fedora
sudo dnf install git
```

---

### Windows issues

#### `nibras : The term 'nibras' is not recognized`

1. Close and reopen PowerShell as your normal user (not Administrator).
2. Run `npm config get prefix` and verify that folder is in PATH (see §2 Windows section).
3. If using nvm-windows, confirm the active version: `nvm list` then `nvm use <version>`.

#### `execution of scripts is disabled on this system`

```powershell
# Run once in PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Git Bash path separator

Use forward slashes in Git Bash even on Windows:

```bash
nibras setup --project cs161/lab1 --dir /c/Users/yourname/projects/lab1
```

#### Line-ending warnings during `nibras setup`

If git prints `LF will be replaced by CRLF`, this is cosmetic and does not affect submission. To suppress it:

```bash
git config --global core.autocrlf input
```

#### Antivirus blocking the CLI

Windows Defender or third-party antivirus may flag `nibras.cmd` on first run. Add an exclusion for `%APPDATA%\npm\` or allow the binary through your security software.

---

### All platforms — Git issues

#### `remote: Repository not found`

`nibras setup` failed to connect to your student repository.

1. Run `nibras ping` — check GitHub linkage.
2. Ensure the GitHub App is installed on your account (the ping output will tell you).
3. Check your internet connection and GitHub status at [githubstatus.com](https://www.githubstatus.com).

#### `Push rejected` / `non-fast-forward`

Someone (or another device) pushed to your branch since your last pull.

```bash
git pull origin main --rebase
nibras submit
```

#### `fatal: not a git repository`

Run `nibras setup` first to initialize git and create the `.nibras` manifest.

---

## 13. FAQ

**Q: Do I need a GitHub account?**
Yes. Nibras uses GitHub device-flow OAuth for authentication and pushes submissions to GitHub repositories. Create a free account at [github.com](https://github.com/join).

**Q: What if I don't have the GitHub App installed?**
`nibras ping` will show `GitHub App: not installed`. Your instructor's invite link or the settings page on the Nibras web dashboard will guide you through the installation. It is required before you can submit.

**Q: Can I use WSL2 on Windows?**
Yes. Inside WSL2, follow the **Linux** prerequisites section. The CLI works identically to native Linux. Make sure your project directory is inside the WSL filesystem (e.g. `~/projects/`) rather than the Windows filesystem (`/mnt/c/...`) for best git performance.

**Q: The browser did not open during login. What do I do?**
Copy the URL printed by the CLI and paste it into any browser manually. Or add `--no-open` flag and always handle the URL yourself.

**Q: My local tests pass but the server says they failed. Why?**
The server runs tests in an isolated sandbox that mirrors a clean environment. Common causes:

- Hardcoded absolute paths (use relative paths).
- Files not in the allowed set (check `.nibras/project.json` → `allowedFiles`).
- Missing dependencies not committed.

**Q: Can I submit multiple times?**
Yes. Each `nibras submit` creates a new submission. The most recent verified submission counts for your grade. Excessive rapid submissions may trigger rate limiting.

**Q: How do I switch between multiple courses?**
The CLI stores a single active API URL. If you are enrolled in multiple courses under the same Nibras instance, use the `--project` flag with the correct course prefix (e.g. `cs161/lab1` vs `cs202/hw3`). The web dashboard supports multi-course switching from the same login.

**Q: Where are my saved tokens? Can I delete them?**
| OS | Path |
| ------- | -------------------------------------------------- |
| macOS | `~/Library/Application Support/nibras/config.json` |
| Linux | `~/.config/nibras/config.json` |
| Windows | `%APPDATA%\nibras\config.json` |

Delete the file to wipe all saved sessions (equivalent to `nibras logout`).

---

## Getting Help

1. Run `nibras ping` and share the output with your instructor — it captures most diagnostic information in one command.
2. Check [github.com/NibrasPlatform/nibras-cli/issues](https://github.com/NibrasPlatform/nibras-cli/issues) for known bugs.
3. For course-specific questions (project key, due dates, API URL), contact your instructor directly.
