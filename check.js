// check.js (Node 18+), jeden beh kontroluje stránku opakovane
const fs = require("fs");

const URL = "https://www.beachdrazdiak.sk/turnaje/238-black-light-neon-beach-tournament/";
const TOPIC = process.env.NTFY_TOPIC;
const FILE = "baseline.json";
const INTERVAL = 30_000;   // kontrola každých 30 s
const DURATION = 120_000;  // beh trvá cca 2 minúty

const toLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let baseline = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE, "utf8"))
    : null;
  const end = Date.now() + DURATION;

  while (true) {
    try {
      const res = await fetch(URL, { cache: "no-store" });
      if (!res.ok) {
        console.log("Stránka vrátila chybu", res.status);
      } else {
        const lines = toLines(await res.text());

        if (!baseline) {
          baseline = lines;
          fs.writeFileSync(FILE, JSON.stringify(lines, null, 2));
          console.log("Baseline uložená.");
        } else {
          const added = lines.filter((l) => !baseline.includes(l));
          const removed = baseline.filter((l) => !lines.includes(l));

          if (added.length || removed.length) {
            const msg =
              "Pribudlo: " + (added.join(" | ").slice(0, 300) || "-") +
              "\nZmizlo: " + (removed.join(" | ").slice(0, 300) || "-") +
              "\n" + URL;
            console.log(msg);

            const r = await fetch(`https://ntfy.sh/${TOPIC}`, {
              method: "POST",
              headers: {
                Title: "Zmena na stranke turnaja!",
                Priority: "urgent",
              },
              body: msg,
            });
            console.log("ntfy odpoved:", r.status, await r.text());

            baseline = lines;
            fs.writeFileSync(FILE, JSON.stringify(lines, null, 2));
          } else {
            console.log("Bez zmeny.");
          }
        }
      }
    } catch (e) {
      console.error(e.message);
    }

    if (Date.now() + INTERVAL > end) break;
    await sleep(INTERVAL);
  }
}

main();
