console.log("%c[CleanFeed] FILE INJECTED SUCCESSFULLY!", "background: red; color: white; font-size: 16px; font-weight: bold;");

// --- 1. Configuration & Logger ---
const CONFIG = {
  excludedPaths: ['/settings', '/messages', '/messaging', '/compose', '/notifications', '/chat'],
  neonColor: '#ccff00'
};

const Logger = {
  prefix: '%c[CleanFeed]',
  styleInfo: `color: ${CONFIG.neonColor}; font-weight: bold; background: #222; padding: 2px 5px; border-radius: 3px;`,
  log: (msg) => console.log(`${Logger.prefix} ${msg}`, Logger.styleInfo)
};

// --- 2. Dynamic Rule Interpreter ---
let activePlatformRules = null;

// The interpreter reads the JSON blocks to extract the right target/text
function resolveRule(node, ruleArray) {
  if (!ruleArray) return null;
  
  for (const rule of ruleArray) {
    let target = node;

    // 1. Check condition (e.g. data-testid="expandable-text-box")
    if (rule.conditionAttr && target.getAttribute(rule.conditionAttr) !== rule.conditionValue) continue;

    // 2. Find target
    if (rule.selector && rule.selector !== 'self') {
      target = node.querySelector(rule.selector);
    }
    if (!target) continue;

    // 3. Traverse upwards if needed
    if (rule.closest) {
      target = target.closest(rule.closest);
      if (!target) continue;
    }
    if (rule.parentElement) {
      target = target.parentElement;
      if (!target) continue;
    }

    // 4. Extract raw value
    let val = target; // Defaults to the node itself (used for blurTargets)
    if (rule.attribute) val = target.getAttribute(rule.attribute);
    else if (rule.property) val = target[rule.property];

    if (val == null) continue;

    // 5. String manipulation
    if (typeof val === 'string') {
      if (rule.extractRegex) {
        const match = val.match(new RegExp(rule.extractRegex));
        if (match && match[1]) {
          val = match[1];
        } else {
          continue; // Regex failed to match, try next rule
        }
      }
      if (rule.removeRegex) {
        val = val.replace(new RegExp(rule.removeRegex, 'i'), '').trim();
      }
    }

    // If we successfully got a value (or a DOM node), return it immediately
    if (val) return val;
  }
  return null;
}

const DynamicPlatform = {
  selectors: () => activePlatformRules ? activePlatformRules.selectors : null,
  getId: (node) => {
    let id = resolveRule(node, activePlatformRules.id);
    
    // Fallback: Hash the first 40 chars of text to prevent duplicate API spam
    if (!id && activePlatformRules.fallbackIdToTextHash) {
      const text = (node.innerText || "").trim();
      if (text.length > 0) {
        id = 'li_txt_' + text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
      }
    }
    return id;
  },
  getText: (node) => resolveRule(node, activePlatformRules.text),
  getBlurTarget: (node) => resolveRule(node, activePlatformRules.blurTarget) || node
};

// --- 3. Master Switch Logic ---
let isExtensionEnabled = true;

