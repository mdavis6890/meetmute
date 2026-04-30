document.addEventListener('DOMContentLoaded', async function () {
    const popupMuteButton = document.getElementById("mutebutton");
    const popupUnMuteButton = document.getElementById("unmutebutton");
    const authStatus = document.getElementById("auth-status");
    const authLabel = document.getElementById("auth-label");
    const signinBtn = document.getElementById("signin-btn");
    const logoutBtn = document.getElementById("logout-btn");

    function setAuthUI(authenticated) {
        if (authenticated) {
            authStatus.className = "ok";
            authLabel.textContent = "Connected to Google Calendar";
            signinBtn.style.display = "none";
            logoutBtn.style.display = "block";
        } else {
            authStatus.className = "fail";
            authLabel.textContent = "Not signed in";
            signinBtn.style.display = "block";
            logoutBtn.style.display = "none";
        }
    }

    // Check auth silently on open
    const { authenticated } = await chrome.runtime.sendMessage({ type: "checkAuthStatus" });
    setAuthUI(authenticated);

    logoutBtn.addEventListener("click", async function () {
        logoutBtn.disabled = true;
        const result = await chrome.runtime.sendMessage({ type: "logout" });
        logoutBtn.disabled = false;
        setAuthUI(result.authenticated);
    });

    signinBtn.addEventListener("click", async function () {
        signinBtn.disabled = true;
        signinBtn.textContent = "Signing in…";
        const result = await chrome.runtime.sendMessage({ type: "triggerAuth" });
        signinBtn.disabled = false;
        signinBtn.textContent = "Sign in with Google";
        setAuthUI(result.authenticated);
    });

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
