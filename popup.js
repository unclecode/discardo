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