// Safely inject styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  body.cleanfeed-disabled .cleanfeed-overlay { display: none !important; }
`;
(document.head || document.documentElement).appendChild(styleSheet);

function updateExtensionState(enabled) {
  isExtensionEnabled = enabled;
  if (enabled) {
    document.body.classList.remove('cleanfeed-disabled');
    Logger.log("Extension Enabled & Active on " + window.location.hostname);
  } else {
    document.body.classList.add('cleanfeed-disabled');
    Logger.log("Extension Disabled");
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.extensionEnabled) {
      updateExtensionState(changes.extensionEnabled.newValue);
    }
    if (changes.remoteRules) {
      Logger.log("Remote rules updated from GitHub! Re-initializing...");
      initialize(changes.remoteRules.newValue);
    }
  }
});

// --- 4. Caching System ---
const knownContent = new Map();

// --- 5. UI Blurring Logic ---
function blurContent(targetNode, contentId, score) {
  if (targetNode.querySelector('.cleanfeed-overlay')) return;

  const computedStyle = window.getComputedStyle(targetNode);
  if (computedStyle.position === 'static') {
    targetNode.style.position = "relative";
  }

  // UI FIX: Apply minimum height so short comments don't clip our button
  const originalMinHeight = targetNode.style.minHeight;
  targetNode.style.minHeight = '120px';

  const overlay = document.createElement("div");
  overlay.className = 'cleanfeed-overlay';
  overlay.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 999;
    background: rgba(0, 0, 0, 0.85); 
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    border-radius: inherit;
    transition: opacity 0.3s ease;
  `;
  
  overlay.innerHTML = `
    <div style="font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.5px; line-height: 1;">
      <span style="color: ${CONFIG.neonColor}">AI</span> DETECTED
    </div>
    <div style="font-size: 12px; color: #aaa; font-family: monospace; margin-bottom: 4px;">Confidence: ${score}/10</div>
    <button id="rev-${contentId}" style="
      padding: 6px 14px; cursor: pointer; background: transparent; 
      border: 1px solid #555; border-radius: 20px; color: #fff; 
      font-weight: 600; font-size: 12px; transition: all 0.2s;
    ">View Content</button>
  `;

  targetNode.appendChild(overlay);

  const btn = overlay.querySelector(`#rev-${contentId}`);
  if(btn) {
    btn.onmouseover = () => { btn.style.borderColor = CONFIG.neonColor; btn.style.color = CONFIG.neonColor; };
    btn.onmouseout = () => { btn.style.borderColor = "#555"; btn.style.color = "#fff"; };
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      overlay.style.opacity = "0";
      targetNode.style.minHeight = originalMinHeight; // Reset height to normal
      setTimeout(() => overlay.remove(), 300);
      knownContent.set(contentId, { ...knownContent.get(contentId), forceShow: true });
    };
  }
}

// --- 6. Main Processor ---
async function processContentNode(node) {
  if (!isExtensionEnabled || !activePlatformRules) return;

  const currentPath = window.location.pathname;
  if (CONFIG.excludedPaths.some(path => currentPath.startsWith(path))) return;

  const contentId = DynamicPlatform.getId(node);
  if (!contentId) return;

  if (knownContent.has(contentId)) {
    const data = knownContent.get(contentId);
    if (data.isAI && !data.forceShow) {
      const targetNode = DynamicPlatform.getBlurTarget(node);
      if (targetNode) blurContent(targetNode, contentId, data.score);
    }
    return;
  }

  knownContent.set(contentId, { processing: true });

  const rawText = DynamicPlatform.getText(node);
  if (!rawText) return;
  
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (text.length < 30) return; 

  chrome.storage.local.get(['apiToken', 'threshold'], (settings) => {
    if (!settings.apiToken || !isExtensionEnabled) return;

    // --- 🛠️ TELEMETRY LOG: SENDING ---
    const startTime = performance.now();
    Logger.log(`⏳ [SENDING] ID: ${contentId} | Text: "${text.substring(0, 35)}..."`);

    chrome.runtime.sendMessage(
      { type: 'ANALYZE_CONTENT', text, apiToken: settings.apiToken },
      (response) => {
        // --- 🛠️ TELEMETRY LOG: RECEIVED ---
        const timeTaken = (performance.now() - startTime).toFixed(0);

        if (!response || !response.success) {
           Logger.log(`❌ [ERROR] ID: ${contentId} | Failed after ${timeTaken}ms | Error: ${response?.error || 'Unknown'}`);
           knownContent.delete(contentId);
           return;
        }

        Logger.log(`✅ [RECEIVED] ID: ${contentId} | Score: ${response.score}/10 | Time: ${timeTaken}ms`);

        const threshold = parseInt(settings.threshold || 7, 10);
        const isAI = response.score >= threshold;

        knownContent.set(contentId, { score: response.score, isAI: isAI, forceShow: false });

        if (isAI) {
          const targetNode = DynamicPlatform.getBlurTarget(node);
          if (targetNode) blurContent(targetNode, contentId, response.score);
        }
      }
    );
  });
}

