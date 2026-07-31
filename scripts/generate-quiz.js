// generate-quiz.js
// Fetches the current Google News RSS feed, turns headlines into a
// fill-in-the-blank quiz, and writes the result to quiz-data.json.
// Run on a schedule by .github/workflows/update-quiz.yml so the quiz
// updates even when nobody has the page open.

const fs = require("fs");
const path = require("path");

const RSS_URL = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en";
const OUT_FILE = path.join(__dirname, "..", "quiz-data.json");
const MAX_QUESTIONS = 12;

const STOPWORDS = new Set([
  "The","This","That","These","Those","A","An","Is","Are","Was","Were","In",
  "On","At","For","Of","To","And","But","With","As","By","From","After",
  "Before","Over","Under","New","Latest","Says","Say","Said","Will","Its",
  "His","Her","Their","Amid","Amidst"
]);

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTitles(xml) {
  const items = xml.split(/<item>/i).slice(1);
  const titles = [];
  for (const chunk of items) {
    const m = chunk.match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) continue;
    let t = m[1].trim();
    const cdata = t.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
    if (cdata) t = cdata[1];
    t = decodeEntities(t).trim();
    // Google News titles are usually "Headline - Source"; strip the trailing source.
    t = t.replace(/\s+-\s+[^-]{2,40}$/, "").trim();
    if (t) titles.push(t);
  }
  return titles;
}

function extractCandidates(title) {
  const words = title.split(/\s+/);
  const out = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^\w.%-]/g, "");
    if (!w) continue;
    const isNumber = /^\d[\d,.]*%?$/.test(w);
    const isProper = /^[A-Z][a-zA-Z'-]{2,}$/.test(w) && !STOPWORDS.has(w);
    if ((isNumber || isProper) && w.length >= 3) {
      out.push({ word: w, index: i });
    }
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuiz(titles) {
  const allTokens = new Set();
  const perHeadline = titles.map((t) => extractCandidates(t));
  perHeadline.forEach((c) => c.forEach((tok) => allTokens.add(tok.word)));

  const questions = [];
  titles.forEach((title, idx) => {
    const cands = perHeadline[idx];
    if (cands.length === 0) return;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    const words = title.split(/\s+/);
    const blanked = words.map((w, i) => (i === pick.index ? "______" : w)).join(" ");

    const decoyPool = shuffle(
      Array.from(allTokens).filter((t) => t.toLowerCase() !== pick.word.toLowerCase())
    );
    const decoys = decoyPool.slice(0, 3);
    if (decoys.length < 3) return;

    const options = shuffle([pick.word, ...decoys]);
    questions.push({ blanked, answer: pick.word, options });
  });

  return shuffle(questions).slice(0, MAX_QUESTIONS);
}

async function main() {
  console.log("Fetching:", RSS_URL);
  const res = await fetch(RSS_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WireQuizBot/1.0)" }
  });
  if (!res.ok) throw new Error("RSS fetch failed: HTTP " + res.status);
  const xml = await res.text();

  const titles = extractTitles(xml).filter(Boolean);
  if (titles.length === 0) throw new Error("No headlines parsed from feed");

  const quiz = buildQuiz(titles);
  if (quiz.length === 0) throw new Error("No quizzable questions generated");

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "Google News (India edition)",
    headlineCount: titles.length,
    headlines: titles.slice(0, 25),
    quiz
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${quiz.length} questions from ${titles.length} headlines to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("generate-quiz failed:", err.message);
  process.exit(1);
});
