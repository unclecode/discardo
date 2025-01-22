=== manifest.json ===
{
  "manifest_version": 3,
  "name": "Auto Tab Discarder",
  "version": "1.0",
  "description": "Automatically discards inactive tabs after a specified time period",
  "permissions": [
    "tabs",
    "storage",
    "alarms"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  }
}

==========================

=== background.js ===
// background.js
let inactiveTime = 30; // Default 30 minutes

// Load settings
chrome.storage.sync.get(['inactiveTime'], (result) => {
  if (result.inactiveTime) {
    inactiveTime = result.inactiveTime;
  }
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'settingsUpdated') {
    chrome.storage.sync.get(['inactiveTime'], (result) => {
      inactiveTime = result.inactiveTime;
      resetAlarms();
    });
  }
});

// Track tab activity
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabTimer(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateTabTimer(tabId);
  }
});

function updateTabTimer(tabId) {
  // Clear existing alarm for this tab
  chrome.alarms.clear(`tab-${tabId}`);
  
  // Create new alarm
  chrome.alarms.create(`tab-${tabId}`, {
    delayInMinutes: inactiveTime
  });
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('tab-')) {
    const tabId = parseInt(alarm.name.split('-')[1]);
    chrome.tabs.get(tabId, (tab) => {
      if (tab && !tab.active && !tab.discarded) {
        chrome.tabs.discard(tabId);
      }
    });
  }
});

function resetAlarms() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.active && !tab.discarded) {
        updateTabTimer(tab.id);
      }
    });
  });
}

==========================

=== popup.html ===
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      width: 300px;
      padding: 10px;
    }
    .setting {
      margin: 10px 0;
    }
    .test-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
    }
    select {
      width: 100%;
      margin: 10px 0;
      padding: 5px;
    }
    button {
      margin: 5px;
      padding: 5px 10px;
    }
    .tab-status {
      margin-top: 10px;
      font-size: 0.9em;
      color: #666;
    }
    .stats-section {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
    }
    .memory-stats {
      margin: 10px 0;
      line-height: 1.5;
    }
    .memory-stats div {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <h2>Auto Tab Discarder Settings</h2>
  <div class="setting">
    <label for="inactiveTime">Discard tabs after (minutes):</label>
    <input type="number" id="inactiveTime" min="1" value="30">
  </div>
  <button id="save">Save Settings</button>

  <div class="test-section">
    <h3>Test Discard</h3>
    <select id="tabSelector"></select>
    <div>
      <button id="discardSelected">Discard Selected Tab</button>
      <button id="refreshList">Refresh Tab List</button>
    </div>
    <div class="tab-status" id="tabStatus"></div>
  </div>
  
  <div class="stats-section test-section">
    <h3>Memory Stats</h3>
    <div class="memory-stats">
      <div>Total Memory: <span id="totalMemory">calculating...</span></div>
      <div>Discarded Tabs: <span id="discardedCount">0</span></div>
      <div>Estimated Memory Saved: <span id="memorySaved">0 MB</span></div>
    </div>
    <button id="refreshStats">Refresh Stats</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>

==========================

=== popup.js ===
// popup.js
// Function to populate tab dropdown
async function populateTabDropdown() {
  const tabs = await chrome.tabs.query({});
  const select = document.getElementById('tabSelector');
  select.innerHTML = '';
  
  tabs.forEach(tab => {
    const option = document.createElement('option');
    option.value = tab.id;
    option.textContent = `${tab.title?.substring(0, 50)}${tab.title?.length > 50 ? '...' : ''}`;
    option.title = tab.title; // Full title on hover
    if (tab.discarded) {
      option.textContent += ' (Discarded)';
    }
    select.appendChild(option);
  });
}

// Initial population of dropdown and stats
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    populateTabDropdown(),
    updateMemoryStats()
  ]);
});

// Save settings
document.getElementById('save').addEventListener('click', () => {
  const inactiveTime = document.getElementById('inactiveTime').value;
  chrome.storage.sync.set({ inactiveTime: parseInt(inactiveTime) }, () => {
    chrome.runtime.sendMessage({ type: 'settingsUpdated' });
    document.getElementById('tabStatus').textContent = 'Settings saved!';
  });
});

