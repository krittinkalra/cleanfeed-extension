chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Received message:", request.type);

  const handleMessage = async () => {
    try {
      if (request.type === 'ANALYZE_TWEET' || request.type === 'TEST_CONNECTION') {
        const text = request.type === 'TEST_CONNECTION' ? "This is a test." : request.text;
        const result = await performRequest(text, request.apiToken);
        sendResponse({ success: true, score: result.score });
      }
    } catch (err) {
      console.error("[Background] Error:", err);
      sendResponse({ success: false, error: err.message || "Unknown error" });
    }
  };

  handleMessage();
  return true;
});

async function performRequest(text, apiToken) {
  if (!apiToken) throw new Error("Missing API token");

  const response = await fetch('https://cleanfeed.social/api/detect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return { score: data.confidence };
}