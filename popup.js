document.addEventListener('DOMContentLoaded', async function () {
    const popupMuteButton = document.getElementById("mutebutton");
    const popupUnMuteButton = document.getElementById("unmutebutton");

    const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
    const hasMeet = tabs.length > 0;
    popupMuteButton.disabled = !hasMeet;
    popupUnMuteButton.disabled = !hasMeet;

    popupMuteButton.addEventListener("click", async function() {
        const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
        const meetTab = tabs[0];
        if (meetTab) {
            await chrome.tabs.sendMessage(meetTab.id, { type: "mute" });
        }
    });

    popupUnMuteButton.addEventListener("click", async function() {
        const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
        const meetTab = tabs[0];
        if (meetTab) {
            await chrome.tabs.sendMessage(meetTab.id, { type: "unmute" });
        }
    });
});
