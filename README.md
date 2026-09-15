# iPad2Spotify

A Spotify currently-playing dashboard designed for an iPad 2 running Safari/iOS 9.3.6. It shows album artwork, track information, playback state, and playback controls while Spotify plays on another device.

The frontend uses old-browser-compatible ES5 JavaScript and `XMLHttpRequest`. Spotify credentials and tokens are handled by Vercel Functions, not by the iPad browser.

Since we need to use Vercel anyways, the webapp creates a shortcode for a "badge" you can add to your github profile or anywhere displaying the song played last:

[![Last played on Spotify](https://ipad2spotify.vercel.app/api/badge/pszakw4nbafwexn.svg)](https://ipad2spotify.vercel.app/)

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/cb0c0bec-ef17-40f6-b6ff-782786272c0a" />


## What this project solves

An iPad 2 Home Screen web app runs in fullscreen mode, but interactive Spotify OAuth may open normal Safari. This project uses a two-step flow:

1. Open the deployed app in normal Safari on any device and select **Login to Spotify and get pairing code**.
2. Complete Spotify authorization. The callback displays a short-lived pairing code.
3. Open the deployed app from the iPad Home Screen.
4. Select **Enter pairing code** and enter the code.
5. The fullscreen app receives its own secure session and displays playback.

The pairing code expires after ten minutes and is deleted after it is claimed. The Home Screen app does not need to open Spotify login again unless its session expires.

## Fork and deploy your own copy

Alternative 1: Use this button:

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fturbolego%2FiPad2Spotify&project-name=ipad2spotify&repository-name=ipad2spotify&integration-ids=oac_V3R1GIpkoJorr6fqyiwdhl17&env=SPOTIFY_CLIENT_ID&envDescription=Spotify%20app%20Client%20ID%20from%20the%20Spotify%20Developer%20Dashboard&envLink=https%3A%2F%2Fdeveloper.spotify.com%2Fdashboard&env=SPOTIFY_CLIENT_SECRET&envDescription=Spotify%20app%20Client%20Secret%20from%20the%20Spotify%20Developer%20Dashboard%20%28server-only%2C%20mark%20sensitive%29&envLink=https%3A%2F%2Fdeveloper.spotify.com%2Fdashboard&env=APP_ORIGIN&envDescription=Optional.%20Production%20origin%2C%20e.g.%20https%3A%2F%2Fyour-project.vercel.app.%20Used%20for%20the%20Spotify%20redirect%20URI.%20No%20trailing%20slash.&envLink=https%3A%2F%2Fvercel.com%2Fdocs%2Fenvironment-variables)

### 1. Fork this repository

Open [github.com/turbolego/iPad2Spotify](https://github.com/turbolego/iPad2Spotify) and select **Fork**. Choose your own GitHub account or organization and create the fork.

You can also clone the fork locally if you want to make changes:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/iPad2Spotify.git
```

No build step or package installation is required.

### 2. Create a Spotify Developer app

Sign in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) with the Spotify account whose playback should be displayed.

Select **Create app** and enter an app name and description. After creation:

1. Copy the **Client ID**.
2. Reveal and copy the **Client Secret**.
3. Keep the Client Secret private.

Do not commit the Client Secret to GitHub or place it in `index.html`, `app.js`, a URL, or any browser-visible file.

Spotify documentation: [Apps](https://developer.spotify.com/documentation/web-api/concepts/apps)

### 3. Import the fork into Vercel

Open the [Vercel Dashboard](https://vercel.com/dashboard):

1. Select **Add New → Project**.
2. Find your fork of `iPad2Spotify`.
3. Select **Import**.
4. Use the repository root as the Root Directory.
5. Choose **Other** as the Framework Preset, or leave automatic detection enabled.
6. Leave Build Command, Install Command, and Output Directory empty.
7. Select **Deploy**.

Vercel automatically exposes files under `api/` as serverless functions. The project is a plain static frontend plus Vercel Functions and needs no build command.

Copy the production URL, for example:

```text
https://your-project.vercel.app
```

### 4. Create the Redis/KV storage

The pairing flow needs a small shared database because Spotify login happens in normal Safari while the pairing code is entered in the separate fullscreen Home Screen app.

In the Vercel project:

1. Open the **Storage** tab.
2. Select **Create Database** or **Connect Store**.
3. Choose the available **Upstash Redis** integration.
4. Create a database and connect it to this Vercel project.
5. Select the **Production** environment.

The integration should add these variables to the project:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

The current implementation uses the normal read/write token. Do not use `KV_REST_API_READ_ONLY_TOKEN` for `KV_REST_API_TOKEN`, because the application must create, read, and delete pairing/session/badge records.

If the integration provides equivalent variables with different names, add aliases in Vercel:

```text
KV_REST_API_URL   = your Redis REST URL
KV_REST_API_TOKEN = your Redis REST read/write token
```

Upstash’s Vercel integration is documented at [Upstash for Vercel](https://vercel.com/marketplace/upstash).

### 5. Add Vercel environment variables

Open:

```text
Vercel project → Settings → Environment Variables
```

Add these variables for **Production**:

```text
SPOTIFY_CLIENT_ID       = Client ID copied from Spotify
SPOTIFY_CLIENT_SECRET   = Client Secret copied from Spotify
KV_REST_API_URL         = supplied by Upstash Redis
KV_REST_API_TOKEN       = supplied by Upstash Redis
```

Optionally add:

```text
APP_ORIGIN = https://your-project.vercel.app
```

`APP_ORIGIN` is useful when using a custom domain. Do not include a trailing slash. If it is omitted, the application derives the origin from the incoming request host.

`SPOTIFY_CLIENT_SECRET` and the Redis token are server-only variables. Do not prefix them with `NEXT_PUBLIC_`.

Vercel documentation: [Environment Variables](https://vercel.com/docs/environment-variables)

### 6. Add the Spotify Redirect URI

Using the production URL from Vercel, construct:

```text
https://your-project.vercel.app/api/auth/callback
```

In the Spotify Developer Dashboard:

1. Open your Spotify app.
2. Select **Edit Settings**.
3. Find **Redirect URIs**.
4. Add the exact callback URL.
5. Select **Add** if required.
6. Select **Save**.

The redirect URI must match exactly, including `https`, the Vercel hostname, `/api/auth/callback`, capitalization, and trailing slash behavior.

Spotify documentation: [Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

### 7. Redeploy after configuring variables

Environment-variable changes apply only to new deployments. In Vercel, open **Deployments**, select the latest deployment’s menu, and choose **Redeploy**.

Alternatively, push a new commit to the production branch of your fork.

### 8. Test login and pairing

Open the Vercel production URL in normal Safari or another browser and select **Login to Spotify and get pairing code**. Authorize the requested scopes:

- `user-read-currently-playing`
- `user-read-playback-state`
- `user-modify-playback-state`

After authorization, the callback page displays a pairing code. Open the same Vercel URL in Safari on the iPad, select **Add to Home Screen**, and open the new icon. In the fullscreen app select **Enter pairing code**, enter the code, and confirm.

You can complete the login on a phone or computer, then enter the resulting code on the iPad.

## GitHub README last-played badge

After pairing the app and observing at least one playing track, select **Create GitHub README Badge** in the regular player. The app creates a random public badge key and displays Markdown similar to:

```markdown
[![Last played on Spotify](https://your-project.vercel.app/api/badge/abc123.svg)](https://your-project.vercel.app/)
```

Copy that Markdown into a GitHub profile `README.md`. The SVG displays the last track observed by the paired app, including album artwork, song title, and artist. For each badge request, the server uses the stored track ID with Spotify’s `GET /v1/tracks/{id}` endpoint and selects `album.images[0].url`, the highest-resolution artwork returned by Spotify. It then downloads and embeds the artwork inside the SVG so GitHub does not need to load a remote image nested inside the badge. The badge is a public image URL: anyone who can see the README source can request it.

The badge lifecycle is: the paired app polls `/api/spotify/currently-playing`; the server refreshes the Spotify access token from the server-side session; the latest track ID and basic metadata are saved in Redis; **Create GitHub README Badge** creates a random badge key mapped to that session; and GitHub requests `/api/badge/<key>.svg` when rendering the profile README. The badge endpoint looks up the stored track ID, asks Spotify for the current track object and album image, embeds the image, and returns an SVG. The badge is cached for a short period, so GitHub may show an older song for several minutes.

The badge is updated when the app successfully polls Spotify, normally about every five seconds while the iPad app is open. It does not independently monitor Spotify while the iPad app is closed. GitHub and image proxies may cache the image, so changes can appear with a delay of up to several minutes.

The badge key is a viewing key, not a playback-control credential. It does not expose Spotify access tokens, refresh tokens, Redis credentials, or the private session cookie. The badge record expires after one year; create a new badge from the app if it expires.

## Features

The dashboard provides:

- current album artwork,
- track title,
- artist and album,
- current playback state,
- play/pause,
- previous track,
- next track,
- a playback timeline showing elapsed and total track time,
- automatic polling approximately every five seconds,
- a custom SVG last-played card for GitHub profile READMEs,
- Minimalist View with centered album artwork and track text,
- Search Artist to start artist radio playback for any artist,
- Winamp Mode, a retro Winamp-style interface for the same dashboard.

The regular player also has a **Minimalist View** button. Minimalist View centers the album cover on the screen and places the artist and song name directly below it, hiding the other controls and interface elements. Tap the album cover to open the **Exit minimalist view?** confirmation. Select **yes** to return to the regular player or **no** to continue viewing the minimalist display.

The **Search Artist** button opens a search dialog. Enter an artist name and select **Search** to see matching Spotify artists, then select an artist to start playback of that artist's catalog (Spotify's equivalent of "artist radio") on the currently active device.

The **Winamp Mode** button swaps the dashboard for a retro Winamp-style skin that resembles the classic Winamp 2 player (and the Winamp-inspired Spotiamp client). It runs entirely in the same ES5/XMLHttpRequest frontend — it is a CSS/JS skin of the existing dashboard, not the Webamp browser bundle — so it keeps working on the iPad 2 running Safari on iOS 9.3.6.

The mode is made of four free-floating **modules** whose layout and look mirror Webamp's windows:

- **Main window** — the player: current track in a scrolling marquee, album art, a bouncing-bar "oscilloscope" that animates while playing, elapsed/total time, a seekbar, and previous/play/stop/pause/next controls plus a volume bar. All playback buttons drive Spotify through the same allowlisted command API as the regular player.
- **Playlist Editor** — Spotify queue/track list rendered as green-on-black rows (Webamp's playlist palette); the currently playing row is highlighted.
- **Equalizer** — the 10 Winamp EQ bands (60Hz–16kHz) plus preamp as draggable vertical sliders with live dB readout, and **ON/AUTO** toggles. Equalizer bands are a visual control (a canvas fade), not actual audio DSP, since the iPad 2 exposes no Web Audio EQ.
- **Milkdrop** — a canvas visualizer that draws reactive waveform bars while music plays. It is a CSS/canvas stand-in (a 2D oscilloscope gradient), because Milkdrop's real renderer needs WebGL/Butterchurn, which the iPad 2 GPU does not provide.

Every module has a title bar with a **shade** (▬) and **close** (×) control, and every module can be **dragged** around the screen, with snap-to-grid so windows align against each other and the screen edges. Choose **Exit Winamp** to return to the regular dashboard.

Playback controls generally require a Spotify Premium account and an active controllable Spotify device. The dashboard does not play audio itself.

## Vercel endpoints

- `/api/auth/login` — starts Spotify authorization
- `/api/auth/callback` — exchanges the authorization code and creates a pairing code
- `/api/auth/pair` — claims a one-time pairing code
- `/api/auth/logout` — deletes the current server-side session
- `/api/spotify/currently-playing` — returns playback state and stores the latest observed track
- `/api/spotify/command` — allowlisted play, pause, next, previous, and play_artist (artist radio) commands
- `/api/spotify/search-artist` — searches Spotify for artists by name
- `/api/badge/create` — creates an authenticated public badge key
- `/api/badge/<key>.svg` — returns the public GitHub-compatible SVG card

## Public-service notice and hardening

This is an independent hobby project and is **not operated, sponsored, endorsed, or maintained by Spotify**. Spotify is a trademark of Spotify AB. This project uses Spotify’s public Web API under the account holder’s own authorization and is not an official Spotify client.

If you deploy this repository publicly, visitors can use your Vercel deployment and shared Spotify Developer application. They may consume Vercel Function invocations, Redis operations, and Spotify API quota. The included API applies lightweight Redis-backed per-IP limits to login starts, OAuth callbacks, pairing attempts, playback polling, playback commands, badge creation, and badge requests. These limits reduce casual abuse but are not a complete DDoS or identity system; monitor your Vercel and Redis usage and disable or protect the deployment if it is abused.

The **Disconnect** button calls `/api/auth/logout`, deletes the active server-side session where possible, and clears the browser cookie. Users should also revoke this app from their Spotify account settings if they want to remove its authorization completely.

A public badge reveals the selected account’s last observed track metadata and album artwork. Do not create a public badge if that listening information should remain private.

Before making a repository public, audit the complete Git history for credentials. Environment variables must remain only in Vercel. If a secret has ever been committed, rotate it even if the file was later deleted.

The deployment includes security hardening headers (Content Security Policy, HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy) applied via `vercel.json` on static routes and programmatically on API responses. These mitigate XSS, clickjacking, MIME-sniffing, and protocol-downgrade attacks.

## iPad 2 compatibility

The frontend intentionally avoids `fetch`, ES modules, promises, `async`/`await`, `let` and `const`, service workers, Web Crypto requirements, and modern build-tool dependencies.

It uses ES5 JavaScript, `XMLHttpRequest`, old Safari-safe markup, and iOS Home Screen metadata. Vercel Functions run server-side and are independent of the iPad’s old JavaScript engine.

## Limitations

Vercel cannot force interactive Spotify login to remain inside an iOS 9 standalone Home Screen window. The pairing flow is intentional: login takes place in normal Safari or another browser, and the authenticated session is then transferred to the fullscreen app using a one-time code.

The badge represents the last track observed while the paired app was polling. It is not a continuous Spotify listening-history monitor. GitHub image caching can delay visible updates.

GitHub Pages alone cannot safely store the Spotify Client Secret or maintain the shared pairing/session state required by this flow.

## License

MIT.

## Important: shared public deployment versus your own fork

The public URL `https://ipad2spotify.vercel.app/` is a shared deployment operated by the repository owner. It is convenient for trying the app, but it means your Spotify authorization request and OAuth callback pass through that owner’s Vercel Functions. The resulting server-side refresh token is stored in the Redis database connected to that deployment, and playback requests and badge records are also processed there. The Client Secret is not sent to your browser, but the deployment owner controls the server code, environment configuration, logs, storage account, and future updates.

**No guarantee is made about the safety or availability of Spotify accounts authorized through the shared deployment.** Do not use the shared URL if you are not comfortable trusting its operator with the server-side handling of your Spotify authorization session. This project is an independent hobby project, not operated by Spotify, and the public deployment may change, be disabled, or be abused by third parties.

For better security and control, fork the repository and deploy your own copy to your own Vercel project. With a self-hosted deployment:

- your own Spotify Developer app supplies the Client ID and Client Secret;
- OAuth callbacks go to your Vercel project rather than the shared deployment;
- your own Upstash Redis database stores pairing records, sessions, and badge mappings;
- your Spotify refresh tokens remain under your Vercel/Redis account and configuration;
- you control source-code changes, environment-variable access, logs, domains, rate limits, and deletion of stored sessions;
- you can revoke or rotate your own Spotify and Redis credentials without affecting other users.

Self-hosting does not remove all risk: Vercel, Upstash, Spotify, GitHub, and your own configuration remain part of the trust chain. It does, however, remove the repository owner’s shared server and storage from the OAuth path and gives you substantially better control over your credentials and data.

For personal use, the recommended setup is to fork the repository, create your own Spotify Developer app, create your own Upstash Redis database, add your own Vercel environment variables, and use your own production URL. Follow the [Fork and deploy your own copy](#fork-and-deploy-your-own-copy) instructions above.
