background = {

	/**
	 * Array of edited URLs
	 */
	whitelist: [],

	/**
	 * Array of protected URLs
	 */
	blacklist: [],

	/**
	 * Token needed to edit the wiki
	 */
	editToken: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bind();
		background.wiki.requestWhitelist();
		background.wiki.requestBlacklist();
	},

	/**
	 * Bind events
	 */
	bind: function () {
		chrome.runtime.onMessage.addListener( background.contentScript.onMessage );
	},

	/**
	 * Convenience method to get the current tab
	 */
	queryCurrentTab: function ( callback ) {
		chrome.tabs.query({ 'active': true, 'currentWindow': true }, function ( tabs ) {
			let tab = tabs[0];
			callback( tab );
		});
	},

	/**
	 * Convenience method to check if the given URL is in the whitelist
	 */
	inWhitelist: function ( url ) {
		if ( background.whitelist.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	},

	/**
	 * Convenience method to check if the given URL is in the blacklist
	 */
	inBlacklist: function ( url ) {
		if ( background.blacklist.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	},

	/**
	 * Sub-object to communicate with the content scripts
	 */
	contentScript: {

		/**
		 * Event handler
		 */
		onMessage: function ( message, sender, sendResponse ) {
			background.contentScript[ message.method ]( message, sender, sendResponse );
		},

		/**
		 * Create a context menu specific for each tab
		 */
		createContextMenu: function ( message, sender, sendResponse ) {
			chrome.contextMenus.create({
				'title': 'Edit with Edity',
				'contexts': [ 'all' ],
				'documentUrlPatterns': [ sender.tab.url ],
				'enabled': background.inBlacklist( message.url ) ? false : true,
				'onclick' : function ( info, tab ) {
					background.contentScript.startEdit( tab );
				}
			});
		},

		/**
		 * Check if the URL sent from the content script has edits
		 */
		hasEdits: function ( message, sender, sendResponse ) {
			let hasEdits = false;
			if ( background.inWhitelist( message.url ) ) {
				hasEdits = true;
			}
			sendResponse( hasEdits );
		},

		/**
		 * Update the badge with the text sent from the content script
		 */
		updateBadge: function ( message, sender, sendResponse ) {
			chrome.browserAction.setBadgeText({ 'tabId': sender.tab.id, 'text': message.text });
		},

		/**
		 * Update the whitelist with the URL sent from the content script
		 */
		updateWhitelist: function ( message, sender, sendResponse ) {
			if ( ! background.inWhitelist( message.url ) ) {
				background.whitelist.push( message.url );
			}
		},

		/**
		 * Ask the content script to start the edit mode
		 */
		startEdit: function ( tab ) {
			if ( background.editToken ) {
				chrome.tabs.sendMessage( tab.id, { 'method': 'startEdit', 'editToken': background.editToken });
			} else {
				background.wiki.requestEditToken().then( function () {
					background.contentScript.startEdit( tab );
				});
			}
		}
	},

	/**
	 * Sub-object to communicate with the wiki
	 */
	wiki: {

		/**
		 * Request the latest whitelist from the wiki
		 * @returns {Object} jQuery Promise
		 */
		requestWhitelist: function () {
			let data = { 'action': 'query', 'list': 'allpages', 'format': 'json' };
			return $.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				background.whitelist = [];
				response.query.allpages.forEach( function ( page ) {
					background.whitelist.push( page.title );
				});
			});
		},

		/**
		 * Request the latest blacklist from the wiki
		 * @returns {Object} jQuery Promise
		 */
		requestBlacklist: function () {
			let data = { 'action': 'query', 'list': 'protectedtitles', 'format': 'json' };
			return $.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				background.blacklist = [];
				response.query.protectedtitles.forEach( function ( page ) {
					background.blacklist.push( page.title );
				});
			});
		},

		/**
		 * Request an edit token from the wiki
		 * @returns {Object} jQuery Promise
		 */
		requestEditToken: function () {
			let data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
			return $.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				background.editToken = response.query.tokens.csrftoken;
			});
		}
	}
};

$( background.init );