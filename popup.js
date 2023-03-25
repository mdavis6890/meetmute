document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM Loaded")
    const popupMuteButton = document.getElementById("mutebutton");
    const popupUnMuteButton = document.getElementById("unmutebutton");

  chrome.tabs.query({url: "*://*.meet.google.com/*"}, function (tabs) {
    if (tabs.length > 0) {
        popupMuteButton.disabled = false;
        popupUnMuteButton.disabled = false;
    } else {
        popupMuteButton.disabled = true;
        popupUnMuteButton.disabled = true;        
    }
  });

  popupMuteButton.addEventListener("click", function() {
    (async () => {
        const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
        meetTab = tabs[0];
        if (meetTab) {
            const response = await chrome.tabs.sendMessage(meetTab.id, { type: "mute"});
        }
    })();
  });

  popupUnMuteButton.addEventListener("click", function() {
    (async () => {
        const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
        meetTab = tabs[0];
        if (meetTab) {
            const response = await chrome.tabs.sendMessage(meetTab.id, { type: "unmute"});
        }
    })();
  });

});