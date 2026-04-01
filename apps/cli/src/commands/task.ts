import fs from 'node:fs';
import path from 'node:path';
import { ProjectTaskResponseSchema } from '@nibras/contracts';
import { apiRequest, loadProjectManifest, writeTaskText } from '@nibras/core';
import picocolors from 'picocolors';

function renderMarkdownLine(line: string, plain: boolean): string {
  if (plain) return line;

  // h2 headings
  if (line.startsWith('## ')) {
    return picocolors.bold(picocolors.cyan(line));
  }
  // h1 headings
  if (line.startsWith('# ')) {
    return picocolors.bold(picocolors.white(line));
  }
  // Code fences
  if (line.startsWith('```')) {
    return picocolors.dim(line);
  }
  // Bold **text**
  return line.replace(/\*\*(.+?)\*\*/g, (_, inner: string) =>
    picocolors.bold(inner)
  );
}

export async function commandTask(plain: boolean): Promise<void> {
  const { projectRoot, manifest } = loadProjectManifest(process.cwd());
  const taskPath = path.join(projectRoot, '.nibras', 'task.md');

  let text: string;
  if (fs.existsSync(taskPath)) {
    text = fs.readFileSync(taskPath, 'utf8');
  } else {
    const task = ProjectTaskResponseSchema.parse(
      await apiRequest(`/v1/projects/${encodeURIComponent(manifest.projectKey)}/task`)
    );
    writeTaskText(projectRoot, task.task);
    text = task.task;
  }

  const lines = text.split('\n').map((l) => renderMarkdownLine(l, plain));
  console.log('\n' + lines.join('\n'));
}
