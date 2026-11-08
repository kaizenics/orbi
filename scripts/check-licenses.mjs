// Fails when any installed dependency uses a licence outside the allow-list below.
// All entries are OSI/FSF-approved or public-domain-style and compatible with distributing ORBI under AGPL-3.0.
import { execSync } from "node:child_process";

const ALLOWED = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "Python-2.0",
  "MPL-2.0",
  "LGPL-3.0-or-later",
  "GPL-2.0",
  "AGPL-3.0-or-later",
]);

/** An SPDX expression passes if every AND-term is allowed, or any OR-alternative is. */
function isAllowed(expression) {
  const expr = expression.replace(/[()]/g, "").trim();
  if (expr.includes(" OR ")) return expr.split(" OR ").some((part) => isAllowed(part));
  return expr.split(" AND ").every((part) => ALLOWED.has(part.trim()));
}

const byLicense = JSON.parse(
  execSync("pnpm licenses list --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
);
const violations = Object.entries(byLicense)
  .filter(([license]) => !isAllowed(license))
  .flatMap(([license, pkgs]) => pkgs.map((p) => `  ${p.name}@${p.versions?.join(", ") ?? "?"}: ${license}`));

if (violations.length > 0) {
  console.error(`Dependencies with licences outside the allow-list:\n${violations.join("\n")}`);
  process.exit(1);
}
const total = Object.values(byLicense).reduce((n, pkgs) => n + pkgs.length, 0);
console.log(
  `Licence check passed: ${total} packages across ${Object.keys(byLicense).length} licence expressions.`,
);
