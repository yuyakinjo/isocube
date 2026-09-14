# isocube

[![npm version](https://img.shields.io/npm/v/isocube.svg)](https://www.npmjs.com/package/isocube)

Generate colorful block-letter logos as transparent SVGs. No API key, external fonts, or runtime dependencies required.

![Isocube logo](examples/isocube.svg)

## Usage

One row, random RGB color for each character. Colors vary on each run; the image below is one example.

```sh
npx isocube --text HELLO --out output/hello.svg
```

![HELLO in one row with random colors](examples/hello.svg)

Reverse the text: HELLO becomes OLLEH.

```sh
npx isocube --text HELLO --reverse --out output/reverse.svg
```

Two rows: hello / world.

```sh
npx isocube --text helloworld --break-at 5 \
  --colors '#2D00F7,#E500A4,#F20089,#FFB600,#6A00F4,#8900F2,#BC00DD' \
  --out output/hello-world.svg
```

![HELLO WORLD in two rows](examples/hello-world.svg)

Three rows: ABC / DEF / GHI.

```sh
npx isocube --text ABCDEFGHI --break-at 3,6 \
  --colors 'rgb(45,0,247),#E500A4' --out output/repeat-color.svg
```

![ABCDEFGHI in three rows](examples/repeat-color.svg)

All 26 letters: four rows of A–Z.

```sh
npx isocube --text ABCDEFGHIJKLMNOPQRSTUVWXYZ --break-at 7,14,21 \
  --colors '#2D00F7,#E500A4,#F20089,#FFB600,#6A00F4,#8900F2,#BC00DD' \
  --out output/alphabet.svg
```

![A to Z in four rows](examples/alphabet.svg)

| Option       | Description                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text`     | Required. 1–256 letters (A–Z, hiragana, katakana), digits, or actual newlines. Lowercase becomes uppercase. No spaces or other characters.                             |
| `--reverse`  | Reverse the entire input, including newlines, before applying `--break-at`. Colors follow the resulting character order. Defaults to off.                              |
| `--break-at` | Optional ascending cumulative character positions, e.g. `4` or `3,6`. Cannot be combined with embedded newlines.                                                       |
| `--colors`   | Optional comma-separated `#RGB`, `#RRGGBB`, or `rgb(r,g,b)` colors. A short palette repeats across rows. Defaults to independent random RGB values for each character. |
| `--out`      | SVG output path. Default: `output/logo.svg`. Existing files are overwritten.                                                                                           |
| `--force`    | Accepted for compatibility. Existing files are overwritten by default.                                                                                                 |
| `--help`     | Show usage.                                                                                                                                                            |

## Hiragana and katakana

Generate kana with the same CLI and JavaScript API. Both scripts support the 46 basic kana, voiced and semi-voiced forms (including ゔ / ヴ), small kana, and the long vowel mark ー. Katakana also supports ヷ / ヺ. Kanji, half-width kana, historical ゐ / ゑ / ヰ / ヱ, spaces, and punctuation are not supported.

```sh
npx isocube --text 'こんにちは' --out output/hiragana.svg
npx isocube --text 'アイスクリーム' --out output/katakana.svg
```

Kana are solid polygon silhouettes with extruded sides and open counters, using embedded vector paths with no font dependency. Decomposed dakuten and handakuten are normalized to composed kana before counting characters, reversing, or applying line breaks. Dakuten and handakuten are separate solid shapes. Small kana use smaller solid glyphs aligned to the baseline.

The site includes **A–Z**, **ひらがな**, and **カタカナ** galleries with SVG downloads. Run `bun run dev:site` to view them locally.

## JavaScript API

```js
import { generateLogo } from 'isocube';

const { svg, lines, colors } = generateLogo({
  text: 'SAMPLE',
  breakAt: [4],
  colors: ['#2D00F7', '#E500A4'],
});
```

TypeScript declarations are included.

Pass `reverse: true` to reverse the input before applying `breakAt`, just like the CLI's `--reverse` option.

## License

MIT
