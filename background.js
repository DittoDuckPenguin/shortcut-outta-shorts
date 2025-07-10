// background.js

const CHECK_INTERVAL_MINUTES = 0.5; // Check every 30 seconds
const CHECK_INTERVAL_MINUTES_SHUTDOWN = 2; // Check every 2 minutes
let currentTargetSites = []; // Will be loaded from storage

// Function to load target sites from storage
async function loadTargetSitesFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['targetSites'], (result) => {
      if (result.targetSites) {
        currentTargetSites = result.targetSites;
        console.log("Background: Loaded target sites:", currentTargetSites);
      } else {
        // Default sites if none are in storage (first run of the extension)
        currentTargetSites = ["shorts", "x.com", "instagram", "facebook"];
        chrome.storage.sync.set({ 'targetSites': currentTargetSites }, () => {
          console.log("Background: Initializing default target sites in storage.");
        });
      }
      resolve();
    });
  });
}

// Function to check the current tab's URL
async function checkCurrentTab() {
  await loadTargetSitesFromStorage(); // Ensure the list is up-to-date before checking
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  console.log("Checking", tab);

  if (tab && tab.url) {
    const url = tab.url.toLowerCase();
    // Check if currentTargetSites is defined and not empty
    if (currentTargetSites && currentTargetSites.length > 0) {
      const isOnTargetSite = currentTargetSites.some(site => url.includes(site));

      if (isOnTargetSite) {
        console.log(`Background: Currently on a target site: ${url}`);
        showReminderNotification(url);
        return tab;
      } else {
        console.log(`Background: Currently on: ${url} (not a target site)`);
      }
    } else {
      console.log("Background: No target sites defined. Skipping check.");
    }
  }
  return false;
}

// Function to display a reminder notification
function showReminderNotification(url) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png", // Make sure you have this icon
    title: "Mindful Browse Check-in",
    message: `You're currently on a site that might be distracting (${url}). Do you really want to be here?`,
    priority: 2 // High priority
  });
}

// Create an alarm for periodic checks
chrome.alarms.create("mindfulBrowseAlarm", {
  // delayInMinutes: CHECK_INTERVAL_MINUTES,
  periodInMinutes: CHECK_INTERVAL_MINUTES
});

chrome.alarms.create("mindfulBrowseShutdown", {
  delayInMinutes: CHECK_INTERVAL_MINUTES_SHUTDOWN,
  periodInMinutes: CHECK_INTERVAL_MINUTES_SHUTDOWN
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "mindfulBrowseAlarm") {
    console.log("Background: Alarm fired! Checking current tab...");
    checkCurrentTab();
  }

  if (alarm.name === "mindfulBrowseShutdown") {
    try {
      await loadTargetSitesFromStorage();
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) return;

      const url = tab.url.toLowerCase();
      const isOnTargetSite = currentTargetSites.some(site => url.includes(site));

      if (!isOnTargetSite) return;

      // Retry logic: try up to 3 times to close the tab
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Double-check tab still exists and is on a target site
          let freshTab = await chrome.tabs.get(tab.id);
          if (!freshTab || !freshTab.url || !currentTargetSites.some(site => freshTab.url.toLowerCase().includes(site))) {
            console.log("Tab no longer matches target site or is gone.");
            break;
          }
          await chrome.tabs.remove(tab.id);
          await chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "SOS Initiated",
            message: `The tab was taking too much of your time (${tab.url}). I took the liberty to kill it...`,
            priority: 2
          });
          console.log(`Tab ${tab.id} closed successfully on attempt ${attempt}.`);
          break;
        } catch (err) {
          console.warn(`Attempt ${attempt} to close tab failed:`, err);
          if (attempt === 3) {
            await chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "SOS Failed",
              message: `Tried to close the tab (${tab.url}) but failed after 3 attempts.`,
              priority: 2
            });
          } else {
            // Wait a bit before retrying
            await new Promise(res => setTimeout(res, 500));
          }
        }
      }
    } catch (err) {
      console.error("Error in shutdown alarm handler:", err);
    }
  }
});

// Function to check the active tab and inject/remove overlay as needed
async function handleTabOverlay(tabId) {
  console.log("Background: Checking tab for overlay injection/removal...");
  await checkCurrentTab();

  // Get the specified tab
  let tab = await chrome.tabs.get(tabId);
  if (tab && tab.url) {
    const url = tab.url.toLowerCase();
    if (currentTargetSites && currentTargetSites.length > 0) {
      const isOnTargetSite = currentTargetSites.some(site => url.includes(site));
      if (isOnTargetSite) {
        // Inject a warning overlay into the tab
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Remove any existing overlay first
            const existing = document.getElementById('danger-stay-away-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'danger-stay-away-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(255,0,0,0.7)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.pointerEvents = 'none';

            const text = document.createElement('div');
            text.textContent = 'Danger, Stay Away!';
            text.style.color = 'white';
            text.style.fontSize = '3em';
            text.style.fontWeight = 'bold';
            text.style.textShadow = '2px 2px 8px #000';
            overlay.appendChild(text);

            document.body.appendChild(overlay);
          }
        });
      } else {
        // Remove overlay if not on a target site
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const existing = document.getElementById('danger-stay-away-overlay');
            if (existing) existing.remove();
          }
        });
      }
    }
  }
}

// Listen for tab switching (tab activation)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabOverlay(activeInfo.tabId);
});

// Listen for tab updates (e.g., navigation within the same tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabOverlay(tabId);
  }
});

// Listen for messages from other parts of the extension (e.g., popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateTargetSites") {
    console.log("Background: Received message to update target sites. Reloading from storage...");
    loadTargetSitesFromStorage(); // Reload the list when popup changes it
  }
});

// Initial setup when the background script starts
console.log("Background: Mindful Browse Reminder extension started.");
loadTargetSitesFromStorage().then(() => {
  // Perform an immediate check after loading sites
  checkCurrentTab();
});