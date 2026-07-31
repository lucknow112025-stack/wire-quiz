# Wire Quiz — Self-Updating News Quiz

A quiz that regenerates itself from live news headlines **on a schedule that
runs on GitHub's servers** — no laptop, tab, or manual step required after
setup.

## How it works

```
GitHub Actions (every 15 min)
   → scripts/generate-quiz.js fetches Google News RSS
   → builds fill-in-the-blank questions
   → writes quiz-data.json
   → commits it back to the repo
        ↓
GitHub Pages serves index.html + quiz-data.json
        ↓
Anyone visiting the page just reads the latest committed quiz-data.json
(with a client-side fallback fetch if that file is ever missing/stale)
```

Nothing needs to be running for updates to happen — GitHub's own cron
scheduler triggers the workflow, even if every browser tab is closed and
your computer is off.

## One-time setup (5 minutes)

1. **Create a new GitHub repo** and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   Repo → Settings → Pages → Build and deployment → Source: **Deploy from a
   branch** → Branch: `main`, folder `/ (root)` → Save.
   Your site will be live at `https://<you>.github.io/<repo>/`.

3. **Run the workflow once manually** so `quiz-data.json` gets its first
   real edition instead of the seed placeholder:
   Repo → Actions tab → "Update Wire Quiz" → Run workflow.

4. Done. From here it updates itself every 15 minutes, forever, for free
   (GitHub Actions free tier covers this easily for a public repo).

## Files

- `index.html` — the quiz page itself (pure HTML/CSS/JS, no build step)
- `scripts/generate-quiz.js` — Node script that fetches the RSS feed and
  writes `quiz-data.json`
- `.github/workflows/update-quiz.yml` — the cron schedule (`*/15 * * * *`)
  that runs the script and commits the result
- `quiz-data.json` — the current generated edition (auto-overwritten)

## Customizing

- **Change news source/region**: edit `RSS_URL` in
  `scripts/generate-quiz.js` (any Google News RSS URL works — swap `hl`/`gl`/`ceid`
  for another edition, or point it at a different RSS feed entirely).
- **Change refresh frequency**: edit the `cron` line in
  `update-quiz.yml`. Note GitHub Actions schedules are a *best-effort*
  minimum — on the free tier very frequent crons (like every 1–2 min) can be
  delayed under load; 15 min is a reliable interval.
- **Number of questions**: `MAX_QUESTIONS` in `generate-quiz.js`.

## Notes

- The workflow needs `permissions: contents: write` (already set) so it can
  commit `quiz-data.json` back to the repo.
- If Google's RSS structure ever changes, `generate-quiz.js` will fail
  loudly in the Actions log rather than silently publishing garbage — check
  the Actions tab if the quiz stops updating.
