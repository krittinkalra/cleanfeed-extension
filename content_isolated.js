// --- 1. Configuration & Logger ---
const CONFIG = {
  excludedPaths: ['/settings', '/messages', '/compose', '/notifications'],
  neonColor: '#ccff00'
};

const Logger = {
  prefix: '%c[CleanFeed]',
  styleInfo: `color: ${CONFIG.neonColor}; font-weight: bold; background: #222; padding: 2px 5px; border-radius: 3px;`,
  log: (msg) => console.log(`${Logger.prefix} ${msg}`, Logger.styleInfo)
};

// --- 2. Master Switch Logic ---
let isExtensionEnabled = true;

// Inject toggle styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  /* When this class is on body, hide all CleanFeed overlays */
  body.cleanfeed-disabled .cleanfeed-overlay {
    display: none !important;
  }
`;
document.head.appendChild(styleSheet);

function updateExtensionState(enabled) {
  isExtensionEnabled = enabled;
  if (enabled) {
    document.body.classList.remove('cleanfeed-disabled');
    Logger.log("Extension Enabled");
  } else {
    document.body.classList.add('cleanfeed-disabled');
    Logger.log("Extension Disabled");
  }
}

// Initial Load
chrome.storage.local.get(['extensionEnabled'], (data) => {
  // Default to true if undefined
  updateExtensionState(data.extensionEnabled !== false);
});

// Listen for live toggle changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.extensionEnabled) {
    updateExtensionState(changes.extensionEnabled.newValue);
  }
});

// --- 3. Caching System ---
const knownTweets = new Map();

// --- 4. UI Blurring Logic ---
function blurTweet(article, tweetId, score) {
  if (article.querySelector('.cleanfeed-overlay')) return;

  const overlay = document.createElement("div");
  overlay.className = 'cleanfeed-overlay';
  overlay.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 10;
    background: rgba(0, 0, 0, 0.75); 
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    transition: opacity 0.3s ease;
  `;
  
  overlay.innerHTML = `
    <div style="font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.5px;">
      <span style="color: ${CONFIG.neonColor}">AI</span> DETECTED
    </div>
    <div style="font-size: 12px; color: #aaa; font-family: monospace;">Confidence: ${score}/10</div>
    <button id="rev-${tweetId}" style="
      padding: 8px 16px; cursor: pointer; background: transparent; 
      border: 1px solid #555; border-radius: 20px; color: #fff; 
      font-weight: 600; font-size: 12px; transition: all 0.2s;
    ">View Reply</button>
  `;

  article.style.position = "relative";
  article.appendChild(overlay);

  const btn = document.getElementById(`rev-${tweetId}`);
  if(btn) {
    btn.onmouseover = () => { btn.style.borderColor = CONFIG.neonColor; btn.style.color = CONFIG.neonColor; };
    btn.onmouseout = () => { btn.style.borderColor = "#555"; btn.style.color = "#fff"; };
    btn.onclick = (e) => {
      e.stopPropagation();
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 300);
      knownTweets.set(tweetId, { ...knownTweets.get(tweetId), forceShow: true });
    };
  }
}

// --- 5. Main Processor ---
async function processTweet(article) {
  // If disabled, stop processing immediately
  if (!isExtensionEnabled) return;

  const currentPath = window.location.pathname;
  if (CONFIG.excludedPaths.some(path => currentPath.startsWith(path))) return;

  const timeElement = article.querySelector('time');
  const linkElement = timeElement ? timeElement.closest('a') : null;
  if (!linkElement) return;
  
  const href = linkElement.getAttribute('href'); 
  const idMatch = href.match(/\/status\/(\d+)/);
  if (!idMatch) return;
  
  const tweetId = idMatch[1];

  if (knownTweets.has(tweetId)) {
    const data = knownTweets.get(tweetId);
    if (data.isAI && !data.forceShow) {
      blurTweet(article, tweetId, data.score);
    }
    return;
  }

  knownTweets.set(tweetId, { processing: true });

  const textDiv = article.querySelector('[data-testid="tweetText"]');
  if (!textDiv) return;
  
  const text = textDiv.innerText.replace(/\s+/g, ' ').trim();
  if (text.length < 30) return; 

  chrome.storage.local.get(['apiToken', 'threshold'], (settings) => {
    if (!settings.apiToken) return;
    // Double check enabled state before sending API request
    if (!isExtensionEnabled) return; 

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_TWEET', text, apiToken: settings.apiToken },
      (response) => {
        if (!response || !response.success) {
           knownTweets.delete(tweetId);
           return;
        }

        const threshold = parseInt(settings.threshold || 7, 10);
        const isAI = response.score >= threshold;

        knownTweets.set(tweetId, { score: response.score, isAI: isAI, forceShow: false });

        if (isAI) {
          blurTweet(article, tweetId, response.score);
        }
      }
    );
  });
}

// --- 6. Observer ---
const observer = new MutationObserver((mutations) => {
  if (!isExtensionEnabled) return; // Optional: pause observer logic completely

  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) {
        if (node.tagName === 'ARTICLE' && node.getAttribute('data-testid') === 'tweet') {
          processTweet(node);
        } else if (node.querySelectorAll) {
          const tweets = node.querySelectorAll('article[data-testid="tweet"]');
          tweets.forEach(processTweet);
        }
      }
    });
  }
});

const timeline = document.querySelector('div[id="react-root"]');
if (timeline) {
  observer.observe(timeline, { childList: true, subtree: true });
} else {
  setTimeout(() => {
    const retryTimeline = document.querySelector('div[id="react-root"]');
    if (retryTimeline) observer.observe(retryTimeline, { childList: true, subtree: true });
  }, 2000);
}