// Load saved settings
chrome.storage.sync.get(['inactiveTime'], (result) => {
  if (result.inactiveTime) {
    document.getElementById('inactiveTime').value = result.inactiveTime;
  }
});

// Function to format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to update memory statistics
async function updateMemoryStats() {
  try {
    // Get tab info
    const tabs = await chrome.tabs.query({});
    const totalTabs = tabs.length;
    const discardedCount = tabs.filter(tab => tab.discarded).length;
    const activeTabs = totalTabs - discardedCount;
    
    // Estimate memory (rough estimate of 100MB per active tab)
    const estimatedMemory = activeTabs * 100 * 1024 * 1024; // 100MB in bytes per active tab
    const memorySaved = discardedCount * 100 * 1024 * 1024; // 100MB per discarded tab
    
    // Update UI
    document.getElementById('totalMemory').textContent = 
      `~${formatBytes(estimatedMemory)} (${activeTabs} active tabs)`;
    document.getElementById('discardedCount').textContent = 
      `${discardedCount} of ${totalTabs} tabs`;
    document.getElementById('memorySaved').textContent = 
      `~${formatBytes(memorySaved)}`;
  } catch (error) {
    console.error('Error updating memory stats:', error);
    document.getElementById('totalMemory').textContent = 'Not available';
  }
}

// Manual discard button
document.getElementById('discardSelected').addEventListener('click', async () => {
  const select = document.getElementById('tabSelector');
  const tabId = parseInt(select.value);
  const statusDiv = document.getElementById('tabStatus');
  
  try {
    await chrome.tabs.discard(tabId);
    statusDiv.textContent = 'Tab successfully discarded!';
    // Refresh the dropdown and stats
    await Promise.all([
      populateTabDropdown(),
      updateMemoryStats()
    ]);
  } catch (error) {
    statusDiv.textContent = `Error: ${error.message}`;
  }
});

// Refresh list button
document.getElementById('refreshList').addEventListener('click', async () => {
  await Promise.all([
    populateTabDropdown(),
    updateMemoryStats()
  ]);
  document.getElementById('tabStatus').textContent = 'Tab list and stats refreshed!';
});

// Refresh stats button
document.getElementById('refreshStats').addEventListener('click', async () => {
  await updateMemoryStats();
  document.getElementById('tabStatus').textContent = 'Memory stats updated!';
});

==========================

=== README.md ===
# El Discardo 🦹‍♂️

> Your memory's liberator - keeping your tabs "open" while freeing your RAM!

## The Origin Story

While developing [Crawl4AI](https://github.com/unclecode/crawl4ai) (your best crawling library 🚀), I became obsessed with browser memory optimization. That's when I engaged more with Chrome's tab discarding feature - a hidden gem that frees up memory by unloading inactive tabs while keeping them visually "open".

But why wait for Chrome to decide? Why not take control? Thus, El Discardo was born - your browser's memory liberator! It helps you keep all those tabs you love "open" while dramatically reducing memory usage. When you need a tab back, it simply reloads - giving you the best of both worlds.

## What El Discardo Does

- **Smart Discarding**: Automatically unloads inactive tabs while keeping them visually present
- **Instant Revival**: Tabs reload only when you need them
- **Memory Freedom**: Keep hundreds of tabs "open" with minimal memory impact
- **Stay Organized**: Search through your tabs, preview content, and chat about them - all while keeping your memory usage low

## Why You Need This

Do you:
- Keep tabs open for days (or weeks)?
- Use your browser as a "read later" list?
- Notice your browser eating up RAM?

El Discardo lets you maintain your tab hoarding habits without the performance penalty!

## Get Started

1. Install the extension
2. Let El Discardo free your memory
3. Enjoy your tabs without the guilt!

## Stay Connected

- Follow me [@unclecode](https://twitter.com/unclecode) on X (Twitter)
- Check out [Crawl4AI](https://github.com/unclecode/crawl4ai)
- Share your memory-saving stories!

---

Made with 💪 and a passion for memory optimization by [@unclecode](https://twitter.com/unclecode)

==========================

