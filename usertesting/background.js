// background.js - Enhanced background script with MutationObserver integration
// Store the last known test count and check time
let lastKnownTestCount = 0;
let lastCheckTime = null;
// Flag to prevent concurrent checks
let isChecking = false;
// URL to check
const userTestingUrl =
  "https://app.usertesting.com/my_dashboard/available_tests_v3";

// Function to create a hidden tab, check for tests, and close the tab
async function checkForTests() {
  if (isChecking) return;

  isChecking = true;
  console.log("Starting UserTesting check...");

  try {
    // Create or get the tab for UserTesting
    const { tab, isNewTab } = await getOrCreateTab(userTestingUrl);

    // Wait for page to load, then inject and run our content script
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Give page time to load (10 seconds)

    // Inject content script to extract test count
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractTestCount,
    });

    // Update last check time
    lastCheckTime = new Date().toISOString();

    // Process the results
    if (results && results[0] && typeof results[0].result === "number") {
      const currentCount = results[0].result;
      console.log(`Found ${currentCount} available tests`);

      // If count changed, send notification
      if (currentCount !== lastKnownTestCount) {
        if (currentCount > lastKnownTestCount) {
          // Show notification if there are new tests
          chrome.notifications.create({
            type: "basic",
            iconUrl: "./icons/icon.png",
            title: "UserTesting Tests Available",
            message: `You have ${currentCount} available test${
              currentCount !== 1 ? "s" : ""
            } on UserTesting!`,
            priority: 2,
          });
        }

        // Update badge on extension icon
        updateBadge(currentCount);

        // Update stored count
        lastKnownTestCount = currentCount;
      }
    }

    // Store data in storage for persistence
    chrome.storage.local.set({
      lastCount: lastKnownTestCount,
      lastChecked: lastCheckTime,
    });

    // Close the tab if it was newly created
    if (isNewTab) {  
    }
    console.log("UserTesting check complete.");      
  } catch (error) {
    console.error("Error checking UserTesting:", error);
  }

  isChecking = false;
}

// Function to find existing tab or create a new one
// Helper: Get existing tab for URL or create a new one
async function getOrCreateTab(url) {
  const tabs = await chrome.tabs.query({ url });

  const isNewTab = tabs.length === 0;
  const tab = isNewTab
    ? await chrome.tabs.create({ url, active: false })
    : tabs[0];

  return { tab, isNewTab };
}

// Function to update the badge on the extension icon
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#f72585" }); // Match our theme color
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Function to be injected into the page to extract the test count
function extractTestCount() {
  console.log("Extracting test count from UserTesting page...");
  let availableTestsCount = 0;

  // Look for available-tests-list-item elements inside available-tests-list
  const testsList = document.querySelector("available-tests-list");

  if (testsList) {
    // Check if the empty state message is present
    const emptyState = testsList.querySelector("empty-state");

    if (emptyState) {
      // We found the "no tests available" empty state
      console.log("Empty state detected - no tests available");
      availableTestsCount = 0;
    } else {
      // No empty state, so look for test items
      const testItems = testsList.querySelectorAll("available-tests-list-item");
      availableTestsCount = testItems.length;
      console.log(
        `Found ${testItems.length} test items in the available-tests-list`
      );
    }
  }

  // Fallback: Look for test items directly if container not found
  if (!testsList) {
    const testItems = document.querySelectorAll("available-tests-list-item");
    availableTestsCount = testItems.length;
  }

  console.log(`Extracted test count: ${availableTestsCount}`);

  return availableTestsCount;
}

// Set up MutationObserver to watch the page for changes in available tests
async function observeForNewTests(tabId) {
  const observerScript = `
    const observer = new MutationObserver((mutationsList, observer) => {
      const testItems = document.querySelectorAll("available-tests-list-item");
      const count = testItems.length;
      chrome.runtime.sendMessage({ action: 'testAvailable', count });
    });
    
    const targetNode = document.querySelector("available-tests-list");
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
    }
  `;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: new Function(observerScript),
  });
}

// Handle clicked notifications
chrome.notifications.onClicked.addListener(() => {
    // Open UserTesting in a new tab when notification is clicked
    chrome.tabs.create({ url: userTestingUrl });
  
    // Optionally, you can open the popup as well when the notification is clicked
    chrome.windows.create({
      url: './popup/popup.html',
      type: 'popup',
      width: 400,
      height: 600,
    });
  });

// Load stored data when extension starts
chrome.storage.local.get(["lastCount", "lastChecked"], (data) => {
  if (data.lastCount !== undefined) {
    lastKnownTestCount = data.lastCount;
    updateBadge(lastKnownTestCount);
  }

  if (data.lastChecked) {
    lastCheckTime = data.lastChecked;
  }
});

// Run initial check when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Wait a bit before first check
  setTimeout(checkForTests, 5000);
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkNow") {
    checkForTests();
    sendResponse({ status: "checking" });
    return true;
  }

  if (message.action === "testAvailable" && message.count > 0) {
    // Notification for available tests
    chrome.notifications.create({
      type: "basic",
      iconUrl: ".icons/icon.png",
      title: "New Test Available!",
      message: `You have ${message.count} test${message.count > 1 ? "s" : ""} waiting.`,
      priority: 2,
    });

    // Play sound for notification
    const soundUrl = chrome.runtime.getURL('./sounds/notification-sound.mp3');
    const audio = new Audio(soundUrl);
    audio.play();

    // Update badge
    chrome.action.setBadgeText({ text: message.count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  }

  if (message.action === "getStatus") {
    sendResponse({
      count: lastKnownTestCount,
      lastChecked: lastCheckTime,
    });
    return true;
  }
});
