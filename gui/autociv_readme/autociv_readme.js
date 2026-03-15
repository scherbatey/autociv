"use strict";

// The page initialization function - returns a promise
function init(data, hotloadData) {
	return new Promise(function(resolve, reject) {
		// Load the README content
		let markdown = Engine.ReadFile("moddata/autociv_README.md");
		if (markdown && typeof autociv_SimpleMarkup === 'function') {
			Engine.GetGUIObjectByName("text").caption = autociv_SimpleMarkup(markdown);
		} else if (markdown) {
			// Fallback if markup function isn't available
			Engine.GetGUIObjectByName("text").caption = markdown;
		}

		Engine.GetGUIObjectByName("title").caption = translate("AutoCiv README");

		let buttonWebpage = Engine.GetGUIObjectByName("buttonWebpage");
		buttonWebpage.caption = translate("AutoCiv Website");
		buttonWebpage.onPress = function() {
			openURL("https://github.com/0ADMods/AutoCiv");
		};

		let buttonClose = Engine.GetGUIObjectByName("buttonClose");
		buttonClose.caption = translate("Close");
		buttonClose.onPress = function() {
			resolve();
		};

		// Handle escape key/cancel
		Engine.GetGUIObjectByName("cancelHandler").onPress = function() {
			resolve();
		};
	});
}
