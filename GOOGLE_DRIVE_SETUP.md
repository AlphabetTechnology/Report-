# Google Drive sync: one-time setup

About 10 minutes, done once by the person who owns the Google account. Afterwards
everyone on the team clicks **Connect Google Drive** and their reports sync
automatically.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> and sign in with the Google account that should own the setup.
2. Top bar → project picker → **New project** → name it `SWS Report Builder` → **Create**, then select it.

## 2. Turn on the Google Drive API

1. Menu → **APIs & Services → Library**.
2. Search **Google Drive API** → **Enable**.

## 3. Set up the sign-in screen

1. Menu → **Google Auth Platform** (called **OAuth consent screen** in some accounts) → **Get started**.
2. App name `SWS Report Builder`, your support email → **Next**.
3. Audience: **External** → **Next**. Contact email → **Next** → agree → **Create**.
4. **Data access** → **Add or remove scopes** → tick `.../auth/drive` (See, edit, create and delete all of your Google Drive files). If it isn't listed, paste `https://www.googleapis.com/auth/drive` under *Manually add scopes* → **Add to table** → **Update** → **Save**.
5. **Audience** → **Test users** → **Add users** → enter the Gmail address of everyone on the team (up to 100) → **Save**.

The app stays in "Testing" mode, which is fine for an internal team tool. When
someone signs in, Google shows "Google hasn't verified this app": click
**Continue**.

## 4. Create the client ID

1. **Clients** (or **APIs & Services → Credentials**) → **Create client**.
2. Application type: **Web application**, name `Report Builder`.
3. **Authorised JavaScript origins** → **Add URI** → `https://alphabettechnology.github.io`
   (add `http://localhost:3000` too if you run it locally).
4. **Create** and copy the **Client ID** (ends in `.apps.googleusercontent.com`).
   The client ID is not a secret.

## 5. Give the client ID to the app

Pick one:

- **For everyone (recommended):** in GitHub open the repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**,
  name `GOOGLE_CLIENT_ID`, value = the client ID. Then **Actions → Deploy to GitHub Pages → Run workflow**.
- **Per person:** in the app, **Settings → Google OAuth client ID**.

## 6. Connect and share the folder

1. First person: app → **Settings (API key & Google Drive)** → **Connect Google Drive**.
   A folder called **SWS Reports** is created in their Drive and everything uploads.
2. In Google Drive, share **SWS Reports** with the team as **Editor**.
3. Everyone else: open the folder link once in Google Drive, then in the app paste
   the folder link into **Drive folder** → **Connect Google Drive**.

## How syncing works

- Reports are saved in the portal first (they keep working offline), then sync to Drive
  every minute, a few seconds after each change, and whenever you come back to the tab.
- Each client and report is a `.json` file; each screenshot is its own image file in the folder.
- If two people change the same report, the most recent change wins.
- Deleting a report removes it for everyone at the next sync.
- Google sign-ins last an hour. When one runs out, the badge shows **Reconnect Drive**; the
  next click anywhere signs in again (a Google window flashes briefly).
