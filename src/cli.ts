#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { generateLogo } from "./index.js";

try {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      text: { type: "string" },
      "break-at": { type: "string" },
      colors: { type: "string" },
      out: { type: "string", default: "output/logo.svg" },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (values.help) {
    console.log(
      'isocube --text DECOPIN [--break-at 4] [--colors "#2D00F7,#E500A4"] [--out output/logo.svg]\n改行位置: 累積文字数をカンマ区切り。色省略: 文字ごとにランダムRGB。対応: A-Z / 0-9。背景透過SVG。同名の出力ファイルは上書き保存します。',
    );
  } else {
    if (values.text === undefined) throw new Error("--text を指定してください。");
    const result = generateLogo({
      text: values.text,
      breakAt: values["break-at"]?.split(",").map(Number),
      colors: values.colors?.split(/,(?![^()]*\))/),
    });
    const output = resolve(values.out);
    if (!output.toLowerCase().endsWith(".svg"))
      throw new Error("--out は .svg ファイルを指定してください。");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, result.svg);
    console.log(`${result.lines.join(" / ")} → ${output}\ncolors: ${result.colors.join(",")}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
