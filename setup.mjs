#!/usr/bin/env node
// Interactive setup. No dependencies of its own — plain Node ≥ 20.
//
//   npm run setup                    # asks everything
//   npm run setup -- local           # personal version, run on this computer
//   npm run setup -- pages           # personal version, publish on GitHub Pages

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const personalDir = join(root, "personal");
const DEFAULT_NAME = "LinkedIn Analytics Tracker";

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Prompting. Lines are buffered by hand because readline drops lines that
// arrive before a question is asked, which breaks piped input.
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pending = [];
let waiting = null;
let inputClosed = false;
rl.on("line", (line) => (waiting ? (waiting(line), (waiting = null)) : pending.push(line)));
rl.on("close", () => {
  inputClosed = true;
  waiting?.("");
});

async function ask(question, fallback = "") {
  const hint = fallback ? dim(` (${fallback})`) : "";
  process.stdout.write(`${question}${hint}: `);
  const line = pending.length ? pending.shift() : inputClosed ? "" : await new Promise((r) => (waiting = r));
  return line.trim() || fallback;
}

async function confirm(question, defaultYes) {
  const answer = (await ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"}`)).toLowerCase();
  return answer ? answer.startsWith("y") : defaultYes;
}

async function choose(question, options) {
  console.log(`${question}\n`);
  options.forEach((o, i) => console.log(`  ${bold(`${i + 1}) ${o.label}`)}  ${o.detail}`));
  console.log();
  const answer = await ask(`Choose 1–${options.length}`, "1");
  const index = Number(answer) - 1;
  return options[index] ?? options.find((o) => o.key === answer.toLowerCase()) ?? options[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, args, cwd, { quiet = false } = {}) {
  if (!quiet) console.log(dim(`\n$ ${[cmd, ...args].join(" ")}`));
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "" };
}

/** Write KEY="value" lines, keeping any other keys already in the file. */
function writeEnv(file, values, header) {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : header ? [header] : [];
  const kept = lines.filter((l) => !Object.keys(values).some((k) => l.startsWith(`${k}=`)));
  // .env parsers don't agree on escapes, so quotes and newlines are dropped.
  const added = Object.entries(values).map(([k, v]) => `${k}="${String(v).replace(/["\r\n]/g, "")}"`);
  writeFileSync(file, [...kept.filter(Boolean), ...added, ""].join("\n"));
  console.log(green(`✓ Wrote ${file.replace(root, "")}`));
}

/** owner/repo from the `origin` remote, if it points at GitHub. */
function githubRepo() {
  const { ok, stdout } = run("git", ["remote", "get-url", "origin"], root, { quiet: true });
  if (!ok) return null;
  const m = stdout.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function pagesUrl({ owner, repo }) {
  const user = owner.toLowerCase();
  return repo.toLowerCase() === `${user}.github.io` ? `https://${user}.github.io/` : `https://${user}.github.io/${repo}/`;
}

function installDeps() {
  if (!run("npm", ["install"], personalDir).ok) {
    console.error("\nnpm install failed — see the output above.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

async function setupLocal(name) {
  writeEnv(join(personalDir, ".env.local"), { NEXT_PUBLIC_APP_NAME: name });
  installDeps();
  console.log(`
${green("✓ Ready.")} Start it any time with:

    ${bold("cd personal && npm run dev")}   →  http://localhost:3000

Everything runs on your computer. Your exports are read in the browser and kept in its storage.
`);
  if (await confirm("Start it now?", true)) {
    rl.close();
    run("npm", ["run", "dev"], personalDir);
  }
}

async function setupPages(name) {
  // .env.local is git-ignored, so the GitHub Actions build would never see it.
  // .env.production is committed: the name is public anyway, it's on the page.
  writeEnv(join(personalDir, ".env.production"), { NEXT_PUBLIC_APP_NAME: name }, "# Committed on purpose: public build settings for GitHub Pages. Never put secrets here.");
  installDeps();

  console.log(dim("\nChecking that the site builds…"));
  if (!run("npm", ["test"], personalDir).ok || !run("npm", ["run", "build"], personalDir).ok) {
    console.error("\nThe test or build step failed — fix the errors above before publishing.");
    process.exit(1);
  }
  console.log(green("✓ Tests pass and the static site builds."));

  const repo = githubRepo();
  if (!repo) {
    console.log(`
${yellow("! This folder isn't connected to a GitHub repository yet.")}

  1. Fork this project on GitHub (or create an empty repository).
  2. Clone your fork and run ${bold("npm run setup")} again from it — or connect this folder:
       ${bold("git remote add origin https://github.com/<you>/<repo>.git")}
`);
    return;
  }

  const url = pagesUrl(repo);
  const slug = `${repo.owner}/${repo.repo}`;
  let pagesEnabled = false;

  const hasGh = run("gh", ["auth", "status"], root, { quiet: true }).ok;
  if (hasGh && (await confirm(`Turn on GitHub Pages for ${slug} now (uses the GitHub CLI)?`, true))) {
    const enable = (method) =>
      run("gh", ["api", "-X", method, `repos/${slug}/pages`, "-f", "build_type=workflow"], root, { quiet: true }).ok;
    pagesEnabled = enable("POST") || enable("PUT");
    console.log(
      pagesEnabled
        ? green("✓ GitHub Pages is on (source: GitHub Actions).")
        : yellow("! Couldn't change the Pages setting — you may need admin rights on the repository. Do step 1 below by hand."),
    );
  }

  const steps = [
    !pagesEnabled &&
      `Turn on Pages: ${bold(`https://github.com/${slug}/settings/pages`)} → Build and deployment → Source: ${bold("GitHub Actions")}`,
    `Commit and push to ${bold("main")} (including ${bold("personal/.env.production")}):
       ${bold('git add -A && git commit -m "Publish on GitHub Pages" && git push')}`,
    `Watch the deploy: ${bold(`https://github.com/${slug}/actions`)} (about 2 minutes)`,
    `Open your site: ${bold(url)}`,
  ].filter(Boolean);

  console.log(`\n${green("✓ Ready to publish.")} Next:\n`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}\n`));
  console.log(dim("The site is static: visitors' exports are read in their own browser and never uploaded.\n"));
}

// ---------------------------------------------------------------------------

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`Node ${process.versions.node} is too old. Install Node 20 or newer: https://nodejs.org`);
  process.exit(1);
}

console.log(`\n${bold("LinkedIn Analytics Tracker — setup")}\n`);
const arg = process.argv[2];

let mode = arg === "local" || arg === "pages" ? arg : null;
if (!mode) {
  const version = await choose("Which version do you want to set up?", [
    { key: "personal", label: "Personal", detail: "Just you. Runs in your browser, no account or server needed." },
    { key: "team", label: "Team", detail: dim("Coming soon — shared dashboards for an organisation.") },
  ]);
  if (version.key === "team") {
    console.log(`
The team version isn't released yet. Follow the repository for updates.
For now, each person can use the personal version on their own.
`);
    rl.close();
    process.exit(0);
  }

  const where = await choose("\nHow do you want to use it?", [
    { key: "local", label: "Local app", detail: "Run it on this computer. Nothing to publish. (~2 min)" },
    { key: "pages", label: "Publish free on GitHub Pages", detail: "Get a public link you can share. (~5 min)" },
  ]);
  mode = where.key;
}

const name = await ask("\nApp name", DEFAULT_NAME);
if (mode === "pages") await setupPages(name);
else await setupLocal(name);
rl.close();
