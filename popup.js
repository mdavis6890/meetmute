//document.querySelector('button[aria-label*="microphone"]').click();

document.addEventListener('DOMContentLoaded', function () {
  const muteButton = document.getElementById("mutebutton");
  console.log(muteButton);
  muteButton.addEventListener("click", function() {
  	(async () => {
	  	console.log("Mute Button Clicked");
	  	//const tabs = await chrome.tabs.query({title: "Google Meet"});
	  	const tabs = await chrome.tabs.query({url: "*://*.meet.google.com/*"});
	  	//console.log(tabs)
	  	meetTab = tabs[0];
	  	console.log(meetTab);
	  	if (meetTab) {
			console.log(meetTab);
			chrome.scripting.executeScript({
				target: {
					tabId: meetTab.id
				},
				func: function () {
					//console.log("TEST");
					document.querySelector('button[aria-label*="microphone"]').click();
				}
			})
	  	}
	  	
  	})();
  });
});