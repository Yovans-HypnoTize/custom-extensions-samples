// WhatsApp notification monitor
(() => {
  console.log("WhatsApp content script initialized");
  
  let previousCount = 0;
  
  // Function to check for notifications
  function checkWhatsAppNotifications() {
    // We only want to count the number of chats with unread messages, not total messages
    let unreadChatsCount = 0;
    let processedElements = new Set(); // To avoid counting the same chat twice
    
    // Approach 1: Look for unread message indicators directly in chat list
    const chatList = document.querySelector('[aria-label="Chat list"]');
    if (chatList) {
      const chatItems = chatList.querySelectorAll('[role="listitem"]');
      // console.log(`Found ${chatItems} chat items`);
      
      chatItems.forEach(chat => {
        // Check if this chat has any unread message indicator
        const unreadElement = chat.querySelector("span[aria-label$='unread messages'], span[aria-label$='unread message']");
        if (unreadElement && !processedElements.has(unreadElement)) {
          unreadChatsCount++;
          processedElements.add(unreadElement);
          console.log("Found chat with unread messages");
        }
      });
    }
    
    // Fallback approach if chat list not found or no unread chats detected
    if (unreadChatsCount === 0) {
      // Just count the number of distinct elements with unread messages
      const unreadElements = document.querySelectorAll("span[aria-label$='unread messages'], span[aria-label$='unread message']");
      console.log(`Found ${unreadElements.length} unread message indicators`);
      
      unreadElements.forEach(element => {
        if (!processedElements.has(element)) {
          unreadChatsCount++;
          processedElements.add(element);
          console.log("Found chat with unread messages (fallback method)");
        }
      });
    }
    
    console.log("Current WhatsApp unread chats count:", unreadChatsCount);
    
    // If count changed, send message to background script
    if (unreadChatsCount !== previousCount) {
      console.log("Unread chats count changed from", previousCount, "to", unreadChatsCount);
      previousCount = unreadChatsCount;
      chrome.runtime.sendMessage({
        source: 'whatsapp',
        notificationCount: unreadChatsCount
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
            // Check if the node itself or any children are relevant
            if ((node.getAttribute && node.getAttribute('data-icon') === 'chats-filled') ||
                (node.querySelector && (
                  node.querySelector('[data-icon="chats-filled"]') ||
                  node.querySelector("span[aria-label$='unread messages']") ||
                  node.querySelector("span[aria-label$='unread message']")
                ))) {
              shouldCheck = true;
              break;
            }
          }
        }
      }
      
      // Check attribute changes
      if (!shouldCheck && mutation.type === 'attributes') {
        if ((mutation.attributeName === 'data-icon' && 
             mutation.target.getAttribute('data-icon') === 'chats-filled') ||
            (mutation.attributeName === 'aria-label' && 
             mutation.target.getAttribute('aria-label') && 
             (mutation.target.getAttribute('aria-label').endsWith('unread message') || 
              mutation.target.getAttribute('aria-label').endsWith('unread messages')))) {
          shouldCheck = true;
        }
      }
      
      // Check for text content changes in spans (possible notification counters)
      if (!shouldCheck && mutation.type === 'characterData' && 
          mutation.target.parentNode && 
          mutation.target.parentNode.tagName === 'SPAN') {
        shouldCheck = true;
      }
      
      if (shouldCheck) break;
    }
    
    if (shouldCheck) {
      console.log("Relevant DOM change detected, checking notifications");
      checkWhatsAppNotifications();
    }
  });
  
  // Start observing when the page loads
  window.addEventListener('load', () => {
    console.log("WhatsApp page loaded, setting up observer");
    
    // Set up the observer once WhatsApp is fully loaded
    setTimeout(() => {
      // Observe the main app container or body if app container isn't found
      const appElement = document.getElementById('app') || document.body;
      
      // Configure the observer to watch for all relevant changes
      observer.observe(appElement, { 
        childList: true,          // Watch for added/removed elements
        subtree: true,            // Watch all descendants
        attributes: true,         // Watch for attribute changes
        attributeFilter: ['data-icon', 'aria-label'], // Only these attributes
        characterData: true       // Watch for text content changes (for notification counts)
      });
      
      // Initial check when first loading
      checkWhatsAppNotifications();
      console.log("Observer set up and initial check complete");
    }, 5000); // Give WhatsApp Web time to initialize
  });
  
  // Also check when the page becomes visible again (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log("Page became visible, checking notifications");
      checkWhatsAppNotifications();
    }
  });
  
  // Run initial check once (no recurring interval)
  setTimeout(checkWhatsAppNotifications, 5000);
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