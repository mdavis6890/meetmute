const LOG = "[MeetMute/bg]";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "getMeetingEndTime") {
        console.log(LOG, "Received getMeetingEndTime for code:", request.meetingCode);
        fetchMeetingEndTime(request.meetingCode)
            .then(endTime => {
                console.log(LOG, "Returning end time:", endTime);
                sendResponse(endTime);
            })
            .catch(err => {
                console.error(LOG, "fetchMeetingEndTime failed:", err);
                sendResponse(null);
            });
        return true; // keep message channel open for async response
    }
});

async function fetchMeetingEndTime(meetingCode) {
    console.log(LOG, "Getting auth token...");
    const token = await getAuthToken();
    if (!token) {
        console.warn(LOG, "No auth token — user denied or not signed in");
        return null;
    }
    console.log(LOG, "Auth token obtained");

    const now = new Date();
    const timeMin = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    console.log(LOG, `Querying Calendar API: timeMin=${timeMin} timeMax=${timeMax}`);

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("conferenceDataVersion", "1");

    const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
        console.error(LOG, `Calendar API error: ${response.status} ${response.statusText}`);
        return null;
    }

    const data = await response.json();
    console.log(LOG, `Calendar API returned ${data.items?.length ?? 0} events`);

    const event = data.items?.find(item =>
        item.conferenceData?.entryPoints?.some(ep => ep.uri?.includes(meetingCode))
    );

    if (event) {
        console.log(LOG, `Matched event: "${event.summary}", ends: ${event.end?.dateTime}`);
    } else {
        console.warn(LOG, "No calendar event found matching meeting code:", meetingCode);
        console.log(LOG, "Events checked:", data.items?.map(e => ({
            summary: e.summary,
            entryPoints: e.conferenceData?.entryPoints?.map(ep => ep.uri)
        })));
    }

    return event?.end?.dateTime ?? null;
}

function getAuthToken() {
    return new Promise(resolve => {
        chrome.identity.getAuthToken({ interactive: true }, token => {
            if (chrome.runtime.lastError) {
                console.error(LOG, "getAuthToken error:", chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(token);
            }
        });
    });
}
