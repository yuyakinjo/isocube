import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calver } from "../scripts/next-version.ts";
import { parseLog, releaseNotes } from "../scripts/release-notes.ts";

describe("release version", () => {
  it("uses UTC even when the supplied date has another timezone", () => {
    assert.equal(calver(new Date("2026-09-13T00:05:00+09:00")), "2026.912.1505");
  });

  it("omits leading zeroes at the start of a year and at midnight", () => {
    assert.equal(calver(new Date("2027-01-01T00:00:00Z")), "2027.101.0");
    assert.equal(calver(new Date("2026-02-03T00:05:00Z")), "2026.203.5");
  });

  it("ignores seconds and rejects invalid dates", () => {
    assert.equal(calver(new Date("2026-12-31T23:59:59Z")), "2026.1231.2359");
    assert.throws(() => calver(new Date("invalid")), /Invalid release date/);
  });
});

describe("release notes", () => {
  it("retains multiple commits and highlights breaking changes before the list", () => {
    const commits = parseLog(
      "feat(cli)!: rename option\n\nBREAKING CHANGE: Use --text instead.\n\0\nfix: keep colors\n\0\nfeat!: remove alias\n\0",
    );
    assert.equal(commits.length, 3);
    const notes = releaseNotes(commits);
    assert.ok(notes.indexOf("## Breaking changes") < notes.indexOf("## Changes"));
    assert.match(notes, /- Use --text instead\./);
    assert.match(notes, /- remove alias/);
    assert.match(notes, /- fix: keep colors/);
  });

  it("recognizes the alternate footer and omits the section for compatible changes", () => {
    assert.match(releaseNotes(parseLog("feat: update\n\nBREAKING-CHANGE: New API\0")), /- New API/);
    assert.doesNotMatch(releaseNotes(parseLog("fix: color\0")), /## Breaking changes/);
  });
});
