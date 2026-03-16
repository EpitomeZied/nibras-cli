const fs = require("fs");
const path = require("path");
const { runCommand } = require("./exec");

async function downloadWithWget(url, outPath, cwd) {
  return runCommand("wget", ["-O", outPath, url], { cwd });
}

async function downloadWithCurl(url, outPath, cwd) {
  return runCommand("curl", ["-L", "-o", outPath, url], { cwd });
}

async function downloadFile(url, outPath, cwd) {
  let result = await downloadWithWget(url, outPath, cwd);
  if (result.code === 0) return result;
  result = await downloadWithCurl(url, outPath, cwd);
  return result;
}

async function unzipFile(zipPath, cwd) {
  return runCommand("unzip", [zipPath], { cwd });
}

async function setupProject({ cwd, subject, project, projectConfig, subjectConfig }) {
  const setupUrl = projectConfig.setupUrl || subjectConfig.setupUrl;
  if (!setupUrl) {
    throw new Error("setupUrl is required. Set it in .nibras.json for this project.");
  }
  const zipName = projectConfig.setupZipName || `${subject}-${project}.zip`;
  const destDir = projectConfig.setupDir || cwd;
  const destPath = path.isAbsolute(destDir) ? destDir : path.join(cwd, destDir);

  fs.mkdirSync(destPath, { recursive: true });

  const zipPath = path.join(destPath, zipName);
  const download = await downloadFile(setupUrl, zipPath, destPath);
  if (download.code !== 0) {
    throw new Error(download.stderr || "Failed to download setup zip.");
  }

  const unzip = await unzipFile(zipPath, destPath);
  if (unzip.code !== 0) {
    throw new Error(unzip.stderr || "Failed to unzip setup archive.");
  }

  fs.unlinkSync(zipPath);
  return { destPath, zipName };
}

module.exports = { setupProject };
