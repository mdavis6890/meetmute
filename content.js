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

function createOverlay() {
    const el = document.createElement("span");
    el.id = "meetmute-timer";
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
    return el;
}

// Called on every tick — re-injects if Meet re-rendered and evicted the element.
function getOrCreateOverlay() {
    return document.getElementById("meetmute-timer") ?? createOverlay();
}

function removeOverlay() {
    document.getElementById("meetmute-timer")?.remove();
}

// --- Captions management ---

let extensionEnabledCaptions = false;

function injectCaptionHideStyle() {
    if (document.getElementById("meetmute-caption-hide")) return;
    const style = document.createElement("style");
    style.id = "meetmute-caption-hide";
    // visibility:hidden keeps layout stable and doesn't affect MutationObserver
    style.textContent = '[jsname="YSxPC"] { visibility: hidden !important; }';
    document.head.appendChild(style);
}

function enableCaptions() {
    if (document.querySelector('[aria-label*="Turn off captions"]')) return; // already on
    const btn = document.querySelector('[aria-label*="Turn on captions"]');
    if (btn) {
        btn.click();
        extensionEnabledCaptions = true;
        console.log(LOG, "Captions enabled by extension");
    }
}

function disableCaptionsIfWeEnabled() {
    if (!extensionEnabledCaptions) return;
    extensionEnabledCaptions = false;
    document.querySelector('[aria-label*="Turn off captions"]')?.click();
    document.getElementById("meetmute-caption-hide")?.remove();
}

// --- Filler detection ---
// Caption jsnames are internal to Meet and may change after a Meet update.
// If detection stops working, inspect the caption area in DevTools and look for
// the container with aria-live="polite" and text spans inside speaker blocks.
const FILLER_REGEX = /\b(um+|uh+|ah+|er+|hmm+)\b/i;
const captionTextCache = new Map(); // element -> last processed text
let captionObserver = null;

function findCaptionContainer() {
    return (
        document.querySelector('[jsname="YSxPC"]') ||
        document.querySelector('[aria-live="polite"][jsname]')
    );
}

function getSpeaker(captionTextEl) {
    const block = captionTextEl.closest('[jsname="nkK6Yc"]');
    return block?.querySelector('[jsname="Rn7Mcf"]')?.textContent.trim() ?? "";
}

function checkCaptionForFillers(el) {
    if (getSpeaker(el) !== "You") return;
    const text = el.textContent;
    const prev = captionTextCache.get(el) ?? "";
    const newText = text.slice(prev.length);
    captionTextCache.set(el, text);
    if (newText && FILLER_REGEX.test(newText)) {
        showFillerReminder();
    }
}

function showFillerReminder() {
    let el = document.getElementById("meetmute-filler-reminder");
    if (!el) {
        el = document.createElement("div");
        el.id = "meetmute-filler-reminder";
        el.style.cssText = `
            position: fixed;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(234, 67, 53, 0.88);
            color: #fff;
            font-family: 'Google Sans', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            padding: 4px 12px;
            border-radius: 6px;
            letter-spacing: 0.3px;
            z-index: 2147483647;
            pointer-events: none;
            user-select: none;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        el.textContent = "Watch the fillers!";
        document.body.appendChild(el);
    }
    clearTimeout(el._hideTimeout);
    el.style.opacity = "1";
    el._hideTimeout = setTimeout(() => { el.style.opacity = "0"; }, 3000);
}

function startCaptionObserver() {
    if (captionObserver) return;
    const container = findCaptionContainer();
    if (!container) return;

    captionObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === "characterData") {
                const el = mutation.target.parentElement;
                if (el?.matches('[jsname="tgaKEf"]')) checkCaptionForFillers(el);
            }
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                const els = node.matches('[jsname="tgaKEf"]')
                    ? [node]
                    : [...node.querySelectorAll('[jsname="tgaKEf"]')];
                els.forEach(checkCaptionForFillers);
            }
        }
    });

    captionObserver.observe(container, { childList: true, subtree: true, characterData: true });
    console.log(LOG, "Caption observer started");
}

function stopCaptionObserver() {
    captionObserver?.disconnect();
    captionObserver = null;
    captionTextCache.clear();
    document.getElementById("meetmute-filler-reminder")?.remove();
}

async function startTimer() {
    if (timerInterval) return;
    console.log(LOG, "Starting timer");

    injectCaptionHideStyle();
    enableCaptions();

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
            stopCaptionObserver();
            disableCaptionsIfWeEnabled();
            return;
        }

        enableCaptions();       // no-op if already on; retries until CC button is present
        startCaptionObserver(); // no-op if already running or container not yet in DOM

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
