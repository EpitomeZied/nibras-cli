const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  slug: "",
  submitRemote: "",
  taskUrlBase: "",
  localChecks: true,
  subjects: {},
  buildpack: {
    node: "18"
  }
};

function readJsonIfExists(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, ".nibras.json");
  const fileConfig = readJsonIfExists(configPath) || {};
  const envConfig = {
    slug: process.env.NIBRAS_SLUG || "",
    submitRemote: process.env.NIBRAS_SUBMIT_REMOTE || "",
    taskUrlBase: process.env.NIBRAS_TASK_URL_BASE || "",
    gradingRoot: process.env.NIBRAS_GRADING_ROOT || ""
  };
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    buildpack: {
      ...DEFAULT_CONFIG.buildpack,
      ...(fileConfig.buildpack || {})
    }
  };
}

function writeConfig(cwd, config) {
  const configPath = path.join(cwd, ".nibras.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = {
  loadConfig,
  writeConfig
};
