# छठ महापर्व — A Digital Ghat

**Designed with devotion · Created by Abhinav Kumar**

An immersive, responsive, culturally authentic digital Chhath Mahaparv experience dedicated to Lord Surya (Aditya) and Chhathi Maiya. It features live animated ghat atmosphere, 5 ultra-HD scenes, interactive offering detail explorer with authentic prasadam photos, interactive 4-chapter sacred roots story carousel, floating festive feature rail with authentic firecrackers and periodic Hindi ghat announcements, multi-platform social share suite, and a curated 22-song official YouTube compilation chapter radio.

---

## 🌟 Highlights & Features

1. **5 Ultra-HD Ghat Atmosphere Scenes (`01 / 05`)**:
   - `01 / EVENING` — ◑ संध्या अर्घ्य (Sunset Arghya at Holy River Ghat)
   - `02 / MORNING` — ☀ उषा अर्घ्य (Dawn Offering in Morning Mist)
   - `03 / DEVOTION` — ✧ कोसी की रात (Koshi Bharai Mandap with Glowing Clay Diyas)
   - `04 / CELEBRATION` — ✺ घाट आतिशबाज़ी (Festive Twilight Fireworks & Deepmala)
   - `05 / SACRED ARPAN` — 🪔 महाअर्घ्य व सूप (Sacred Arpan in Holy River)
   - Synchronized with the **छठ की जीवंत झाँकी** interactive gallery.

2. **Floating Feature Rail (Inspired by `chhathgeet.com`)**:
   - **Firecracker Sounds**:
     - *Flower pot (अनार)*: Authentic sound + golden particle fountain animation
     - *Ladi (लड़ी)*: Authentic crackle sound + ground spark flashes
     - *Multi-sky shot (मल्टी-स्काई शॉट)*: Rocket flight trajectory + sky burst
   - **Ghaat Announcements**:
     - Interactive iOS-style Toggle Switch
     - Interval slider (1 to 10 minutes, default 9 minutes)
     - 8 authentic Hindi devotional & public safety announcements cycling periodically

3. **Intelligent Central Audio Controller**:
   - **Strict Toggle On/Off**: First click plays; second click (or double tap) instantly stops the sound.
   - **Mutual Exclusion (No Overlapping Cacophony)**: At most 1 foreground festive sound plays alongside the background YouTube music. Triggering another sound cleanly terminates the previous one.
   - **Single Play**: Each sound plays once and stops automatically.

4. **Interactive Pooja Thali & Prasadam Explorer**:
   - Dedicated tabs for Thekua, Soop-Daura, Fruits & Sugarcane, and Koshi.
   - Dynamic photo swap displaying authentic high-definition photographs.
   - Deep cultural, scientific, and ritual explanations.

5. **Interactive Sacred Roots & Wisdom Story Carousel**:
   - 4 illustrated historical & scientific slides:
     - 01: Mata Sita's First Chhath Anushthan (Ramayana Era)
     - 02: Queen Draupadi & Pandavas' Surya Upasana (Mahabharata Era)
     - 03: Solar Energy, Autophagy & Cellular Detoxification (Scientific Perspective)
     - 04: Mother Nature & Complete Social Equality (Cultural Philosophy)
   - Keyboard arrow navigation, pagination buttons, and interactive dot indicators.

6. **22 Curated Sacred Chhath Songs (YouTube Chapter Radio)**:
   - Includes classics by Sharda Sinha, Anuradha Paudwal, Kalpana Patowary, Devi, Pawan Singh, etc.
   - Custom external YouTube playlist loader with local persistence.
   - Independent volume sliders for Music, Effects, and Voice.

7. **Multi-Platform Social Share Suite**:
   - One-click sharing to WhatsApp, Facebook, Instagram (Web Share API with clipboard fallback), and quick message copy.

---

## 🚀 How to Run Locally

### macOS
Double-click `Run Website.command`.

### Windows
Double-click `Run Website.bat`.

### Linux / Terminal
Run:
```bash
python3 -m http.server 8000
```
Then open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 📦 How to Publish / Push to GitHub

1. **Initialize Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Chhath Mahaparv interactive digital ghat"
   ```

2. **Create a Repository on GitHub**:
   - Go to [github.com/new](https://github.com/new)
   - Name it (e.g., `abhinav-chhath-mahaparv`)
   - Keep it Public (for GitHub Pages hosting)

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
   git branch -M main
   git push -u origin main
   ```

4. **Enable GitHub Pages**:
   - In your GitHub repo, go to **Settings → Pages**
   - Under **Build and deployment → Branch**, select `main` and root `/`
   - Click **Save**
   - In ~1 minute, your site will be live at `https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`!

---

## 🔒 Security & Privacy Audit

- **Zero Secrets / Credentials**: No private keys, passwords, or tokens in codebase.
- **XSS Protection**: Zero use of raw `innerHTML` or `eval()`. All user and dynamic inputs are inserted via `textContent` and type-safe DOM methods.
- **Safe Link Handling**: All external links and `window.open` calls use `rel="noopener noreferrer"` and `'noopener,noreferrer'` flags.
- **Privacy First**: No tracking cookies, no third-party analytic trackers, and no unsolicited external data transmission.
- **Offline / Local Fallback**: All critical audio, styles, and imagery are bundled locally within the `assets/` folder.

---

## 📜 Credits & License

**Copyright © 2026 Abhinav Kumar (https://chhathparv.github.io/) · All Rights Reserved.**

See [`LICENSE`](LICENSE) for full terms. This repository is proprietary and is **not** released under an open-source license; copying, mirroring, modifying, or redistributing the source code, layout, or original assets without prior written permission is prohibited.

- **Concept, Design & Development**: Abhinav Kumar
- **Live Site**: [https://chhathparv.github.io/](https://chhathparv.github.io/)
- **Music**: Curated links to official public YouTube compilation chapters (no audio distributed).
- **Artwork & Photography**: Authentic cultural photographs & custom-generated high-definition assets (see `assets/PHOTO_CREDITS.md`).
- Launch scripts for Mac, Windows, and Linux, plus START_HERE.txt.

### Verification notes

Release UI tests were run using an isolated Chromium `about:blank` harness with embedded local HTML/CSS/JS because this container's managed Chromium policy prevents localhost/file navigation. The page was exercised at widths of 320, 390 and 1440px, with no runtime JS errors or horizontal overflow. This cannot prove YouTube remote media streams will play; please check on a normal browser with internet.
