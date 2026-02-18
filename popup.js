document.addEventListener('DOMContentLoaded', () => {
  const apiTokenInput = document.getElementById('apiToken');
  const thresholdInput = document.getElementById('threshold');
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  const masterSwitch = document.getElementById('masterSwitch');
  const statusDiv = document.getElementById('status');
  const saveBtn = document.getElementById('save');
  const testBtn = document.getElementById('test-btn');

  // Load saved settings
  chrome.storage.local.get(['apiToken', 'threshold', 'extensionEnabled'], (data) => {
    if (data.apiToken) apiTokenInput.value = data.apiToken;
    
    // Set Slider and Display
    if (data.threshold) {
      thresholdInput.value = data.threshold;
      thresholdDisplay.textContent = data.threshold;
    }

    // Default to true if undefined
    masterSwitch.checked = data.extensionEnabled !== false;
  });

  // Update the number display as the user drags the slider
  thresholdInput.addEventListener('input', (e) => {
    thresholdDisplay.textContent = e.target.value;
  });

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = type === 'success' ? 'status-success' : 'status-error';
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
  }

  // Handle Master Switch changes immediately
  masterSwitch.addEventListener('change', () => {
    chrome.storage.local.set({ extensionEnabled: masterSwitch.checked });
  });

  testBtn.addEventListener('click', () => {
    const apiToken = apiTokenInput.value.trim();
    if (!apiToken) return showStatus('Enter an API token', 'error');

    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', apiToken }, (response) => {
      testBtn.textContent = 'Test';
      testBtn.disabled = false;
      
      if (chrome.runtime.lastError) return showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
      if (response && response.success) showStatus('Verified!', 'success');
      else showStatus('Invalid Token', 'error');
    });
  });

  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      apiToken: apiTokenInput.value.trim(),
      threshold: thresholdInput.value,
      extensionEnabled: masterSwitch.checked
    }, () => {
      showStatus('Settings Saved', 'success');
    });
  });
});