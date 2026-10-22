import './theme.js';
import { CHARACTERS } from '../src/glyphs.js';
import {
  generateLogo,
  getDefaultGlyphs,
  parseGlyphConfig,
  serializeGlyphConfig,
} from '../src/index.js';
import type { Glyph, GlyphConfig } from '../src/index.js';

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let baseline = getDefaultGlyphs();
let draft = getDefaultGlyphs();
let selected = 'A';
let valid = true;
let saving = false;
let local = false;
const form = element<HTMLFormElement>('glyph-form');
const fields = element('glyph-fields');
const error = element('editor-error');
const save = element<HTMLButtonElement>('save-source');
const download = element<HTMLButtonElement>('export-config');
const sample = element<HTMLInputElement>('sample-text');
const status = element('save-status');
const reset = element<HTMLButtonElement>('reset-all');
let syncNumberFields: (() => void)[] = [];
const original = () => serializeGlyphConfig(baseline);
const changedLetters = () =>
  [...CHARACTERS].filter(
    (letter) =>
      JSON.stringify(draft[letter]) !== JSON.stringify(baseline[letter])
  );
const letterName = (letter: string) => (letter === ' ' ? 'Space' : letter);

function showError(cause?: unknown) {
  error.hidden = cause === undefined;
  error.textContent =
    cause instanceof Error ? cause.message : String(cause ?? '');
}

function renderLogo(id: string, text: string, glyphs: GlyphConfig) {
  const markup = generateLogo({
    text,
    glyphs,
    colors: ['#B429F9', '#0284C7', '#F20089'],
  }).svg;
  const fragment = document.createRange().createContextualFragment(markup);
  const svg = fragment.querySelector('svg')!;
  const title = svg.querySelector('title')!;
  title.id = `${id}-title`;
  svg.setAttribute('aria-labelledby', title.id);
  element(id).replaceChildren(fragment);
}

function renderContext() {
  try {
    renderLogo('context-preview', sample.value, draft);
    sample.setCustomValidity('');
  } catch {
    element('context-preview').replaceChildren();
    sample.setCustomValidity('A–Z、0–9、半角スペースを入力してください。');
    sample.reportValidity();
  }
}

function refresh() {
  for (const sync of syncNumberFields) sync();
  const changed = changedLetters();
  for (const button of element('letter-picker').querySelectorAll('button')) {
    const letter = button.dataset.letter!;
    button.setAttribute('aria-pressed', String(letter === selected));
    button.classList.toggle('modified', changed.includes(letter));
    button.title = `${letterName(letter)}${changed.includes(letter) ? ' — 変更あり' : ''}`;
  }
  element('edit-status').textContent = changed.length
    ? `${changed.map(letterName).join(', ')} に変更あり`
    : '変更なし';
  renderLogo('before-preview', selected, baseline);
  try {
    parseGlyphConfig(draft);
    valid = true;
    showError();
    renderLogo('after-preview', selected, draft);
    renderContext();
  } catch (cause) {
    valid = false;
    showError(cause);
    element('after-preview').replaceChildren();
    element('context-preview').replaceChildren();
  }
  save.disabled = saving || !valid || changed.length === 0;
  download.disabled = !valid || changed.length === 0;
  reset.disabled = changed.length === 0 || saving;
}

function numberField(
  parent: HTMLElement,
  label: string,
  value: number,
  max: number | (() => number),
  update: (value: number) => void,
  min = 0
) {
  const wrapper = document.createElement('div');
  wrapper.className = 'number-field';
  const caption = document.createElement('label');
  caption.textContent = label;
  const input = document.createElement('input');
  input.id = `glyph-number-${syncNumberFields.length}`;
  caption.htmlFor = input.id;
  input.type = 'number';
  input.step = '0.1';
  input.min = String(min);
  input.value = String(value);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.step = input.step;
  slider.min = input.min;
  slider.setAttribute('aria-label', `${label} スライダー`);
  syncNumberFields.push(() => {
    input.max = slider.max = String(typeof max === 'function' ? max() : max);
    if (Number.isFinite(input.valueAsNumber)) slider.value = input.value;
  });
  const apply = () => {
    update(input.valueAsNumber);
    status.textContent = '';
    refresh();
  };
  input.addEventListener('input', () => {
    if (!Number.isFinite(input.valueAsNumber)) {
      valid = false;
      showError(new Error('座標と幅には数値を入力してください。'));
      save.disabled = download.disabled = true;
      return;
    }
    apply();
  });
  slider.addEventListener('input', () => {
    input.value = slider.value;
    apply();
  });
  wrapper.append(caption, input, slider);
  parent.append(wrapper);
}

function group(title: string) {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  fieldset.append(legend);
  fields.append(fieldset);
  return fieldset;
}

