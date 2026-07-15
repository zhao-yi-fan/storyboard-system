import { execFileSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const useWorkingTree = args.has("--working-tree");
const allowNoSpec = args.has("--allow-no-spec");

const HIGH_IMPACT_PREFIXES = [
  "storyboard-app/src/app/pages/",
  "backend-node/app/controller/",
  "backend-node/app/service/",
  "backend-node/app/middleware/",
  "backend-node/app/lib/",
  "backend-node/app/router.ts",
  "backend-node/config/",
];

const HIGH_RISK_KEYWORDS = [
  "Workspace",
  "AssetLibrary",
  "ProjectDashboard",
  "media_generation",
  "prompt_library",
  "scene",
  "auth",
];

const IGNORE_PREFIXES = [
  "specs/",
  "storyboard-app/src/app/components/ui/",
  ".github/",
  ".githooks/",
];

const IGNORE_EXACT = new Set([
  "DEPLOY.md",
  ".prettierignore",
  ".prettierrc.json",
  "scripts/check-spec-guard.mjs",
]);

const IGNORE_BASENAMES = [
  "README",
  "eslint.config.",
];

function runGitDiff() {
  const trackedDiffArgs = useWorkingTree
    ? [ "diff", "--name-only" ]
    : [ "diff", "--name-only", "--cached" ];

  const trackedOutput = execFileSync("git", trackedDiffArgs, { encoding: "utf8" }).trim();
  const trackedFiles = trackedOutput
    ? trackedOutput.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];

  if (!useWorkingTree) {
    return trackedFiles;
  }

  const untrackedOutput = execFileSync(
    "git",
    [ "ls-files", "--others", "--exclude-standard" ],
    { encoding: "utf8" }
  ).trim();
  const untrackedFiles = untrackedOutput
    ? untrackedOutput.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];

  return Array.from(new Set([ ...trackedFiles, ...untrackedFiles ]));
}

function isIgnored(file) {
  if (IGNORE_EXACT.has(file)) {
    return true;
  }

  if (IGNORE_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }

  const base = path.basename(file);
  if (IGNORE_BASENAMES.some((prefix) => base.startsWith(prefix))) {
    return true;
  }

  return /\.(test|spec)\.[^.]+$/i.test(base);
}

function isSpecFile(file) {
  return file.startsWith("specs/") && file.endsWith(".md");
}

function isHighImpact(file) {
  return HIGH_IMPACT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function hasHighRiskKeyword(file) {
  const normalized = file.toLowerCase();
  return HIGH_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function suggestSpecFile(file) {
  if (file.startsWith("storyboard-app/src/app/pages/")) {
    const name = path.basename(file, path.extname(file));
    return `specs/${toKebab(name)}-workflow.md`;
  }

  if (file.startsWith("backend-node/app/service/")) {
    const name = path.basename(file, path.extname(file));
    return `specs/${toKebab(name)}-workflow.md`;
  }

  if (file.includes("auth")) {
    return "specs/auth-session-flow.md";
  }

  if (file.includes("scene")) {
    return "specs/storyboard-scene-workflow.md";
  }

  return "specs/<domain>-<change>.md";
}

function toKebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function print(message) {
  process.stdout.write(`${message}\n`);
}

const changedFiles = runGitDiff();

if (changedFiles.length === 0) {
  print("spec-guard: no changed files found, skipping.");
  process.exit(0);
}

const hasSpecChange = changedFiles.some(isSpecFile);
const candidateFiles = changedFiles.filter((file) => !isIgnored(file));
const triggeredFiles = candidateFiles.filter((file) => isHighImpact(file) || hasHighRiskKeyword(file));

if (triggeredFiles.length === 0) {
  print("spec-guard: no high-impact changes detected.");
  process.exit(0);
}

if (hasSpecChange || allowNoSpec) {
  const reason = hasSpecChange ? "spec change detected." : "--allow-no-spec override used.";
  print(`spec-guard: high-impact changes detected, ${reason}`);
  triggeredFiles.forEach((file) => print(`- ${file}`));
  process.exit(0);
}

print("spec-guard: high-impact changes detected without a matching spec update.");
print(`mode: ${useWorkingTree ? "working tree" : "staged diff"}`);
print("triggered files:");
triggeredFiles.forEach((file) => print(`- ${file}`));

print("");
print("why this requires a spec:");
print("- these paths usually change user workflows, API contracts, async task states, or generation behavior");
print("- single-developer mode still treats those changes as spec-worthy to prevent drift");

print("");
print("suggested spec files:");
const suggestions = Array.from(new Set(triggeredFiles.map(suggestSpecFile)));
suggestions.forEach((file) => print(`- ${file}`));

print("");
print("if this is truly a behavior-preserving refactor, rerun with:");
print("- node scripts/check-spec-guard.mjs --allow-no-spec");

process.exit(1);
