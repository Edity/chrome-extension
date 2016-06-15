popup = {

	/**
	 * Convenience property to access the background
	 */
	background: null,

	/**
	 * Initialization script
	 */
	init: function () {
		popup.background = popup.getBackground();
		popup.bindEvents();
		popup.updateCount();
		popup.updateRandom();
	},

	/**
	 * Bind events
	 */
	bindEvents: function () {
		$( '#edity-reload' ).click( popup.updateChanges );
	},

	/**
	 * Convenience method to get the background
	 */
	getBackground: function () {
		return chrome.extension.getBackgroundPage().background;
	},

	/**
	 * Update the text and href of the edit count link based on the badge
	 */
	updateCount: function () {
		chrome.tabs.query({ 'active': true, 'currentWindow': true }, function ( tabs ) {
			var tab = tabs[0];
			chrome.browserAction.getBadgeText({ 'tabId': tab.id }, function ( liveEditCount ) {
				if ( liveEditCount ) {
					var href = 'https://edity.org/' + tab.url,
						text = liveEditCount + ' edit' + ( liveEditCount === '1' ? '' : 's' ) + ' to this page';
					$( '#edity-count a' ).attr( 'href', href ).text( text );
				}
			});
		});
	},

	/**
	 * Update the href of the random page link
	 */
	updateRandom: function () {
		var href = popup.background.whitelist[ Math.floor( Math.random() * popup.background.whitelist.length ) ];
		$( '#edity-random a' ).attr( 'href', href );
	},

	/**
	 * Update with the latest changes from the wiki
	 */
	updateChanges: function () {
		popup.background.requestWhitelist().then( function () {
			chrome.tabs.reload(); // A reload may not be necessary
		});
	}
};

$( popup.init );