// LinkedIn notification monitor - focused on nt-card--unread elements
(() => {
    console.log("LinkedIn content script initialized");
    
    let previousCount = 0;
    
    // Function to check for LinkedIn unread notifications
    function checkLinkedInNotifications() {
      // Focus specifically on counting the elements you provided
      const unreadNotifications = document.querySelectorAll('article.nt-card.nt-card--unread');
      const notificationCount = unreadNotifications.length;
      
      console.log(`Found ${notificationCount} unread LinkedIn notifications`);
      
      // If count changed, send message to background script
      if (notificationCount !== previousCount) {
        console.log("Notification count changed from", previousCount, "to", notificationCount);
        previousCount = notificationCount;
        chrome.runtime.sendMessage({
          source: 'linkedin',
          notificationCount: notificationCount
        });
      }
    }
    
    // Set up a MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        // Check added nodes
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Look specifically for added unread notification articles or their containers
              if ((node.tagName === 'ARTICLE' && 
                   node.classList && 
                   node.classList.contains('nt-card') &&
                   node.classList.contains('nt-card--unread')) ||
                  (node.querySelector && node.querySelector('article.nt-card.nt-card--unread'))) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        
        // Check attribute changes - specifically for the classes that mark read/unread status
        if (!shouldCheck && mutation.type === 'attributes') {
          const target = mutation.target;
          if (mutation.attributeName === 'class' && 
              target.tagName === 'ARTICLE' && 
              target.classList && 
              target.classList.contains('nt-card')) {
            shouldCheck = true;
          }
        }
        
        if (shouldCheck) break;
      }
      
      if (shouldCheck) {
        console.log("Relevant notification DOM change detected");
        checkLinkedInNotifications();
      }
    });
    
    // Function to set up observation of the LinkedIn notifications panel
    function setupNotificationPanelObserver() {
      // Try to find the notification content panel
      const notificationPanel = document.querySelector('.nt-content');
      if (notificationPanel) {
        console.log("Found notifications panel, setting up targeted observer");
        
        // Set up specific observer for the notifications content
        observer.observe(notificationPanel, { 
          childList: true,    // Watch for added/removed notification cards
          subtree: true,      // Watch all descendants
          attributes: true,   // Watch for attribute changes (read/unread status)
          attributeFilter: ['class', 'aria-label'] // Only watch relevant attributes
        });
        
        // Run an initial check
        checkLinkedInNotifications();
      } else {
        // If panel not found, check again soon (panel may be loading)
        setTimeout(setupNotificationPanelObserver, 1000);
      }
    }
    
    // Check when the notification button is clicked (panel likely to open)
    function setupClickListeners() {
      const notificationButton = document.querySelector('button[data-control-name="notifications"]') || 
                                 document.querySelector('button[aria-label*="Notifications"]');
      
      if (notificationButton) {
        console.log("Found notifications button, adding click listener");
        notificationButton.addEventListener('click', () => {
          console.log("Notifications button clicked");
          // Give the panel time to open
          setTimeout(setupNotificationPanelObserver, 500);
        });
      } else {
        // Try again if button not found yet
        setTimeout(setupClickListeners, 1000);
      }
    }
    
    // Start observing when the page loads
    window.addEventListener('load', () => {
      console.log("LinkedIn page loaded");
      
      // Give LinkedIn time to initialize
      setTimeout(() => {
        // Set up click listener for notifications button
        setupClickListeners();
        
        // Set up general observer for the body (to catch notification changes)
        observer.observe(document.body, { 
          childList: true,
          subtree: true,
          attributes: false  // We'll do more specific attribute watching on the panel
        });
        
        // Check if notifications panel is already open
        setupNotificationPanelObserver();
        
        // Initial check
        checkLinkedInNotifications();
      }, 3000);
    });
    
    // Also check when the page becomes visible again (user returns to tab)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log("Page became visible, checking LinkedIn notifications");
        checkLinkedInNotifications();
        // Try to set up panel observer in case panel is open
        setupNotificationPanelObserver();
      }
    });
    
    // Run initial check once
    setTimeout(checkLinkedInNotifications, 3000);
  })();

  // Listen for manual check requests from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkNow") {
    console.log(`Manual check requested for ${message.service}`);
    
    // Call the appropriate check function based on which content script this is
    if (message.service === "whatsapp") {
      checkWhatsAppNotifications(); // For whatsapp.js
    } else if (message.service === "linkedin") {
      checkLinkedInNotifications(); // For linkedin.js
    }
    
    // Send response back
    sendResponse({ status: "check completed" });
  }
  return true; // Keep the message channel open for the async response
});