// --- 7. Observer & Initialization ---
const observer = new MutationObserver((mutations) => {
  if (!isExtensionEnabled || !activePlatformRules) return;

  const selectors = DynamicPlatform.selectors();
  if (!selectors) return;

  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // ELEMENT_NODE
        if (node.matches && node.matches(selectors)) {
          processContentNode(node);
        }
        if (node.querySelectorAll) {
          const items = node.querySelectorAll(selectors);
          items.forEach(processContentNode);
        }
      }
    });
  }
});

function initialize(rules) {
  // Find which platform we are currently on
  activePlatformRules = null;
  for (const [key, ruleSet] of Object.entries(rules)) {
    if (ruleSet.matches.some(domain => window.location.hostname.includes(domain))) {
      activePlatformRules = ruleSet;
      break;
    }
  }

  if (!activePlatformRules) return; // We are not on a supported site

  const target = document.body || document.documentElement;
  if (!target) return;

  // Restart observer cleanly if re-initializing
  observer.disconnect();
  observer.observe(target, { childList: true, subtree: true });
  Logger.log(`Observer attached. Dynamic rules loaded for: ${window.location.hostname}`);
  
  const selectors = DynamicPlatform.selectors();
  if (selectors) {
    document.querySelectorAll(selectors).forEach(processContentNode);
  }
}

// Startup: Fetch storage (extension enabled state + remote rules)
chrome.storage.local.get(['remoteRules', 'extensionEnabled'], (data) => {
  updateExtensionState(data.extensionEnabled !== false);

  // Hardcoded Fallback JSON
  // This ensures the extension works instantly on first install before the background
  // script finishes fetching the rules from GitHub!
  const defaultRules = {
    "twitter": {
      "matches": ["twitter.com", "x.com"],
      "selectors": "article[data-testid='tweet']",
      "id": [ { "selector": "time", "closest": "a", "attribute": "href", "extractRegex": "\\/status\\/(\\d+)" } ],
      "text": [ { "selector": "[data-testid='tweetText']", "property": "innerText" } ],
      "blurTarget": [ { "selector": "self" } ]
    },
    "reddit": {
      "matches": ["reddit.com"],
      "selectors": "shreddit-comment, shreddit-post",
      "id": [ { "selector": "self", "attribute": "thingid" }, { "selector": "self", "attribute": "id" } ],
      "text": [ { "selector": "[slot='comment'], [slot='text-body']", "property": "innerText" } ],
      "blurTarget": [ { "selector": "[slot='comment'], [slot='text-body']" }, { "selector": "self" } ]
    },
    "linkedin": {
      "matches": ["linkedin.com"],
      "selectors": ".feed-shared-update-v2, .comments-comment-item, [data-testid='expandable-text-box']",
      "id": [
        { "selector": "self", "attribute": "data-urn" },
        { "selector": "self", "attribute": "data-id" },
        { "selector": "self", "property": "id" },
        { "selector": "self", "closest": "[componentkey]", "attribute": "componentkey" }
      ],
      "text": [
        { "selector": "self", "conditionAttr": "data-testid", "conditionValue": "expandable-text-box", "property": "innerText", "removeRegex": "…\\s*more$" },
        { "selector": ".feed-shared-update-v2__description-wrapper, .comments-comment-item__main-content, .update-components-text, [data-testid='expandable-text-box']", "property": "innerText", "removeRegex": "…\\s*more$" }
      ],
      "blurTarget": [
        { "selector": "self", "conditionAttr": "data-testid", "conditionValue": "expandable-text-box", "closest": "p" },
        { "selector": "self", "conditionAttr": "data-testid", "conditionValue": "expandable-text-box", "parentElement": true },
        { "selector": ".feed-shared-update-v2__description-wrapper, .comments-comment-item__main-content, .update-components-text" },
        { "selector": "self" }
      ],
      "fallbackIdToTextHash": true
    }
  };

  const rulesToUse = data.remoteRules || defaultRules;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(rulesToUse));
  } else {
    initialize(rulesToUse);
  }
});