background = {

	/**
	 * Array of edited URLs
	 */
	editedURLs: [],

	/**
	 * Array of protected URLs
	 */
	protectedURLs: [],

	/**
	 * Token needed to edit the wiki
	 */
	editToken: null,

	/**
	 * Identifier of the context menu
	 */
	contextMenuID: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bind();
		background.wiki.getEditedURLs( function ( editedURLs ) {
			background.editedURLs = editedURLs;
		});
		background.wiki.getProtectedURLs( function ( protectedURLs ) {
			background.protectedURLs = protectedURLs;
		});
		background.contextMenuID = chrome.contextMenus.create({
			'title': 'Edit with Edity',
			'contexts': [ 'all' ],
			'onclick' : function ( info, tab ) {
				background.contentScript.startEdit( tab );
			}
		});
	},

	/**
	 * Bind events
	 */
	bind: function () {
		chrome.tabs.onUpdated.addListener( this.onUpdated );
		chrome.tabs.onActivated.addListener( this.onActivated );
		chrome.runtime.onMessage.addListener( this.contentScript.onMessage );
	},

	/**
	 * Enable or disable the context menu depending on the URL
	 */
	onUpdated: function ( tabId, changeInfo, tab ) {
		chrome.tabs.sendMessage( tabId, { 'method': 'sendURL' }, function ( url ) {
			chrome.contextMenus.update( background.contextMenuID, {
				'enabled': background.isProtected( url ) ? false : true
			});
		});
	},

	/**
	 * Enable or disable the context menu depending on the URL
	 */
	onActivated: function ( activeInfo ) {
		chrome.tabs.sendMessage( activeInfo.tabId, { 'method': 'sendURL' }, function ( url ) {
			chrome.contextMenus.update( background.contextMenuID, {
				'enabled': background.isProtected( url ) ? false : true
			});
		});
	},

	/**
	 * Convenience method to get the active tab
	 */
	getActiveTab: function ( callback ) {
		chrome.tabs.query({ 'active': true, 'currentWindow': true }, function ( tabs ) {
			callback( tabs[0] );
		});
	},

	/**
	 * Convenience method to get the badge of the active tab
	 */
	getActiveBadge: function ( callback ) {
		this.getActiveTab( function ( tab ) {
			chrome.browserAction.getBadgeText({ 'tabId': tab.id }, callback );
		});
	},

	/**
	 * Convenience method to get the URL of the active tab
	 */
	getActiveURL: function ( callback ) {
		this.getActiveTab( function ( tab ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'sendURL' }, callback );
		});
	},

	/**
	 * Convenience method to check if the given URL is edited
	 */
	isEdited: function ( url ) {
		if ( background.editedURLs.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	},

	/**
	 * Convenience method to check if the given URL is protected
	 */
	isProtected: function ( url ) {
		if ( background.protectedURLs.indexOf( url ) === -1 ) {
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
		 * Check if the URL sent from the content script is edited
		 */
		isEdited: function ( message, sender, sendResponse ) {
			var isEdited = false;
			if ( background.isEdited( message.url ) ) {
				isEdited = true;
			}
			sendResponse( isEdited );
		},

		/**
		 * Update the badge with the text sent from the content script
		 */
		updateBadge: function ( message, sender, sendResponse ) {
			chrome.browserAction.setBadgeText({ 'tabId': sender.tab.id, 'text': message.text });
		},

		/**
		 * Update the icon depending on if the URL is protected
		 */
		updateIcon: function ( message, sender, sendResponse ) {
			var path = 'images/icon19.png';
			if ( background.isProtected( message.url ) ) {
				path = 'images/icon19-grey.png';
			}
			chrome.browserAction.setIcon({ 'tabId': sender.tab.id, 'path': path });
		},

		/**
		 * Add the URL sent from the content script to the edited URLs
		 */
		updateEditedURLs: function ( message, sender, sendResponse ) {
			if ( ! background.isEdited( message.url ) ) {
				background.editedURLs.push( message.url );
			}
		},

		/**
		 * Ask the content script to start the edit mode
		 */
		startEdit: function ( tab ) {
			if ( background.editToken ) {
				chrome.tabs.sendMessage( tab.id, { 'method': 'startEdit', 'editToken': background.editToken });
			} else {
				background.wiki.getEditToken( function ( editToken ) {
					background.editToken = editToken;
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
		 * Request the latest list of edited URLs from the wiki
		 */
		getEditedURLs: function ( callback ) {
			var data = { 'action': 'query', 'list': 'allpages', 'aplimit': 999, 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				var editedURLs = [];
				response.query.allpages.forEach( function ( page ) {
					editedURLs.push( page.title );
				});
				callback( editedURLs );
			});
		},

		/**
		 * Request the latest list of protected URLs from the wiki
		 */
		getProtectedURLs: function ( callback ) {
			var data = { 'action': 'query', 'list': 'protectedtitles', 'ptlimit': 999, 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				var protectedURLs = [];
				response.query.protectedtitles.forEach( function ( page ) {
					protectedURLs.push( page.title );
				});
				callback( protectedURLs );
			});
		},

		/**
		 * Request an edit token from the wiki
		 */
		getEditToken: function ( callback ) {
			var data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				var editToken = response.query.tokens.csrftoken;
				callback( editToken );
			});
		}
	}
};

$( background.init );