
const fs = require("fs");

const URL =
  "https://www.beachdrazdiak.sk/turnaje/238-black-light-neon-beach-tournament/";

const TOPIC = process.env.NTFY_TOPIC;
const FILE = "baseline.json";
const INTERVAL = 30_000;
const DURATION = 270_000;

const toLines = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notify(title, message) {
  if (!TOPIC) {
    console.error("Chýba GitHub Secret NTFY_TOPIC!");
    return;
  }

  const r = await fetch(`https://ntfy.sh/${TOPIC}`, {
    method: "POST",
    headers: {
      Title: title,
      Priority: "urgent",
    },
    body: message,
  });

  console.log("ntfy odpoveď:", r.status, await r.text());

  if (!r.ok) {
    throw new Error(`ntfy odoslanie zlyhalo: ${r.status}`);
  }
}

async function main() {
  let baseline = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE, "utf8"))
    : null;

  let registrationAlerted = false;
  const end = Date.now() + DURATION;

  while (true) {
    try {
      const res = await fetch(URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TournamentMonitor/1.0)",
        },
      });

      if (!res.ok) {
        console.log("Stránka vrátila chybu", res.status);
      } else {
        const html = await res.text();
        const lines = toLines(html);
        const pageText = lines.join("\n");

        // Hľadanie možného otvorenia registrácie.
        const registrationPattern =
          /\b(zaregistruj\s+sa|registrovať\s+sa|registrácia|prihlásiť\s+sa|prihláška|prihlásiť\s+tím|registruj\s+tím|sign\s*up|register\s+now)\b/i;

        const registrationOpen = registrationPattern.test(pageText);

        if (registrationOpen && !registrationAlerted) {
          await notify(
            "Registrácia na turnaj môže byť otvorená!",
            "Na stránke sa objavil text súvisiaci s registráciou. Over si ho:\n" + URL
          );
          registrationAlerted = true;
        }

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

            await notify("Zmena na stránke turnaja!", msg);

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
