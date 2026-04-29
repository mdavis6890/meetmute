const LOG = "[MeetMute]";

chrome.runtime.onMessage.addListener(function(request) {
    if (request.type === "mute") {
        const button = document.querySelector('[aria-label*="Turn off microphone"]');
        if (button) {
            console.log(LOG, "Muting microphone");
            button.click();
        } else {
            console.warn(LOG, "Mute: microphone button not found");
        }
    } else if (request.type === "unmute") {
        const button = document.querySelector('[aria-label*="Turn on microphone"]');
        if (button) {
            console.log(LOG, "Unmuting microphone");
            button.click();
        } else {
            console.warn(LOG, "Unmute: microphone button not found");
        }
    }
});

// --- Countdown overlay ---

let timerInterval = null;

function getMeetingCode() {
    const match = window.location.pathname.match(/^\/([a-z]+-[a-z]+-[a-z]+)/);
    return match ? match[1] : null;
}

// Used to detect when Meet's UI controls are ready (buttons briefly disappear during re-renders).
function isInCall() {
    return !!(
        document.querySelector('[aria-label*="Turn off microphone"]') ||
        document.querySelector('[aria-label*="Turn on microphone"]')
    );
}

// Used inside the running timer — URL is stable for the full duration of a call.
function isInMeeting() {
    return !!getMeetingCode();
}

// To revert to option 1 (fixed duration): replace this function body with:
//   const durationMs = 60 * 60 * 1000; // or read from chrome.storage
//   return Date.now() + durationMs;
async function getEndTime() {
    const meetingCode = getMeetingCode();
    if (!meetingCode) {
        console.warn(LOG, "Could not extract meeting code from URL:", window.location.pathname);
        return null;
    }
    console.log(LOG, "Requesting end time for meeting code:", meetingCode);
    return chrome.runtime.sendMessage({ type: "getMeetingEndTime", meetingCode });
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Finds the clock element in Meet's bottom bar by matching a time-like text node.
function findClockElement() {
    const timeRegex = /^\d{1,2}:\d{2}(\s*[AP]M)?$/i;
    for (const el of document.querySelectorAll("span")) {
        if (timeRegex.test(el.textContent.trim()) && !el.querySelector("*")) {
            return el;
        }
    }
    return null;
}

function createOverlay() {
    const el = document.createElement("span");
    el.id = "meetmute-timer";

    const clockEl = findClockElement();
    if (clockEl) {
        console.log(LOG, "Injecting timer next to clock element:", clockEl.textContent.trim());
        el.style.cssText = `
            color: #fff;
            font-family: 'Google Sans', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 400;
            margin-left: 10px;
            letter-spacing: 0.5px;
            vertical-align: middle;
            pointer-events: none;
            user-select: none;
        `;
        clockEl.insertAdjacentElement("afterend", el);
    } else {
        console.warn(LOG, "Clock element not found — using fixed-position fallback");
        el.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.65);
            color: #fff;
            font-family: 'Google Sans', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 400;
            padding: 4px 10px;
            border-radius: 6px;
            letter-spacing: 0.5px;
            z-index: 2147483647;
            pointer-events: none;
            user-select: none;
        `;
        document.body.appendChild(el);
    }

    return el;
}

// Called on every tick — re-injects if Meet re-rendered and evicted the element.
function getOrCreateOverlay() {
    return document.getElementById("meetmute-timer") ?? createOverlay();
}

function removeOverlay() {
    document.getElementById("meetmute-timer")?.remove();
}

async function startTimer() {
    if (timerInterval) return;
    console.log(LOG, "Starting timer");

    const startTime = Date.now();
    let endTimeStr = null;
    try {
        endTimeStr = await getEndTime();
    } catch (e) {
        console.error(LOG, "getEndTime failed:", e.message);
    }

    if (endTimeStr) {
        console.log(LOG, "Counting down to:", endTimeStr);
    } else {
        console.log(LOG, "No end time — showing elapsed timer");
    }
    const endTime = endTimeStr ? new Date(endTimeStr).getTime() : null;

    timerInterval = setInterval(() => {
        if (!isInMeeting()) {
            console.log(LOG, "No longer in meeting — stopping timer");
            clearInterval(timerInterval);
            timerInterval = null;
            removeOverlay();
            return;
        }

        const overlay = getOrCreateOverlay();

        if (endTime) {
            const remainingMs = endTime - Date.now();
            const absSeconds = Math.floor(Math.abs(remainingMs) / 1000);
            overlay.textContent = remainingMs >= 0
                ? formatTime(absSeconds)
                : "+" + formatTime(absSeconds);
            overlay.style.color = remainingMs < 5 * 60 * 1000 ? "#ff6b6b" : "#fff";
        } else {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            overlay.textContent = "+" + formatTime(elapsedSeconds);
            overlay.style.color = "#fff";
        }
    }, 1000);
}

console.log(LOG, "Content script loaded, checking call state...");

if (isInCall()) {
    console.log(LOG, "Already in call, starting timer immediately");
    startTimer();
} else {
    console.log(LOG, "Not in call yet, polling...");
    const pollInterval = setInterval(() => {
        if (isInCall()) {
            console.log(LOG, "Call detected, starting timer");
            clearInterval(pollInterval);
            startTimer();
        }
    }, 1000);
}
