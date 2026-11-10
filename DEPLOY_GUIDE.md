# Publish BirdsSky on Netlify or Vercel

This bundle is prepared for static hosting. Its production bird and scenery models are served from `public/assets/models` (no Manus-only storage URLs), and `pnpm build` generates the static site in `dist/`. No environment variables or backend service are needed.

## Before you start

You need the ZIP file extracted on your computer, a GitHub account, and either a Netlify or Vercel account. This guide recommends GitHub-connected deployment: after the first release, pushing a new commit automatically rebuilds and republishes the site.

## Step 1 — Extract the ZIP

Unzip `birdssky-deploy.zip` into a folder, for example `Documents/birdssky-deploy`. Open that folder and make sure you can see `package.json`, `pnpm-lock.yaml`, `netlify.toml`, `vercel.json`, and `public/`.

## Step 2 — Put the project on GitHub

1. Install and open **GitHub Desktop**; sign in to your GitHub account.
2. On GitHub.com, create a new empty repository named `birdssky` (or another name). Do not initialize it with a README, license, or `.gitignore`.
3. In GitHub Desktop choose **File → Clone repository**, select the new repository, and clone it to a folder you can find.
4. Copy the *contents* of the extracted `birdssky-deploy` folder into the cloned repository folder. Do not copy a nested `birdssky-deploy` folder; `package.json` should be at the repository root.
5. Return to GitHub Desktop. You should see the project files listed as changes. Enter a summary such as `Prepare BirdsSky for public hosting`, click **Commit to main**, then click **Push origin**.

If GitHub warns about a large file, do not remove files from `public/assets/models`; those are the game’s local 3D models. The deploy ZIP omits unnecessary catalog candidates and installed dependencies.

## Option A — Netlify

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Choose **GitHub**, authorize Netlify if asked, then select your `birdssky` repository.
3. Netlify reads `netlify.toml` automatically. Verify **Build command** is `pnpm build` and **Publish directory** is `dist`.
4. Click **Deploy site**. Wait for the deploy to finish, then click the generated `*.netlify.app` address.
5. To choose a nicer URL, open **Site configuration / Domain management** and edit the site name or add a domain you own.

## Option B — Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the `birdssky` GitHub repository.
3. Vercel should detect the included `vercel.json`. If it asks, set **Build command** to `pnpm build` and **Output directory** to `dist`. No environment variables are required.
4. Click **Deploy**. When the build completes, open the generated `*.vercel.app` address.
5. To use your own domain, open the project’s **Settings → Domains** and follow the DNS instructions shown there.

## If you deployed an earlier ZIP and the 3D models are missing

The original ignore rules excluded `public/assets/models/*.glb` from Git, so the app shell could deploy while model requests returned 404. Use this corrected bundle. Copy its files over the same cloned repository and replace `.gitignore`; in GitHub Desktop confirm that the files under `public/assets/models/` appear as added/changed. Commit and push those files. Vercel will redeploy automatically. Once deployment finishes, the model URLs should return HTTP 200 instead of 404.

## Updating the live site later

Edit files in your local cloned repository, commit the changes in GitHub Desktop, and click **Push origin**. Netlify or Vercel will detect the new commit and deploy it.

## If the build fails

Open the failed deployment’s build log and copy the first error message. Confirm that `package.json`, `pnpm-lock.yaml`, and `public/` are at the repository root, and that the host is using Node 22 and `pnpm build`. The game does not need a database or secrets.
