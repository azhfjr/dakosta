// Secret scan read-only untuk file yang dilacak git.
// Output hanya path/baris/rule dan nilai yang dimasking — nilai rahasia tidak pernah dicetak.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RULES = [
  {
    id: "private-key",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  { id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { id: "openai-key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    id: "jwt-like",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    id: "hardcoded-password",
    re: /\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/gi,
  },
];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const findings = [];
let scanned = 0;

function mask(value) {
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***(${value.length})`;
}

for (const file of files) {
  if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|zip|gz)$/i.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  scanned += 1;
  const lines = text.split(/\r?\n/);
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i += 1) {
      rule.re.lastIndex = 0;
      const match = rule.re.exec(lines[i]);
      if (match) {
        findings.push({
          file,
          line: i + 1,
          rule: rule.id,
          masked: mask(match[0]),
        });
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      scannedFiles: scanned,
      totalFindings: findings.length,
      findings,
    },
    null,
    2,
  ),
);
