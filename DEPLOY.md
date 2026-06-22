# Vercel Deployment Guide

This system runs as:
- **React app** (Vite) → static, deployed to Vercel
- **Photo upload API** (Vercel serverless function at `api/upload-photo.ts`) → relays photos to a shared SharePoint folder via Microsoft Graph

Total cost: $0 (well under Vercel's free Hobby tier and Microsoft Graph's free API quota).

---

## Part 1 — Azure AD: grant the app permission to upload to SharePoint

You already created an Azure AD app (Client ID `b4c1d5b5-5cfb-4591-b60d-b314247a2a22`) for sign-in. We need to add **application permissions** so the server-side function can write to SharePoint without a user being signed in.

1. Open https://entra.microsoft.com → **App registrations** → your app.
2. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Application permissions**.
3. Search for `Files.ReadWrite.All` → check it → **Add permissions**.
4. Click **Grant admin consent for [your tenant]** (you need Global Admin or Cloud Application Administrator role; if you don't have it, ask your IT admin to click this button).
5. Status should change to "Granted for [your tenant]" with a green check.

> **Why this permission?** `Files.ReadWrite.All` lets the app read/write any file in your tenant. To scope it tighter, you can use `Sites.Selected` and grant access to one specific site, but that requires an extra Graph API call. Start with `Files.ReadWrite.All` and lock down later if needed.

6. **Certificates & secrets** → confirm your existing client secret is still valid (or create a new one). Copy the **Value** (you'll paste it into Vercel env vars).

---

## Part 2 — Choose your SharePoint folder

The function needs to know **where** to put the photos. You'll need three values:

| Env var | Example | How to find |
|---|---|---|
| `SHAREPOINT_HOSTNAME` | `cranberry.sharepoint.com` | First part of any SharePoint URL |
| `SHAREPOINT_SITE_PATH` | `sites/qa-team` | Path after the hostname (e.g. for `https://cranberry.sharepoint.com/sites/qa-team` → `sites/qa-team`) |
| `SHAREPOINT_FOLDER_PATH` | `Complaint Photos` | Folder name inside the default Documents library. Create it manually in SharePoint first. |

If you want to use a user's OneDrive instead of a team SharePoint site, ask me and I'll adjust the function.

---

## Part 3 — Deploy to Vercel

### Option A: via the Vercel dashboard (no CLI)

1. Create a GitHub repository for this project and push the code.
2. Go to https://vercel.com → **Sign up** with GitHub.
3. **Add New Project** → **Import** your repo.
4. Framework preset: Vite (auto-detected).
5. Before clicking Deploy, expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | (from .env.local) |
   | `VITE_FIREBASE_AUTH_DOMAIN` | (from .env.local) |
   | `VITE_FIREBASE_PROJECT_ID` | (from .env.local) |
   | `VITE_FIREBASE_STORAGE_BUCKET` | (from .env.local) |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | (from .env.local) |
   | `VITE_FIREBASE_APP_ID` | (from .env.local) |
   | `VITE_FIREBASE_MEASUREMENT_ID` | (from .env.local) |
   | `VITE_MS_TENANT_ID` | (from .env.local) |
   | `MS_TENANT_ID` | same as VITE_MS_TENANT_ID — the function uses this without VITE_ prefix |
   | `MS_CLIENT_ID` | `b4c1d5b5-5cfb-4591-b60d-b314247a2a22` |
   | `MS_CLIENT_SECRET` | the secret VALUE from Azure step 6 above |
   | `SHAREPOINT_HOSTNAME` | e.g. `cranberry.sharepoint.com` |
   | `SHAREPOINT_SITE_PATH` | e.g. `sites/qa-team` |
   | `SHAREPOINT_FOLDER_PATH` | e.g. `Complaint Photos` |
   | `ALLOWED_ORIGINS` | (optional) `https://your-vercel-url.vercel.app` |

6. Click **Deploy**. Wait ~1 min.

### Option B: via CLI

```
npm i -g vercel
vercel login
vercel link        # links this folder to a new Vercel project
vercel env add     # add each variable above one at a time
vercel deploy --prod
```

---

## Part 4 — Update Firebase Auth redirect URI

Your Microsoft sign-in only works for `localhost:5173` right now. After deploying, you need to also allow your Vercel URL.

1. Vercel will give you a URL like `https://qa-system.vercel.app`.
2. Go to https://entra.microsoft.com → your app → **Authentication** → **Add a platform** (or edit existing **Web** platform).
3. Under **Redirect URIs**, add: `https://qa-system-649ef.firebaseapp.com/__/auth/handler` (this is the Firebase handler, not your Vercel domain — Firebase manages the OAuth dance).
4. *(You may have already added this earlier — if so, no change needed.)*

5. In Firebase Console → **Authentication → Settings → Authorized domains** → add your Vercel domain (`qa-system.vercel.app`).

---

## Part 5 — Test it

1. Open your deployed URL in an incognito window.
2. Click **Submit Complaint** → fill in form → pick **Yes** for Defective Sample Photo → choose 1–2 images → submit.
3. You should see "Uploading photo 1 of 2 to OneDrive..." then land on the thank-you page.
4. Open SharePoint → your folder → there should be a new sub-folder named with the reference number (e.g. `PC2606-A3F4Q1`) containing your photos.
5. Sign in to the app as admin → **Inbox** → open the submission → photos appear as thumbnails. Clicking any thumbnail opens the SharePoint URL in a new tab.

---

## Local development with photo upload

`npm run dev` runs the Vite dev server only — the API function won't work. To test photo uploads locally, install Vercel CLI and run:

```
npm i -g vercel
vercel link    # one-time
vercel env pull .env.local   # syncs Vercel env vars locally
vercel dev     # runs Vite + the API function together on http://localhost:3000
```

---

## Troubleshooting

**`Token exchange failed: 401`**
The client secret in Vercel env vars is wrong or expired. Regenerate in Azure and update Vercel.

**`Graph upload failed: 403`**
Admin consent not granted. Go back to Part 1 step 4.

**`Graph upload failed: 404`**
SharePoint site path or folder doesn't exist. Double-check `SHAREPOINT_SITE_PATH` and create the folder.

**`File exceeds 4 MB limit`**
Vercel Hobby tier caps function payloads. Either compress photos before uploading, or upgrade to Vercel Pro for 50 MB.

**Photo upload works but Inbox shows broken images**
The `webUrl` returned by Graph is a SharePoint URL that requires the viewer to be signed in to Microsoft 365. That's expected — QA team members are. Public submitters never need to view these.
