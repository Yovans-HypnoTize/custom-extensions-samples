// popup.js - Script for the elegant extension popup
function setTheme(theme) {
  const html = document.documentElement;
  const toggleButton = document.getElementById("themeToggle");
  html.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (toggleButton) {
    toggleButton.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

// Load saved theme or default to light
function initializeTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);
}

// ------------------------
// Format date/time nicely
// ------------------------
function formatDateTime(date) {
  if (!date) return "Never";
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return date.toLocaleString();
}

// ------------------------
// Update the UI with animation
// ------------------------
function updateCountDisplay(count) {
  const countElement = document.getElementById("testCount");
  const oldValue = countElement.textContent;
  if (!isNaN(parseInt(oldValue)) && oldValue !== "-") {
    if (parseInt(count) > parseInt(oldValue)) {
      countElement.style.color = "#10b981"; // Green
    } else if (parseInt(count) < parseInt(oldValue)) {
      countElement.style.color = "#ef4444"; // Red
    }
    setTimeout(() => {
      countElement.style.color = "";
    }, 2000);
  }
  countElement.textContent = count;
}

// ------------------------
// Update the status message
// ------------------------
function updateStatus(message, isLoading = false) {
  const statusElement = document.getElementById("status");
  statusElement.textContent = message;
  if (!isLoading) {
    setTimeout(() => {
      statusElement.textContent = "";
    }, 5000);
  }
}

// ------------------------
// Document ready
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Init theme
  initializeTheme();

  // Theme toggle button
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      const newTheme = currentTheme === "light" ? "dark" : "light";
      setTheme(newTheme);
    });
  }

  // Get elements
  const checkNowButton = document.getElementById("checkNow");
  const openUserTestingButton = document.getElementById("openUserTesting");
  const lastCheckedElement = document.getElementById("lastChecked");

  chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
    if (response) {
      if (typeof response.count === "number") {
        updateCountDisplay(response.count);
      } else {
        updateCountDisplay("-");
      }
      if (response.lastChecked) {
        lastCheckedElement.textContent = formatDateTime(
          new Date(response.lastChecked)
        );
      }
    }
  });

  checkNowButton.addEventListener("click", () => {
    checkNowButton.disabled = true;
    updateStatus("Checking for available tests...", true);

    chrome.runtime.sendMessage({ action: "checkNow" }, (response) => {
      if (response && response.status === "checking") {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
            if (response) {
              if (typeof response.count === "number") {
                updateCountDisplay(response.count);
                updateStatus("Check complete!");
              }
              if (response.lastChecked) {
                lastCheckedElement.textContent = formatDateTime(
                  new Date(response.lastChecked)
                );
              }
            }
            checkNowButton.disabled = false;
          });
        }, 12000);
      }
    });
  });

  openUserTestingButton.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://app.usertesting.com/my_dashboard/available_tests_v3",
    });
  });
});
