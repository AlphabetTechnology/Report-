# SWS Report Builder

Builds SWS social media performance reports from screenshots. Upload the month's analytics screenshots, and the tool:

1. **Reads each screenshot with Claude.** It works out the platform (Facebook, Instagram, TikTok, YouTube, LinkedIn, Pinterest, Google Business Profile) and what the screenshot shows, copies out the numbers, and places it in the right section. Dashboard screenshots with several cards are cut into one image per card, and Meta's red/green "↓ 99.7%" change labels are erased (switch in Details).
2. **Writes the report text** (executive summary, a paragraph per metric, audience, top content, focus for next month and conclusion) in the SWS house style, in UK or US English per client.
3. **Proofreads** grammar, spelling, wording, consistent labels, and checks that the numbers in the text match the screenshots. Each change is a suggestion you accept or dismiss.
4. **Lays everything out** in the SWS A4 template (cover, table of contents, numbered sections, thank-you page). Pages flow automatically, and **Download PDF** saves it.

## Using it

1. **Add a client:** name, logo (empty margins are trimmed automatically), UK or US English, and a line about what they do.
2. **New report:** pick the client, month and platforms.
3. **Screenshots tab:** drop in all the screenshots at once (you can also paste them). Check where each one went, and change the platform, section or type if needed. Use ↑ ↓ to reorder.
4. **Text tab:** click **Write report text with Claude**, then edit anything. Wrap words in `**double asterisks**` to make them bold.
5. **Proofread tab:** click **Check grammar & wording** and accept or dismiss the suggestions.
6. **Download PDF:** in the print window choose *Save as PDF*, paper A4, margins *None*, and tick *Background graphics*. The file name defaults to `September_2026_Client_SM_report`.

Clients and reports are stored in the browser (IndexedDB). Use **Export backup** / **Import backup** on the home page to move them between computers or share them with colleagues.

### Which screenshots go where

| Section | Screenshot types |
|---|---|
| 1. Executive Summary | Content overview cards |
| 2. Account Reach | Reach / Viewers / Impressions |
| 3. Account Views | Views charts; a profile grid screenshot is shown inside a phone |
| 4. Engagement | Content interactions, likes, comments, shares |
| 5. Account Visits | Page / profile visits, follows, subscribers |
| 6. Audience Overview | Age & gender, top cities & countries |
| 7. Top Content | Top posts / videos / pins |
| 8. Activities & Engagement | Proof of work: posts published, comment and review replies, Google Business posts |
| 9. Focus for the Next Month, 10. Conclusion | Text only |

Sections with nothing in them are left out, and the contents page renumbers itself. Several screenshots in one section are laid out in rows (2 across, or 3 for phone screenshots), so any number of uploads fits.

## Live site (GitHub Pages)

**https://alphabettechnology.github.io/Report-/**

Every push to the main branch rebuilds the site (`.github/workflows/pages.yml`). GitHub Pages has no server, so on this version each person clicks **API key** in the sidebar once and pastes their own Anthropic key. It is kept only in their browser and sent only to Anthropic. Use a key with a monthly spending limit.

If the site doesn't load the first time, open *Settings → Pages* and set the source to the `gh-pages` branch, `/ (root)`.

### Google Drive sync

Reports are saved in the portal and sync automatically to a shared Google Drive
folder (every minute and after each change). One-time setup:
[GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

### Client website

On the client form, enter the website and click **Fetch from website**. Claude reads
the site and fills in what the client does, which it then uses when writing reports.

## Running with a server (optional)

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY (and optionally APP_PASSWORD)
npm install
npm run dev                  # http://localhost:3000
```

### Deploying to Vercel instead

Import the repository in Vercel and set `ANTHROPIC_API_KEY` (and `APP_PASSWORD` if you want the AI features behind a team password) under *Settings → Environment Variables*. Then nobody needs their own key: Claude is called from the server.

## How it is built

- Next.js (App Router), TypeScript, no database.
- `src/lib/ai/` holds the Claude prompts and schemas (`claude-opus-5-5`, structured JSON output). The `src/app/api/` routes run them on a server; the GitHub Pages build runs them in the browser (`src/lib/api.ts` picks which).
- `src/components/report/` is the A4 template. `units.tsx` turns a report into blocks, and `ReportDocument.tsx` measures the blocks and packs them into pages, shrinking screenshots slightly when that avoids a mostly empty page.
- Template images (cover photo, contents photos, platform badges, SWS logo) are in `public/template/`, taken from the approved September 2026 report. Fonts: Poppins (headings), Noto Sans (body), Roboto (thank-you page).
