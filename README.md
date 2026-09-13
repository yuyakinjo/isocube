# block-string-logo

Generate colorful block-letter logos as transparent SVGs. No API key, external fonts, or runtime dependencies required. Supports Node.js 22 or later.

![Block string logo](examples/block-string-logo.svg)

## Usage

```sh
npx block-string-logo --text SAMPLE --break-at 4 \
  --colors '#2D00F7,#E500A4,#F20089,#FFB600,#6A00F4,#8900F2,#BC00DD' \
  --out output/sample.svg

# One row, random RGB color for each character
npx block-string-logo --text HELLO --out output/hello.svg

# Three rows: ABC / DEF / GHI
npx block-string-logo --text ABCDEFGHI --break-at 3,6 \
  --colors 'rgb(45,0,247),#E500A4' --out output/example.svg
```

| Option       | Description                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text`     | Required. 1–256 ASCII letters, digits, or actual newlines. Lowercase becomes uppercase. No spaces or other characters.                                                 |
| `--break-at` | Optional ascending cumulative character positions, e.g. `4` or `3,6`. Cannot be combined with embedded newlines.                                                       |
| `--colors`   | Optional comma-separated `#RGB`, `#RRGGBB`, or `rgb(r,g,b)` colors. A short palette repeats across rows. Defaults to independent random RGB values for each character. |
| `--out`      | SVG output path. Default: `output/logo.svg`. Existing files are overwritten.                                                                                                                           |
| `--force`    | Accepted for compatibility. Existing files are overwritten by default.                                                                                                 |
| `--help`     | Show usage.                                                                                                                                                            |

Rows are left-aligned and touch. Top and side faces are visible wherever neighboring letters leave an opening, including overhangs on lower rows. The letter I has no interior stroke. The background is transparent and the black outlines remain opaque. Random colors are printed so you can reuse them with `--colors`.

The lettering is a geometric interpretation of the original SAMPLE logo, not a pixel-exact copy. Output is SVG; PNG and WebP conversion are not included.

## JavaScript API

```js
import { generateLogo } from 'block-string-logo';

const { svg, lines, colors } = generateLogo({
  text: 'SAMPLE',
  breakAt: [4],
  colors: ['#2D00F7', '#E500A4'],
});
```

TypeScript declarations are included.

## Development

```sh
bun install
bun test
bun run typecheck
bun pm pack --dry-run
```

## Release

Run **Actions → release → Run workflow** on the default branch. Enable
`dry-run` to validate the build, tests, package contents, and release notes without
publishing or pushing changes. Release runs are serialized.

Versions use CalVer `YYYY.MMdd.HHmm` in UTC, like decopin-cli. Leading zeroes
are omitted for npm compatibility: `2026-09-13 00:05 UTC` becomes `2026.913.5`.
The workflow computes and writes the version once, runs `bun run ci`, then publishes
with npm Trusted Publishing (OIDC) and provenance. After publishing succeeds, it
commits `package.json`, pushes a `v<version>` tag, and creates a GitHub Release.
The Bun lockfile does not store the root package version and needs no version edit.

`bun run version:next` previews the current version; add `--write` to update
`package.json`. Publish at most once per UTC minute; npm versions cannot be
overwritten. CalVer does not indicate API compatibility, so release notes highlight
Conventional Commit `!` markers and `BREAKING CHANGE:` / `BREAKING-CHANGE:` footers.

### One-time npm setup

After this workflow is on GitHub, configure the package's **Settings → Trusted
publishing → GitHub Actions** on npmjs.com:

| Setting | Value |
| --- | --- |
| Organization or user | `yuyakinjo` |
| Repository | `block-string-logo` |
| Workflow filename | `release.yml` |
| Environment name | Leave empty |
| Allowed actions | Allow direct publishing with `npm publish` |

No `NPM_TOKEN` secret is needed. See the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).
If the package does not exist yet, publish the first version from your machine
before configuring its trusted publisher:

```sh
bun install --frozen-lockfile
bun run version:next --write
bun run ci
npm pack --dry-run
npm login
npm publish --access public
```

Use Node.js 26 or later and npm 11.5.1 or later. Commit the initial published
version and tag it as `v<version>` before the next Actions release.
The workflow also needs permission to push the release commit and tag to GitHub;
repository rules must allow this. If publishing succeeds but recording the release
fails, finish the commit/tag/Release for that published version before publishing again.

## License

MIT
