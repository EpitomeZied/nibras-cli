import fs from "node:fs";
import path from "node:path";
import { ProjectManifest, ProjectManifestSchema } from "@nibras/contracts";

export function findProjectRoot(startCwd: string): string | null {
  let current = path.resolve(startCwd);
  while (true) {
    const manifestPath = path.join(current, ".nibras", "project.json");
    if (fs.existsSync(manifestPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function getManifestPath(projectRoot: string): string {
  return path.join(projectRoot, ".nibras", "project.json");
}

export function getTaskPath(projectRoot: string): string {
  return path.join(projectRoot, ".nibras", "task.md");
}

export function loadProjectManifest(cwd: string): { projectRoot: string; manifest: ProjectManifest; manifestPath: string } {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    throw new Error("No .nibras/project.json found in this directory or any parent directory.");
  }
  const manifestPath = getManifestPath(projectRoot);
  const raw = fs.readFileSync(manifestPath, "utf8");
  return {
    projectRoot,
    manifestPath,
    manifest: ProjectManifestSchema.parse(JSON.parse(raw))
  };
}

export function writeProjectManifest(projectRoot: string, manifest: ProjectManifest): string {
  const manifestPath = getManifestPath(projectRoot);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(ProjectManifestSchema.parse(manifest), null, 2)}\n`);
  return manifestPath;
}

export function writeTaskText(projectRoot: string, taskText: string): string {
  const taskPath = getTaskPath(projectRoot);
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  fs.writeFileSync(taskPath, taskText);
  return taskPath;
}
