background = {

	/**
	 * Array of edited URLs
	 */
	editedURLs: [],

	/**
	 * Array of protected domains
	 */
	protectedDomains: [],

	/**
	 * Identifier of the context menu
	 */
	contextMenuID: null,

	/**
	 * Token needed to edit the wiki
	 */
	editToken: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bind();
		background.wiki.getEditedURLs( function ( editedURLs ) {
			background.editedURLs = editedURLs;
		});
		background.wiki.getProtectedDomains( function ( protectedDomains ) {
			background.protectedDomains = protectedDomains;
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
	 * Enable or disable the context menu depending on the domain
	 */
	onUpdated: function ( tabId, changeInfo, tab ) {
		chrome.tabs.sendMessage( tabId, { 'method': 'sendDomain' }, function ( domain ) {
			chrome.contextMenus.update( background.contextMenuID, {
				'enabled': background.isProtected( domain ) ? false : true
			});
		});
	},

	/**
	 * Enable or disable the context menu depending on the domain
	 */
	onActivated: function ( activeInfo ) {
		chrome.tabs.sendMessage( activeInfo.tabId, { 'method': 'sendDomain' }, function ( domain ) {
			chrome.contextMenus.update( background.contextMenuID, {
				'enabled': background.isProtected( domain ) ? false : true
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
	 * Convenience method to get the URL of the active tab
	 */
	getActiveURL: function ( callback ) {
		this.getActiveTab( function ( tab ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'sendURL' }, callback );
		});
	},

	/**
	 * Convenience method to get the domain of the active tab
	 */
	getActiveDomain: function ( callback ) {
		this.getActiveTab( function ( tab ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'sendDomain' }, callback );
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
	 * Convenience method to check if the given URL is edited
	 */
	isEdited: function ( url ) {
		if ( background.editedURLs.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	},

	/**
	 * Convenience method to check if the given domain is protected
	 */
	isProtected: function ( domain ) {
		if ( background.protectedDomains.indexOf( domain ) === -1 ) {
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
			return background.contentScript[ message.method ]( message, sender, sendResponse );
		},

		/**
		 * Check if the URL sent from the content script is edited
		 */
		isEdited: function ( message, sender, sendResponse ) {
			var isEdited = false;
			if ( background.isEdited( sender.url ) ) {
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
			if ( background.isProtected( message.domain ) ) {
				path = 'images/icon19-grey.png';
			}
			chrome.browserAction.setIcon({ 'tabId': sender.tab.id, 'path': path });
		},

		/**
		 * Add the URL sent from the content script to the edited URLs
		 */
		updateEditedURLs: function ( message, sender, sendResponse ) {
			if ( ! background.isEdited( sender.url ) ) {
				background.editedURLs.push( sender.url );
			}
		},

		/**
		 * Get the latest edits for the URL sent from the content script
		 */
		getEdits: function ( message, sender, sendResponse ) {
			background.wiki.getEdits( sender.url, sendResponse );
			return true; // Keep the channel open until sendResponse is called
		},

		/**
		 * Save the latest edits sent by the contentScript
		 */
		saveEdits: function ( message, sender, sendResponse ) {
			background.wiki.saveEdits( message.data, sendResponse );
			return true; // Keep the channel open until sendResponse is called
		},

		/**
		 * Ask the content script to start the edit mode
		 */
		startEdit: function ( tab ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'startEdit' });
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
			$.get( 'http://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				var editedURLs = [];
				response.query.allpages.forEach( function ( page ) {
					editedURLs.push( page.title );
				});
				callback( editedURLs );
			});
		},

		/**
		 * Request the latest list of protected hosts from the wiki
		 */
		getProtectedDomains: function ( callback ) {
			var data = { 'action': 'query', 'list': 'protectedtitles', 'ptlimit': 999, 'format': 'json' };
			$.get( 'http://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				var protectedDomains = [];
				response.query.protectedtitles.forEach( function ( page ) {
					protectedDomains.push( page.title );
				});
				callback( protectedDomains );
			});
		},

		/**
		 * Request an edit token from the wiki
		 */
		getEditToken: function ( callback ) {
			if ( background.editToken ) {
				callback( background.editToken ); // No need to request it twice
			}
			var data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
			$.get( 'http://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				background.editToken = response.query.tokens.csrftoken;
				callback( background.editToken );
			});
		},

		/**
		 * Request the edits associated with the current URL
		 */
		getEdits: function ( url, callback ) {
			var data = { 'title': url, 'action': 'raw' };
			$.get( 'http://edity.org/index.php', data, callback, 'json' );
		},

		/**
		 * Save the edits
		 */
		saveEdits: function ( data, callback ) {
			background.wiki.getEditToken( function ( editToken ) {
				$.post( 'http://edity.org/api.php', {
					'action': 'edit',
					'format': 'json',
					'minor': data.minor,
					'summary': data.summary,
					//'tag': 'chrome edit',
					'text': JSON.stringify( data.edits ),
					'title': data.url,
					'token': editToken
				}, callback );
			});
		}
	}
};

$( background.init );