const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { buildApp } = require('../apps/api/dist/app');
const { FileStore } = require('../apps/api/dist/store');

const repoRoot = path.resolve(__dirname, '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nibras-modern-'));
}

function commandExists(command) {
  return spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

async function startApi(storePath) {
  const previousStore = process.env.NIBRAS_API_STORE;
  process.env.NIBRAS_API_STORE = storePath;
  const app = buildApp(new FileStore(storePath));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const apiBaseUrl = `http://127.0.0.1:${address.port}`;
  return {
    apiBaseUrl,
    close: async () => {
      await app.close();
      if (previousStore === undefined) {
        delete process.env.NIBRAS_API_STORE;
      } else {
        process.env.NIBRAS_API_STORE = previousStore;
      }
    },
  };
}

async function createSession(apiBaseUrl) {
  const started = await fetch(`${apiBaseUrl}/v1/device/start`, {
    method: 'POST',
  }).then((response) => response.json());
  await fetch(started.verificationUriComplete);
  const polled = await fetch(`${apiBaseUrl}/v1/device/poll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: started.deviceCode }),
  }).then((response) => response.json());
  return polled;
}

function writeCliConfig(configRoot, apiBaseUrl, session) {
  const configDir = path.join(configRoot, 'nibras');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify(
      {
        apiBaseUrl,
        activeUserId: session.user.id,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
      null,
      2
    )
  );
}

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(repoRoot, 'bin', 'nibras.js'), ...args], {
      cwd: options.cwd || repoRoot,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });
}

test('modern CLI help renders the new command surface', async () => {
  const result = await runCli(['--plain']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CLI to interact with Nibras/);
  assert.match(result.stdout, /login\s/);
  assert.match(result.stdout, /update\s/);
  assert.match(result.stdout, /legacy\s/);
});

test('modern CLI update reinstalls the requested tagged release', async () => {
  const tmp = makeTempDir();
  const fakeBin = path.join(tmp, 'bin');
  const fakeNpm = path.join(fakeBin, 'npm');
  const npmLog = path.join(tmp, 'npm.log');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(
    fakeNpm,
    `#!/bin/sh
set -eu
{
  printf '%s\\n' "$@"
  printf '%s\\n' '---'
} >> "$NIBRAS_TEST_NPM_LOG"
exit 0
`
  );
  fs.chmodSync(fakeNpm, 0o755);

  const result = await runCli(['update', '--version', 'v1.0.1', '--plain'], {
    env: {
      PATH: `${fakeBin}:${process.env.PATH}`,
      NIBRAS_TEST_NPM_LOG: npmLog,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[SUCCESS\] CLI updated/);
  const npmCalls = fs.readFileSync(npmLog, 'utf8');
  assert.match(npmCalls, /uninstall\n-g\nnibras\n@nibras\/cli\n---/);
  assert.match(
    npmCalls,
    /install\n-g\ngit\+https:\/\/github\.com\/NibrasPlatform\/nibras-cli\.git#v1\.0\.1\n---/
  );
});

test('API uses forwarded host and protocol when building public URLs', async () => {
  const app = buildApp(new FileStore(path.join(makeTempDir(), 'store.json')));
  try {
    const started = await app.inject({
      method: 'POST',
      url: '/v1/device/start',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'nondefined-gustavo-languidly.ngrok-free.dev',
      },
    });
    assert.equal(started.statusCode, 200);
    const payload = started.json();
    assert.equal(
      payload.verificationUri,
      'https://nondefined-gustavo-languidly.ngrok-free.dev/dev/approve'
    );
    assert.match(
      payload.verificationUriComplete,
      /^https:\/\/nondefined-gustavo-languidly\.ngrok-free\.dev\/dev\/approve\?user_code=/
    );
  } finally {
    await app.close();
  }
});

test('modern CLI setup bootstraps a local project from the API', async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const server = await startApi(path.join(tmp, 'store.json'));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const projectDir = path.join(tmp, 'project');
    const result = await runCli(
      ['setup', '--project', 'cs161/exam1', '--dir', projectDir, '--plain'],
      {
        env: { XDG_CONFIG_HOME: configRoot },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Project: cs161\/exam1/);
    assert.ok(fs.existsSync(path.join(projectDir, '.nibras', 'project.json')));
    assert.ok(fs.existsSync(path.join(projectDir, '.nibras', 'task.md')));
  } finally {
    await server.close();
  }
});

test('modern CLI setup downloads and extracts the CS106L starter bundle', async (t) => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const server = await startApi(path.join(tmp, 'store.json'));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const projectDir = path.join(tmp, 'gapbuffer');
    const result = await runCli(
      ['setup', '--project', 'cs106l/gapbuffer', '--dir', projectDir, '--plain'],
      {
        env: { XDG_CONFIG_HOME: configRoot },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(projectDir, 'gap_buffer.h')));
    const manifest = JSON.parse(
      fs.readFileSync(path.join(projectDir, '.nibras', 'project.json'), 'utf8')
    );
    assert.equal(manifest.projectKey, 'cs106l/gapbuffer');
    assert.equal(manifest.test.mode, 'command');
    assert.equal(
      manifest.test.command,
      'cmake -S . -B build && cmake --build build && ctest --test-dir build --output-on-failure'
    );

    if (!commandExists('cmake')) {
      t.skip('cmake is required to verify the seeded CS106L command locally');
      return;
    }

    const testRun = await runCli(['test', '--plain'], {
      cwd: projectDir,
      env: { XDG_CONFIG_HOME: configRoot },
    });
    assert.notEqual(testRun.status, 0, testRun.stderr || testRun.stdout);
  } finally {
    await server.close();
  }
});

test('bundle-backed setup creates an initial git commit and pushes when a remote exists', async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const storePath = path.join(tmp, 'store.json');
  const server = await startApi(storePath);
  try {
    const store = new FileStore(storePath);
    const seeded = store.read(server.apiBaseUrl);
    const remote = path.join(tmp, 'remote.git');
    assert.equal(spawnSync('git', ['init', '--bare', remote], { encoding: 'utf8' }).status, 0);
    const project = seeded.projects.find((entry) => entry.projectKey === 'cs106l/hashmap');
    project.repoByUserId.user_demo = {
      owner: 'demo-user',
      name: 'nibras-cs106l-hashmap',
      cloneUrl: remote,
      defaultBranch: 'main',
      visibility: 'private',
    };
    store.write(seeded);

    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const projectDir = path.join(tmp, 'hashmap');
    const result = await runCli(
      ['setup', '--project', 'cs106l/hashmap', '--dir', projectDir, '--plain'],
      {
        env: { XDG_CONFIG_HOME: configRoot },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: projectDir, encoding: 'utf8' });
    assert.equal(head.status, 0, head.stderr);
    assert.match(head.stdout, /^[0-9a-f]{40}\n$/);

    const remoteHead = spawnSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], {
      encoding: 'utf8',
    });
    assert.equal(remoteHead.status, 0, remoteHead.stderr);
    assert.match(remoteHead.stdout, /^[0-9a-f]{40}\n$/);
  } finally {
    await server.close();
  }
});

test('bundle-backed setup auto-creates the GitHub repo via gh when API provisioning falls back', async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const storePath = path.join(tmp, 'store.json');
  const server = await startApi(storePath);
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const fakeBin = path.join(tmp, 'bin');
    const fakeGh = path.join(fakeBin, 'gh');
    const remote = path.join(tmp, 'remote.git');
    const ghLog = path.join(tmp, 'gh.log');
    fs.mkdirSync(fakeBin, { recursive: true });
    fs.writeFileSync(
      fakeGh,
      `#!/bin/sh
set -eu
printf '%s\\n' "$@" > "$NIBRAS_TEST_GH_LOG"
source_dir=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      shift
      source_dir="$1"
      ;;
  esac
  shift
done
git init --bare "$NIBRAS_TEST_GH_REMOTE_DIR" >/dev/null 2>&1
git -C "$source_dir" remote set-url origin "$NIBRAS_TEST_GH_REMOTE_DIR"
git -C "$source_dir" push -u origin main >/dev/null 2>&1
`
    );
    fs.chmodSync(fakeGh, 0o755);

    const projectDir = path.join(tmp, 'gapbuffer');
    const result = await runCli(
      ['setup', '--project', 'cs106l/gapbuffer', '--dir', projectDir, '--plain'],
      {
        env: {
          XDG_CONFIG_HOME: configRoot,
          PATH: `${fakeBin}:${process.env.PATH}`,
          NIBRAS_TEST_GH_REMOTE_DIR: remote,
          NIBRAS_TEST_GH_LOG: ghLog,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(ghLog));
    const ghArgs = fs.readFileSync(ghLog, 'utf8');
    assert.match(ghArgs, /^repo\ncreate\n/);

    const remoteHead = spawnSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], {
      encoding: 'utf8',
    });
    assert.equal(remoteHead.status, 0, remoteHead.stderr);
    assert.match(remoteHead.stdout, /^[0-9a-f]{40}\n$/);
  } finally {
    await server.close();
  }
});

test('modern CLI whoami and ping use the hosted auth/session flow', async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const server = await startApi(path.join(tmp, 'store.json'));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const whoami = await runCli(['whoami', '--plain'], {
      env: { XDG_CONFIG_HOME: configRoot },
    });
    assert.equal(whoami.status, 0, whoami.stderr);
    assert.match(whoami.stdout, /User:\s+demo/);
    assert.match(whoami.stdout, /GitHub:\s+demo-user/);

    const ping = await runCli(['ping', '--plain'], {
      env: { XDG_CONFIG_HOME: configRoot },
    });
    assert.equal(ping.status, 0, ping.stderr);
    assert.match(ping.stdout, /API: reachable/);
    assert.match(ping.stdout, /Auth: valid/);
  } finally {
    await server.close();
  }
});

test('modern CLI submit commits, pushes, and waits for verification', async () => {
  const tmp = makeTempDir();
  const configRoot = path.join(tmp, 'config');
  const server = await startApi(path.join(tmp, 'store.json'));
  try {
    const session = await createSession(server.apiBaseUrl);
    writeCliConfig(configRoot, server.apiBaseUrl, session);

    const remote = path.join(tmp, 'remote.git');
    const projectDir = path.join(tmp, 'project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, '.nibras'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'answers'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, '.nibras', 'project.json'),
      JSON.stringify(
        {
          projectKey: 'cs161/exam1',
          releaseVersion: '2026-03-01',
          apiBaseUrl: server.apiBaseUrl,
          defaultBranch: 'main',
          buildpack: { node: '20' },
          test: {
            mode: 'public-grading',
            command: 'node -e "process.exit(0)"',
            supportsPrevious: true,
          },
          submission: {
            allowedPaths: ['answers/**', '.nibras/**'],
            waitForVerificationSeconds: 10,
          },
        },
        null,
        2
      )
    );
    fs.writeFileSync(path.join(projectDir, '.nibras', 'task.md'), '# Task\n');
    fs.writeFileSync(path.join(projectDir, 'answers', 'q1.txt'), 'initial\n');

    assert.equal(spawnSync('git', ['init', '--bare', remote], { encoding: 'utf8' }).status, 0);
    assert.equal(
      spawnSync('git', ['init', '-b', 'main'], { cwd: projectDir, encoding: 'utf8' }).status,
      0
    );
    assert.equal(spawnSync('git', ['add', '.'], { cwd: projectDir, encoding: 'utf8' }).status, 0);
    assert.equal(
      spawnSync('git', ['config', 'user.name', 'tester'], { cwd: projectDir, encoding: 'utf8' })
        .status,
      0
    );
    assert.equal(
      spawnSync('git', ['config', 'user.email', 'tester@example.com'], {
        cwd: projectDir,
        encoding: 'utf8',
      }).status,
      0
    );
    assert.equal(
      spawnSync('git', ['commit', '-m', 'init'], { cwd: projectDir, encoding: 'utf8' }).status,
      0
    );
    assert.equal(
      spawnSync('git', ['remote', 'add', 'origin', remote], { cwd: projectDir, encoding: 'utf8' })
        .status,
      0
    );
    assert.equal(
      spawnSync('git', ['push', '-u', 'origin', 'main'], { cwd: projectDir, encoding: 'utf8' })
        .status,
      0
    );

    fs.writeFileSync(path.join(projectDir, 'answers', 'q1.txt'), 'updated answer\n');

    const result = await runCli(['submit', '--plain'], {
      cwd: projectDir,
      env: { XDG_CONFIG_HOME: configRoot },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Submission passed/);
    assert.match(result.stdout, /Summary:.*Verification passed\./);

    const remoteHead = spawnSync('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/main'], {
      encoding: 'utf8',
    });
    assert.equal(remoteHead.status, 0);
    assert.match(remoteHead.stdout, /^[0-9a-f]{40}\n$/);
  } finally {
    await server.close();
  }
});
