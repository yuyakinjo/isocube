import { generateLogo } from '../src/index.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = element<HTMLFormElement>('logo-form');
const text = element<HTMLTextAreaElement>('text');
const breaks = element<HTMLInputElement>('break-at');
const colors = element<HTMLInputElement>('colors');
const filename = element<HTMLInputElement>('filename');
const error = element<HTMLParagraphElement>('error');
const status = element<HTMLSpanElement>('status');
const download = element<HTMLButtonElement>('download');
const preview = element<HTMLDivElement>('preview');
const image = element<HTMLImageElement>('logo-image');
let output: { url: string; filename: string } | undefined;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

function updateCommand() {
  const args = ['npx isocube', '--text', quote(text.value)];
  if (breaks.value.trim()) args.push('--break-at', quote(breaks.value.trim()));
  if (colors.value.trim()) args.push('--colors', quote(colors.value.trim()));
  args.push('--out', quote(filename.value));
  element('command').textContent = args.join(' ');
}

function invalidate() {
  if (output) URL.revokeObjectURL(output.url);
  output = undefined;
  download.disabled = true;
  image.hidden = true;
  image.removeAttribute('src');
  element('empty').hidden = false;
  status.textContent = 'Not generated';
  element('result-label').textContent = 'READY WHEN YOU ARE';
  element('result-detail').textContent = 'Your SVG will have a transparent background.';
  error.hidden = true;
  updateCommand();
}

form.addEventListener('input', invalidate);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  invalidate();
  try {
    if (!filename.value || !/^[^/\\]+\.svg$/i.test(filename.value)) {
      throw new Error('Enter a file name ending in .svg, without a folder path.');
    }
    const result = generateLogo({
      text: text.value,
      breakAt: breaks.value.trim() ? breaks.value.split(',').map(Number) : undefined,
      colors: colors.value.trim() ? colors.value.split(/,(?![^()]*\))/) : undefined,
    });
    const blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' });
    output = { url: URL.createObjectURL(blob), filename: filename.value };
    image.src = output.url;
    image.alt = `${result.lines.join(' / ')} block logo`;
    image.hidden = false;
    element('empty').hidden = true;
    status.textContent = 'Generated';
    element('result-label').textContent = output.filename;
    element('result-detail').textContent = `${result.lines.length} ${result.lines.length === 1 ? 'row' : 'rows'} · ${(blob.size / 1024).toFixed(1)} KB · Transparent SVG`;
    // Include the resolved random palette so the command reproduces this exact SVG.
    element('command').textContent = `npx isocube --text ${quote(text.value)}${breaks.value.trim() ? ` --break-at ${quote(breaks.value.trim())}` : ''} --colors ${quote(result.colors.join(','))} --out ${quote(filename.value)}`;
    download.disabled = false;
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.hidden = false;
    status.textContent = 'Check your input';
  }
});

download.addEventListener('click', () => {
  if (!output) return;
  const link = document.createElement('a');
  link.href = output.url;
  link.download = output.filename;
  document.body.append(link);
  link.click();
  link.remove();
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-palette]')) {
  button.addEventListener('click', () => {
    colors.value = button.dataset.palette ?? '';
    invalidate();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-background]')) {
  button.addEventListener('click', () => {
    preview.dataset.background = button.dataset.background;
    for (const sibling of document.querySelectorAll('button[data-background]')) {
      sibling.setAttribute('aria-pressed', String(sibling === button));
    }
  });
}
updateCommand();
