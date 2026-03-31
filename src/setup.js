const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");
const { runCommand } = require("./exec");

async function downloadWithWget(url, outPath, cwd) {
  return runCommand("wget", ["-O", outPath, url], { cwd });
}

async function downloadWithCurl(url, outPath, cwd) {
  return runCommand("curl", ["-f", "-L", "-o", outPath, url], { cwd });
}

async function downloadFile(url, outPath, cwd) {
  try {
    const result = await downloadWithWget(url, outPath, cwd);
    if (result.code === 0) return result;
  } catch (err) {
    if (!err || err.code !== "ENOENT") {
      throw err;
    }
  }

  try {
    const result = await downloadWithCurl(url, outPath, cwd);
    return result;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw new Error("Neither wget nor curl is available. Install one to use setup.");
    }
    throw err;
  }
}

async function unzipFile(zipPath, cwd) {
  return runCommand("unzip", ["-o", zipPath], { cwd });
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isFileUrl(value) {
  return /^file:\/\//i.test(value);
}

function resolveLocalPath(setupUrl, cwd) {
  if (isFileUrl(setupUrl)) {
    return fileURLToPath(setupUrl);
  }
  if (!isHttpUrl(setupUrl)) {
    return path.isAbsolute(setupUrl) ? setupUrl : path.join(cwd, setupUrl);
  }
  return null;
}

function isZipFile(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buffer, 0, 4, 0);
    if (bytesRead < 4) return false;
    const signature = buffer.toString("binary");
    return (
      signature === "PK\x03\x04" ||
      signature === "PK\x05\x06" ||
      signature === "PK\x07\x08"
    );
  } finally {
    fs.closeSync(fd);
  }
}

function readFileSnippet(filePath, maxChars = 160) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.replace(/\s+/g, " ").trim().slice(0, maxChars);
  } catch (err) {
    return "";
  }
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
  const localPath = resolveLocalPath(setupUrl, cwd);
  let shouldDeleteZip = true;
  if (localPath) {
    if (!fs.existsSync(localPath)) {
      throw new Error(`setupUrl points to a local file that doesn't exist: ${localPath}`);
    }
    if (path.resolve(localPath) !== path.resolve(zipPath)) {
      fs.copyFileSync(localPath, zipPath);
    } else {
      shouldDeleteZip = false;
    }
  } else {
    const download = await downloadFile(setupUrl, zipPath, destPath);
    if (download.code !== 0) {
      throw new Error(download.stderr || "Failed to download setup zip.");
    }
  }

  if (!isZipFile(zipPath)) {
    const snippet = readFileSnippet(zipPath);
    const hint = snippet ? ` First bytes: ${snippet}` : "";
    throw new Error(`Downloaded file is not a zip. Check setupUrl (${setupUrl}).${hint}`);
  }

  const unzip = await unzipFile(zipPath, destPath);
  if (unzip.code !== 0) {
    throw new Error(unzip.stderr || "Failed to unzip setup archive.");
  }

  if (shouldDeleteZip) {
    fs.unlinkSync(zipPath);
  }
  return { destPath, zipName };
}

module.exports = { setupProject };
