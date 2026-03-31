const fs = require("fs");
const os = require("os");
const path = require("path");
const { runCommand } = require("./exec");
const { resolveFilesToSubmit } = require("./filelist");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIntoTemp(cwd, file, tempRoot) {
  const src = path.join(cwd, file);
  const dest = path.join(tempRoot, file);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

async function runGit(args, cwd, errorMessage) {
  const result = await runCommand("git", args, { cwd });
  if (result.code !== 0) {
    throw new Error(result.stderr || errorMessage);
  }
  return result;
}

async function submit({ cwd, submissionRef, submitRemote, files }) {
  if (!submitRemote) {
    throw new Error("submitRemote is required. Set it in .nibras.json or NIBRAS_SUBMIT_REMOTE.");
  }
  if (!submissionRef) {
    throw new Error("submissionRef is required. Configure a slug or use subject/project.");
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codecraft-submit-"));
  const fileList = await resolveFilesToSubmit(cwd, files);
  if (fileList.length === 0) {
    throw new Error("No files found to submit.");
  }
  fileList.forEach((file) => copyFileIntoTemp(cwd, file, tempRoot));

  await runGit(["init"], tempRoot, "Failed to initialize temporary submission repository.");
  await runGit(["config", "user.name", "nibras"], tempRoot, "Failed to configure git user.name.");
  await runGit(["config", "user.email", "nibras@local"], tempRoot, "Failed to configure git user.email.");
  await runGit(["add", "."], tempRoot, "Failed to stage submission files.");
  await runGit(["commit", "-m", "submit"], tempRoot, "Failed to create submission commit.");

  const branch = `submit/${submissionRef}`;
  await runGit(["push", submitRemote, `HEAD:refs/heads/${branch}`], tempRoot, "Failed to push submission.");
  return { branch, files: fileList.length };
}

module.exports = { submit };
