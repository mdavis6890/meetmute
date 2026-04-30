# MeetMute — Dev Notes

## What this is
A Chrome extension (Manifest V3) that:
1. Adds global Mute/UnMute buttons in a popup that control the mic in any open Google Meet tab
2. Displays a countdown timer overlay in the Meet window showing time remaining in the scheduled meeting

## Architecture

### Files
- `manifest.json` — MV3 manifest; scoped to `meet.google.com`
- `popup.html` / `popup.js` — Extension popup with Mute and UnMute buttons (intentionally kept as two separate idempotent buttons)
- `content.js` — Injected into Meet tabs; handles mute/unmute clicks and owns the timer overlay
- `background.js` — Service worker; handles OAuth via `chrome.identity` and fetches Google Calendar API

### Message flow
```
popup.js  →  chrome.tabs.sendMessage({type:"mute"|"unmute"})  →  content.js
content.js  →  chrome.runtime.sendMessage({type:"getMeetingEndTime", meetingCode})  →  background.js
background.js  →  chrome.identity.getAuthToken  →  Calendar API  →  returns end dateTime string
```

## Timer overlay

### How it works
- Polls for `isInCall()` (mic button presence) to detect when Meet's UI is ready
- Once in a call, fetches the Calendar event end time via background.js
- Ticks every second; uses `isInMeeting()` (URL-based) to detect call end — NOT button presence, which flickers during re-renders
- Turns red when < 5 minutes remain; shows `+MM:SS` for overtime or when no Calendar event found
- Falls back to elapsed timer (`+MM:SS`) if Calendar lookup fails

### Option 1 revert
To drop Calendar API and use a fixed duration instead, replace `getEndTime()` in `content.js` with:
```js
async function getEndTime() {
    const durationMs = 60 * 60 * 1000; // 60 min default, or read from chrome.storage
    return new Date(Date.now() + durationMs).toISOString();
}
```
Then remove `background.js`, the `identity` permission, `oauth2` block, and `https://www.googleapis.com/*` host permission from `manifest.json`.

## Google Cloud / OAuth setup
- Project: personal GCP project (michael@m-davis.com)
- Calendar API enabled, OAuth client ID registered for Chrome extension
- Client ID is in `manifest.json` — do not remove
- `chrome.identity.getAuthToken()` piggybacks Chrome's existing Google sign-in; no separate login flow
- Corporate calendar data does NOT flow through the GCP project — it goes browser ↔ Google APIs directly
- Colleagues using the extension may hit Workspace org policies blocking third-party OAuth apps

## Known issues / next steps
- Consider whether to keep console logging long-term or strip it before "release"
- Single toggle button was discussed but intentionally deferred — user prefers two explicit buttons for safety
