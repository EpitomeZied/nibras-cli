const path = require("path");

function resolveNearestDefined(...values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function resolveProjectPath(cwd, projectPathOrId) {
  return path.isAbsolute(projectPathOrId) ? projectPathOrId : path.join(cwd, projectPathOrId);
}

function resolveRelativeToProjectOrAbsolute(cwd, projectPathOrId, filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(resolveProjectPath(cwd, projectPathOrId), filePath);
}

function resolveRelativeToCwdOrAbsolute(cwd, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}

module.exports = {
  resolveNearestDefined,
  resolveProjectPath,
  resolveRelativeToProjectOrAbsolute,
  resolveRelativeToCwdOrAbsolute
};
