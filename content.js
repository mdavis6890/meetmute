chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "mute") {
    button = document.querySelector('[aria-label*="Turn off microphone"]');
    if (button) {
      button.click();
    }
  } else if (request.type === "unmute") {
    button = document.querySelector('[aria-label*="Turn on microphone"]');
    if (button) {
      button.click();
    }
  }
});