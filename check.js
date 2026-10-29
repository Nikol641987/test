// check.js (Node 18+), spustí sa raz, porovná a skončí
const fs = require("fs");

const URL = "https://www.beachdrazdiak.sk/turnaje/238-black-light-neon-beach-tournament/";
const TOPIC = process.env.NTFY_TOPIC;
const EMAIL = process.env.NOTIFY_EMAIL;
const FILE = "baseline.json";

const toLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

async function main() {
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) {
    console.log("Stránka vrátila chybu", res.status, "- preskakujem");
    return;
  }
  const lines = toLines(await res.text());

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(lines, null, 2));
    console.log("Baseline uložená.");
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const added = lines.filter((l) => !baseline.includes(l));
  const removed = baseline.filter((l) => !lines.includes(l));

  if (!added.length && !removed.length) {
    console.log("Bez zmeny.");
    return;
  }

  const msg =
    "Pribudlo: " + (added.join(" | ").slice(0, 300) || "-") +
    "\nZmizlo: " + (removed.join(" | ").slice(0, 300) || "-") +
    "\n" + URL;
  console.log(msg);

  await fetch(`https://ntfy.sh/${TOPIC}`, {
    method: "POST",
    headers: {
      Title: "Zmena na stránke turnaja!",
      Priority: "urgent",
      Email: EMAIL,
    },
    body: msg,
  });

  fs.writeFileSync(FILE, JSON.stringify(lines, null, 2));
}

main().catch((e) => {
  console.error(e.message);
});
