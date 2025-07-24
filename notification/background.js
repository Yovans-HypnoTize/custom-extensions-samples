// Initialize notification counters
let notificationCount = {
  whatsapp: 0,
  linkedin: 0,
};

let urls = {
  whatsapp: "*://web.whatsapp.com/*",
  linkedin: "*://www.linkedin.com/notifications/*",
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message.source === "whatsapp" &&
    message.notificationCount !== undefined
  ) {
    notificationCount.whatsapp = message.notificationCount;
    updateBadge();
    showNotification();
  } else if (
    message.source === "linkedin" &&
    message.notificationCount !== undefined
  ) {
    notificationCount.linkedin = message.notificationCount;
    updateBadge();
    showNotification();
  }

  // Handle "Check Now" action from popup
  else if (message.action === "checkNotificationsNow") {
    console.log("Check Now requested, refreshing notifications in all tabs");

    sendCheckOrOpenTab("whatsapp");
    sendCheckOrOpenTab("linkedin");

    sendResponse({ status: "checking" });

    setTimeout(() => {
      chrome.runtime
        .sendMessage({ action: "updateCounts", counts: notificationCount })
        .catch(() => {});
    }, 1000);
  }

  return true;
});

// Update the badge with total notification count
function updateBadge() {
  const totalCount = notificationCount.whatsapp + notificationCount.linkedin;

  if (totalCount > 0) {
    chrome.action.setBadgeText({ text: totalCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#33cc33" });
  } else {
    chrome.action.setBadgeText({ text: `🔔${totalCount}` });
    chrome.action.setBadgeBackgroundColor({ color: "#FFFFFF" });
  }

  // Store the current counts in storage
  chrome.storage.local.set({ notificationCount });
}

// Show system notification
function showNotification() {
  const totalCount = notificationCount.whatsapp + notificationCount.linkedin;

  if (totalCount > 0) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon.png",
      title: "New Messages",
      message: `You have ${totalCount} notification${
        totalCount > 1 ? "s" : ""
      }`,
      priority: 2,
    });
  }
}

// Initialize counters from storage when the extension starts
chrome.storage.local.get("notificationCount", (data) => {
  if (data.notificationCount) {
    notificationCount = data.notificationCount;
    updateBadge();
  }
});

function sendCheckOrOpenTab(service) {
  chrome.tabs.query({ url: urls[service] }, (tabs) => {
    if (Array.isArray(tabs) && tabs.length > 0) {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, { action: "checkNow", service })
          .catch((error) =>
            console.log(`Error sending to ${service} tab:`, error)
          );
      });
    } else {
      // No tab found, create one
      const newTabUrl =
        service === "whatsapp"
          ? "https://web.whatsapp.com/"
          : "https://www.linkedin.com/notifications/";

      chrome.tabs.create({ url: newTabUrl, active: false }, (newTab) => {
        // Wait for tab to load before sending message
        const listener = (tabId, changeInfo, tab) => {
          if (tabId === newTab.id && changeInfo.status === "complete") {
            chrome.tabs.sendMessage(tabId, {
              action: "checkNow",
              service,
            });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        };

        chrome.tabs.onUpdated.addListener(listener);
      });
    }
  });
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed!");

  // Trigger a check for notifications right after installation
  checkNotifications();
});

// Function to check notifications for WhatsApp and LinkedIn
function checkNotifications() {
  // Query tabs to find WhatsApp and LinkedIn
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      // If WhatsApp is already open, send a message to check notifications
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: "checkNow", service: "whatsapp" });
      });
    } else {
      // If no WhatsApp tab is open, open a new one
      chrome.tabs.create({ url: "https://web.whatsapp.com/" });
    }
  });

  chrome.tabs.query({ url: "https://www.linkedin.com/notifications/*" }, (tabs) => {
    if (tabs.length > 0) {
      // If LinkedIn is already open, send a message to check notifications
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: "checkNow", service: "linkedin" });
      });
    } else {
      // If no LinkedIn tab is open, open a new one
      chrome.tabs.create({ url: "https://www.linkedin.com/notifications/" });
    }
  });
}
