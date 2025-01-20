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
