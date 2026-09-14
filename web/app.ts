import './theme.js';
import { animate, createTimeline, stagger, svg, utils } from 'animejs';

import { generateLogo } from '../src/index.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// createDrawable measures every path, so very long logos fade in as a whole instead.
const DRAW_LIMIT = 400;

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const form = element<HTMLFormElement>('logo-form');
const text = element<HTMLTextAreaElement>('text');
const reverse = element<HTMLInputElement>('reverse');
const breaks = element<HTMLInputElement>('break-at');
const colors = element<HTMLInputElement>('colors');
const filename = element<HTMLInputElement>('filename');
const error = element<HTMLParagraphElement>('error');
const status = element<HTMLSpanElement>('status');
const download = element<HTMLButtonElement>('download');
const preview = element<HTMLDivElement>('preview');
const stage = element<HTMLDivElement>('logo-stage');
let output: { url: string; filename: string } | undefined;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
let logoAnimation: ReturnType<typeof createTimeline> | undefined;

const parseSvg = (markup: string) =>
  document.createRange().createContextualFragment(markup).querySelector('svg')!;

// Draw the outlines stroke by stroke, then let each block's color catch up.
function playLogoAnimation(root: SVGSVGElement) {
  const shapes = root.querySelectorAll('path');
  if (reducedMotion.matches) return;
  if (shapes.length > DRAW_LIMIT) {
    logoAnimation = createTimeline().add(root, {
      opacity: [0, 1],
      duration: 400,
      ease: 'outQuad',
    });
    return;
  }
  const step = Math.min(24, 900 / shapes.length);
  utils.set(shapes, { fillOpacity: 0 });
  logoAnimation = createTimeline()
    .add(
      svg.createDrawable(shapes),
      {
        draw: ['0 0', '0 1'],
        duration: 620,
        ease: 'inOutQuad',
        delay: stagger(step),
      },
      0
    )
    .add(
      shapes,
      {
        fillOpacity: [0, 1],
        duration: 460,
        ease: 'outQuad',
        delay: stagger(step),
      },
      240
    );
}

function updateCommand() {
  const args = ['npx isocube', '--text', quote(text.value)];
  if (reverse.checked) args.push('--reverse');
  if (breaks.value.trim()) args.push('--break-at', quote(breaks.value.trim()));
  if (colors.value.trim()) args.push('--colors', quote(colors.value.trim()));
  args.push('--out', quote(filename.value));
  element('command').textContent = args.join(' ');
}

function invalidate() {
  if (output) URL.revokeObjectURL(output.url);
  output = undefined;
  download.disabled = true;
  logoAnimation?.revert();
  logoAnimation = undefined;
  stage.hidden = true;
  stage.replaceChildren();
  element('empty').hidden = false;
  status.textContent = 'Not generated';
  element('result-label').textContent = 'READY WHEN YOU ARE';
  element('result-detail').textContent =
    'Your SVG will have a transparent background.';
  error.hidden = true;
  updateCommand();
}

form.addEventListener('input', invalidate);
reverse.addEventListener('change', () => form.requestSubmit());
form.addEventListener('submit', (event) => {
  event.preventDefault();
  invalidate();
  try {
    if (!filename.value || !/^[^/\\]+\.svg$/i.test(filename.value)) {
      throw new Error(
        'Enter a file name ending in .svg, without a folder path.'
      );
    }
    const result = generateLogo({
      text: text.value,
      reverse: reverse.checked,
      breakAt: breaks.value.trim()
        ? breaks.value.split(',').map(Number)
        : undefined,
      colors: colors.value.trim()
        ? colors.value.split(/,(?![^()]*\))/)
        : undefined,
    });
    const blob = new Blob([result.svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    output = { url: URL.createObjectURL(blob), filename: filename.value };
    const drawing = parseSvg(result.svg);
    stage.replaceChildren(drawing);
    stage.hidden = false;
    playLogoAnimation(drawing);
    element('empty').hidden = true;
    status.textContent = 'Generated';
    element('result-label').textContent = output.filename;
    element('result-detail').textContent =
      `${result.lines.length} ${result.lines.length === 1 ? 'row' : 'rows'} · ${(blob.size / 1024).toFixed(1)} KB · Transparent SVG`;
    // Include the resolved random palette so the command reproduces this exact SVG.
    element('command').textContent =
      `npx isocube --text ${quote(text.value)}${reverse.checked ? ' --reverse' : ''}${breaks.value.trim() ? ` --break-at ${quote(breaks.value.trim())}` : ''} --colors ${quote(result.colors.join(','))} --out ${quote(filename.value)}`;
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

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-palette]'
)) {
  button.addEventListener('click', () => {
    colors.value = button.dataset.palette ?? '';
    form.requestSubmit();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-background]'
)) {
  button.addEventListener('click', () => {
    preview.dataset.background = button.dataset.background;
    for (const sibling of document.querySelectorAll(
      'button[data-background]'
    )) {
      sibling.setAttribute('aria-pressed', String(sibling === button));
    }
  });
}
updateCommand();

// A short entrance so the hero settles into place instead of snapping in.
if (!reducedMotion.matches) {
  animate('.hero > *', {
    opacity: [0, 1],
    y: [14, 0],
    duration: 620,
    ease: 'outQuad',
    delay: stagger(90),
  });
  animate('.brand-mark', {
    opacity: [0, 1],
    scale: [0.94, 1],
    duration: 520,
    ease: 'outBack',
  });
}
