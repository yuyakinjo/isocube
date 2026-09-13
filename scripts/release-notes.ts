import { execFileSync, spawnSync } from 'node:child_process';

export interface Commit {
  subject: string;
  body: string;
}

export function releaseNotes(commits: readonly Commit[]): string {
  const breaking = commits.flatMap(({ subject, body }) => {
    const description = /^BREAKING[ -]CHANGE:\s*(.+)$/im.exec(body)?.[1]
      ?? /^\w+(?:\([^)]*\))?!:\s*(.+)$/.exec(subject)?.[1];
    return description ? [description.trim()] : [];
  });
  const sections = [];
  if (breaking.length) {
    sections.push([
      '## Breaking changes', '',
      'Version numbers are dates and do not indicate compatibility. Read this before upgrading.', '',
      ...breaking.map((description) => `- ${description}`),
    ].join('\n'));
  }
  sections.push(['## Changes', '', ...commits.map(({ subject }) => `- ${subject}`)].join('\n'));
  return `${sections.join('\n\n')}\n`;
}

export function parseLog(log: string): Commit[] {
  return log.split('\0').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [subject = '', ...body] = entry.split('\n');
    return { subject, body: body.join('\n').trim() };
  });
}

if (import.meta.main) {
  const described = spawnSync('git', ['describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0'], { encoding: 'utf8' });
  const range = described.status === 0 ? `${described.stdout.trim()}..HEAD` : 'HEAD';
  const log = execFileSync('git', ['log', range, '--format=%B%x00'], { encoding: 'utf8' });
  process.stdout.write(releaseNotes(parseLog(log)));
}
