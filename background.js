const RULES_URL = "https://raw.githubusercontent.com/krittinkalra/cleanfeed-extension/main/rules.json";

// Fetch rules immediately on install/update
chrome.runtime.onInstalled.addListener(() => {
  fetchAndCacheRules();
  // Set an alarm to check for new rules every 12 hours
  chrome.alarms.create("fetchRules", { periodInMinutes: 12 * 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchRules") {
    fetchAndCacheRules();
  }
});

async function fetchAndCacheRules() {
  try {
    const response = await fetch(RULES_URL + "?t=" + Date.now()); // Prevent browser caching
    if (response.ok) {
      const rules = await response.json();
      chrome.storage.local.set({ remoteRules: rules });
      console.log("[Background] Successfully synced UI rules from GitHub");
    }
  } catch (err) {
    console.error("[Background] Failed to fetch remote rules:", err);
  }
}

// Existing Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_CONTENT' || request.type === 'TEST_CONNECTION') {
    const text = request.type === 'TEST_CONNECTION' ? "This is a test." : request.text;
    performRequest(text, request.apiToken)
      .then(result => sendResponse({ success: true, score: result.score }))
      .catch(err => sendResponse({ success: false, error: err.message || "Unknown error" }));
  }
  return true;
});

async function performRequest(text, apiToken) {
  if (!apiToken) throw new Error("Missing API token");
  const response = await fetch('https://cleanfeed.social/api/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return { score: data.confidence };
}