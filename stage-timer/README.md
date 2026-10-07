# Stage Timer

Countdown timer, programme schedule and HDMI / browser-source output for stage production. Runs fully offline.

## 1. One-time setup (ADMIN)
```
npm install
npm run keygen:init          # creates keys/private.pem (keep secret, back up!) and src/public.pem
```
- The interface and stage display use **Poppins** (bundled, open source). Montserrat and Bebas Neue are bundled too. Users can add any font installed on their PC (5 free, 20 paid).
- Deploy `server/` (see below) and put its HTTPS address in `src/config.json` → `serverUrl`, and in `package.json` → `build.publish[0].url` (`…/updates/`).

## 2. Run / build
```
npm start                    # run in development
npm run dist:win             # Windows installer  -> dist/Stage Timer Setup 1.0.0.exe   (run on Windows)
npm run dist:mac             # macOS .dmg (Intel + Apple Silicon)                         (run on a Mac)
```
No Mac or PC handy? Push this folder to GitHub and run **Actions → Build installers**; it builds both and attaches them as downloads.

## 3. Backend (`server/`)
`cd server && npm i express nodemailer`, then set env vars (listed at the top of `server/index.js`) and run `node index.js` behind HTTPS.
- The server needs `keys/private.pem` (from `npm run keygen:init`) to issue keys. Never ship it inside the app.
- Create a Paystack Ghana account (MTN, Telecel, AirtelTigo, Visa), set your settlement account there (your admin number lives only in server env/Paystack), and add webhook `https://YOUR-SERVER/webhook`.
- **Price:** open `https://YOUR-SERVER/admin`, enter `ADMIN_TOKEN`, set the price. The app's Upgrade tab shows it.
- **Admin alerts:** every sale emails `mystagetimer@gmail.com` (Gmail: `SMTP_URL=smtps://mystagetimer%40gmail.com:APP_PASSWORD@smtp.gmail.com`) and sends an SMS to the admin number.
- **Licences:** keys are permanent, signed, emailed to the buyer, and limited to 5 PCs (tracked by machine ID at activation). Manual keys (`npm run keygen:issue`) work the same way.
- **Updates:** after `npm run dist:win` / `dist:mac`, upload the files in `dist/` (including `latest.yml` / `latest-mac.yml`) to the server's `dist/` folder.

## Output
- **HDMI**: Timer tab → pick the display → *Open output*.
- **NDI / OBS / vMix**: add a Browser Source → `http://127.0.0.1:4777/output.html`, then send it out with the OBS NDI plugin (DistroAV) or NDI Screen Capture.
- Space bar starts/pauses the timer.
