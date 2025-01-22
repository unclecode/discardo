// background.js
let inactiveTime = 30; // Default 30 minutes
let whitelist = []; // Array to store whitelisted domains

// Load settings
chrome.storage.sync.get(['inactiveTime', 'whitelist'], (result) => {
  if (result.inactiveTime) {
    inactiveTime = result.inactiveTime;
  }
  if (result.whitelist) {
    whitelist = result.whitelist;
  }
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'settingsUpdated') {
    chrome.storage.sync.get(['inactiveTime', 'whitelist'], (result) => {
      inactiveTime = result.inactiveTime;
      whitelist = result.whitelist || [];
      resetAlarms();
    });
  }
});

// Function to extract domain from URL
function getDomain(url) {
    try {
      // Handle chrome:// URLs
      if (url.startsWith('chrome://')) {
        return 'chrome://internal';
      }
      
      // Handle edge:// URLs
      if (url.startsWith('edge://')) {
        return 'edge://internal';
      }
      
      // Handle about: URLs
      if (url.startsWith('about:')) {
        return 'about:internal';
      }
      
      // Handle file:// URLs
      if (url.startsWith('file://')) {
        return 'file://local';
      }
      
      // Handle empty or invalid URLs
      if (!url || url === 'about:blank' || url === 'about:newtab') {
        return 'about:blank';
      }
  
      // For regular URLs, parse normally
      return new URL(url).hostname;
    } catch (e) {
      console.error('Error parsing URL:', e, 'URL:', url);
      return 'invalid:url';
    }
  }

// Function to check if a URL is whitelisted
function isWhitelisted(url) {
  const domain = getDomain(url);
  return domain && whitelist.includes(domain);
}

// Track tab activity
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabTimer(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateTabTimer(tabId);
  }
});

async function updateTabTimer(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Don't set timer for whitelisted sites
    if (isWhitelisted(tab.url)) {
      chrome.alarms.clear(`tab-${tabId}`);
      return;
    }

    // Clear existing alarm for this tab
    chrome.alarms.clear(`tab-${tabId}`);

    // Create new alarm
    chrome.alarms.create(`tab-${tabId}`, {
      delayInMinutes: inactiveTime
    });
  } catch (error) {
    console.error('Error updating tab timer:', error);
  }
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('tab-')) {
    const tabId = parseInt(alarm.name.split('-')[1]);
    chrome.tabs.get(tabId, (tab) => {
      if (tab && !tab.active && !tab.discarded && !isWhitelisted(tab.url)) {
        chrome.tabs.discard(tabId);
      }
    });
  }
});

function resetAlarms() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.active && !tab.discarded && !isWhitelisted(tab.url)) {
        updateTabTimer(tab.id);
      }
    });
  });
}