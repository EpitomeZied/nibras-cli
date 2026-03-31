const fs = require("fs");
const path = require("path");

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch task (${res.status}).`);
  }
  return res.text();
}

async function loadTask({ cwd, slug, taskUrlBase, file, taskUrl }) {
  if (file) {
    const taskPath = path.isAbsolute(file) ? file : path.join(cwd, file);
    return fs.readFileSync(taskPath, "utf8");
  }

  if (taskUrl) {
    return fetchText(taskUrl);
  }

  if (!taskUrlBase) {
    throw new Error("taskUrlBase is required. Set it in .nibras.json or NIBRAS_TASK_URL_BASE.");
  }
  if (!slug) {
    throw new Error("slug is required. Set it in .nibras.json or NIBRAS_SLUG.");
  }
  const url = `${taskUrlBase.replace(/\/$/, "")}/${slug}`;
  return fetchText(url);
}

module.exports = { loadTask };
