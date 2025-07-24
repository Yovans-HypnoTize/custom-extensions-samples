// Load notification counts when popup opens
document.addEventListener("DOMContentLoaded", () => {
  const whatsappCard = document.querySelector(".summary .card:nth-child(1)");
  const linkedinCard = document.querySelector(".summary .card:nth-child(2)");

  // Open WhatsApp Web on click
  whatsappCard.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://web.whatsapp.com/" });
  });

  // Open LinkedIn Notifications on click
  linkedinCard.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.linkedin.com/notifications/" });
  });

  // Get the current notification counts from storage
  chrome.storage.local.get("notificationCount", (data) => {
    if (data.notificationCount) {
      const counts = data.notificationCount;

      // Update the UI with counts
      document.getElementById("whatsapp-count").textContent = counts.whatsapp;
      document.getElementById("linkedin-count").textContent = counts.linkedin;
      document.getElementById("total-count").textContent =
        counts.whatsapp + counts.linkedin;
    }
  });

  // Add event listener for the clear button
  document.getElementById("clear-btn").addEventListener("click", () => {
    // Reset all counts
    const resetCounts = {
      whatsapp: 0,
      linkedin: 0,
    };

    // Update storage and UI
    chrome.storage.local.set({ notificationCount: resetCounts });

    // Update the UI
    document.getElementById("whatsapp-count").textContent = "0";
    document.getElementById("linkedin-count").textContent = "0";
    document.getElementById("total-count").textContent = "0";

    // Update the badge
    chrome.action.setBadgeText({ text: "" });
  });

  // Add event listener for the check now button
  document.getElementById("check-now-btn").addEventListener("click", () => {
    // Manually trigger notification checks in all active tabs
    chrome.runtime.sendMessage({ action: "checkNotificationsNow" });

    // Visual feedback that check was triggered
    const checkButton = document.getElementById("check-now-btn");
    const originalText = checkButton.innerHTML;
    checkButton.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg> Checking...`;

    // Reset button after short delay
    setTimeout(() => {
      checkButton.innerHTML = originalText;
    }, 1500);
  });

  const toggleBtn = document.getElementById("theme-toggle");

  // Apply saved theme from localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
  }

  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateCounts" && message.counts) {
      // Update the UI with the latest counts
      document.getElementById("whatsapp-count").textContent =
        message.counts.whatsapp;
      document.getElementById("linkedin-count").textContent =
        message.counts.linkedin;
      document.getElementById("total-count").textContent =
        message.counts.whatsapp + message.counts.linkedin;
    }
  });
});