function selectLetter(letter: string) {
  selected = letter;
  fields.replaceChildren();
  syncNumberFields = [];
  element('selected-letter').textContent = letterName(letter);
  const glyph = draft[letter]!;
  numberField(
    group('幅'),
    '幅',
    glyph.width ?? 100,
    240,
    (value) => {
      if (
        value === (baseline[letter]?.width ?? 100) &&
        baseline[letter]?.width === undefined
      )
        delete glyph.width;
      else glyph.width = value;
    },
    20
  );
  if (glyph.outline) {
    const outline = group('輪郭の頂点');
    glyph.outline.forEach((point, index) => {
      const row = document.createElement('div');
      row.className = 'coordinate-row';
      numberField(
        row,
        `${index + 1} · X`,
        point[0],
        () => glyph.width ?? 100,
        (value) => {
          point[0] = value;
        }
      );
      numberField(row, `${index + 1} · Y`, point[1], 140, (value) => {
        point[1] = value;
      });
      outline.append(row);
    });
  } else if (letter !== ' ') {
    const hint = document.createElement('p');
    hint.className = 'help';
    hint.textContent =
      '輪郭は幅 × 140 の長方形です。Dの直後では接合部分が自動で調整されます。';
    fields.append(hint);
    const customize = document.createElement('button');
    customize.type = 'button';
    customize.className = 'editor-button';
    customize.textContent = '輪郭を個別に調整';
    customize.addEventListener('click', () => {
      const width = glyph.width ?? 100;
      glyph.outline = [
        [0, 0],
        [width, 0],
        [width, 140],
        [0, 140],
      ];
      selectLetter(selected);
    });
    fields.append(customize);
  }
  if (glyph.marks) {
    const marks = group('切れ込みの座標');
    const tokens = glyph.marks.match(/[MLHV]|\d+(?:\.\d+)?| +/g)!;
    let axis = 'X';
    let command = '';
    let segment = 0;
    tokens.forEach((token, index) => {
      if (/^[MLHV]$/.test(token)) {
        command = token;
        axis = token === 'V' ? 'Y' : 'X';
        segment++;
      } else if (/^\d/.test(token)) {
        numberField(
          marks,
          `${segment} · ${command} · ${axis}`,
          Number(token),
          axis === 'X' ? () => glyph.width ?? 100 : 140,
          (value) => {
            tokens[index] = String(value);
            glyph.marks = tokens.join('');
          }
        );
        axis = 'Y';
      }
    });
    const hint = document.createElement('p');
    hint.className = 'help';
    hint.textContent = 'M: 始点、L: 直線の終点、H: 横線の終点X、V: 縦線の終点Y';
    marks.append(hint);
  }
  refresh();
}

for (const letter of CHARACTERS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = letterName(letter);
  button.dataset.letter = letter;
  button.addEventListener('click', () => selectLetter(letter));
  element('letter-picker').append(button);
}
form.addEventListener('submit', (event) => event.preventDefault());
sample.addEventListener('input', () => {
  if (valid) renderContext();
});
element('reset-letter').addEventListener('click', () => {
  draft[selected] = structuredClone(baseline[selected] as Glyph);
  status.textContent = '';
  selectLetter(selected);
});
reset.addEventListener('click', () => {
  draft = structuredClone(baseline);
  status.textContent = '';
  selectLetter(selected);
});
download.addEventListener('click', () => {
  if (!valid) return;
  const url = URL.createObjectURL(
    new Blob([serializeGlyphConfig(draft)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'glyphs.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent =
    'ダウンロードした glyphs.json で src/glyphs.json を置き換えてください。';
});
element<HTMLInputElement>('import-config').addEventListener(
  'change',
  async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('設定ファイルが大きすぎます。');
      draft = parseGlyphConfig(JSON.parse(await file.text()));
      status.textContent =
        '設定を読み込みました。保存する前にプレビューを確認してください。';
      selectLetter(selected);
    } catch (cause) {
      showError(cause);
    }
    input.value = '';
  }
);
save.addEventListener('click', async () => {
  if (!local || !valid || saving) return;
  saving = true;
  form.inert = true;
  element('letter-picker').inert = true;
  element<HTMLInputElement>('import-config').disabled = true;
  const snapshot = parseGlyphConfig(draft);
  refresh();
  try {
    const response = await fetch('/__glyphs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseline: original(), glyphs: snapshot }),
    });
    if (!response.ok) throw new Error(await response.text());
    baseline = snapshot;
    status.textContent =
      'src/glyphs.json に保存しました。git diff と bun run ci で確認してください。';
  } catch (cause) {
    status.textContent = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving = false;
    form.inert = false;
    element('letter-picker').inert = false;
    element<HTMLInputElement>('import-config').disabled = false;
    selectLetter(selected);
  }
});

window.addEventListener('beforeunload', (event) => {
  if (changedLetters().length) event.preventDefault();
});
selectLetter(selected);

// The endpoint exists only in the local development server.
if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  try {
    const response = await fetch('/__glyphs');
    if (response.ok) {
      const current = parseGlyphConfig(await response.json());
      // Do not overwrite edits made while the request was in flight.
      if (!changedLetters().length) draft = structuredClone(current);
      baseline = current;
      local = true;
      save.hidden = false;
      element('save-help').textContent =
        '「リポジトリに保存」で src/glyphs.json に書き込みます。Gitのコミットとプッシュは保存後に実行してください。';
      selectLetter(selected);
    }
  } catch {
    /* Static preview: use the downloadable configuration. */
  }
}
