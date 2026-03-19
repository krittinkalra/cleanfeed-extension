# :shield: CleanFeed - AI Reply Filter

[![Available in the Chrome Web Store](chrome-web-store.png)](https://chromewebstore.google.com/detail/cleanfeed/mpjebbcgfmhcjkmofceodkhplloccijg)

**CleanFeed** is a Chrome Extension that automatically detects and hides AI-generated replies (LLM slop) across your favorite social networks. It uses advanced detection to keep your feed human-centric, applying a beautiful glassmorphism blur to suspected AI content.

![CleanFeed Banner](banner.png)

## :sparkles: Features

- **:globe_with_meridians: Multi-Platform Support:** Works seamlessly across **X (Twitter)**, **Reddit**, and **LinkedIn**.
- **:arrows_counterclockwise: Dynamic Rule Updates:** UI rules are fetched dynamically from GitHub. If a platform changes its layout, CleanFeed updates automatically behind the scenes—no waiting for Chrome Web Store reviews!
- **:robot: Real-time Detection:** Automatically scans new posts and comments as you scroll using the MutationObserver API.
- **:gem: Glassmorphism UI:** Blurs AI text with a modern, dark-mode friendly frosted glass overlay while keeping the author's profile visible.
- **:zap: Smart Caching:** Remembers analyzed content to prevent API spam and "flickering" when scrolling up and down.
- **:control_knobs: Adjustable Sensitivity:** Use the slider to choose between Aggressive (catch everything) or Strict (high confidence only) filtering.
- **:electric_plug: Master Switch:** Instantly toggle the extension on/off without reloading the page.
- **:lock: Privacy Focused:** Only analyzes post/comment text. Does not run on DMs, Settings, or Compose pages.

## :computer: Installation

### Install via Chrome Web Store (Recommended)
You can install the official, stable release directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/cleanfeed/mpjebbcgfmhcjkmofceodkhplloccijg).

### Manual Installation (Developer Mode)
If you want to contribute or run the latest development build:
1. **Clone or Download** this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing these files.

## :gear: Configuration

1. **Get your API Token:**
   Sign up at [**cleanfeed.social**](https://cleanfeed.social) to generate your API key.
2. **Open the Extension:**
   Click the CleanFeed logo in your browser toolbar.
3. **Enter Credentials:**
   Paste your Token into the input field.
4. **Test & Save:**
   Click "Test" to verify connectivity, then "Save".

## :file_folder: Project Structure

- **`manifest.json`** - Extension configuration (Manifest V3).
- **`rules.json`** - The dynamic CSS selector rules for all supported platforms.
- **`background.js`** - Service worker that handles API requests and syncs UI rules from GitHub.
- **`content_isolated.js`** - The core logic (DOM observation, JSON rule interpreter, UI injection, caching).
- **`popup.html` / `popup.js`** - The settings UI with the neon dark theme and slider controls.
- **`icons/`** - Application icons.

## :lock: Privacy & Permissions

This extension requires the following permissions:
- `storage`: To save your API token, preferences, and cached UI rules locally.
- `alarms`: To periodically fetch the latest platform rules from GitHub.
- `host_permissions`: To analyze text on supported social media sites and pull updates from GitHub.

**Note:** The extension sends the text of posts/comments found on your timeline to the configured API endpoint for analysis. No personal user data (cookies, session IDs) is collected or sent.

## :scroll: License

This project is licensed under the MIT License.