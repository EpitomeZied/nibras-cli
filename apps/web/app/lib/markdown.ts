/**
 * Lightweight inline markdown → HTML renderer used by ChatPanel and community
 * post bodies. Handles fenced code blocks, inline code, bold/italic/strike,
 * links, and headings. NOT a full markdown spec — just enough for tutor
 * answers and Q&A posts, matching the dashboard's behavior.
 *
 * The output is escaped HTML, so it's safe to feed into
 * `dangerouslySetInnerHTML` for read-only display.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  // Strike
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // Links [label](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Bare URLs
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)(?=[\s).,!?]|$)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );
  return out;
}

export function renderMarkdown(source: string): string {
  if (!source) return '';
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length + 2; // h3..h5
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // List
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push(`<li>${renderInline(itemText)}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph (collect consecutive non-blank, non-special lines)
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^(#{1,3}|\s*[-*])\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${renderInline(para.join('\n'))}</p>`);
  }

  return blocks.join('');
}
