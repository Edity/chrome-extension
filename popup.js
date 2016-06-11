popup = {

	/**
	 * Initialization script
	 */
	init: function () {
		popup.bindEvents();
	},

	/**
	 * Bind events
	 */
	bindEvents: function () {
		chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
			if ( message.action === 'setBadge' ) {
				$( '#edity-alert' ).text( message.text );
			}
		});
	}
};

$( popup.init );