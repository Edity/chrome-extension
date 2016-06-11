background = {

	/**
	 * List of all edited URLs
	 * We retrieve it once when Edity initializes
	 * and we only query the wiki again if the user vists one of these URLs
	 * If the Edity project grows too big and this list becomes unmanageable, we'll see
	 */
	whitelist: [],

	/**
	 * All changes retrived from the wiki
	 * We store them here to further minimize requests
	 * This object has URLs as property names
	 * and the corresponding array of changes as values
	 */
	changes: {},

	/**
	 * Store the edit token because we only need one per session
	 */
	editToken: null,

	/**
	 * Store the id of the context menu
	 * so that we can update it rather than creating it many times
	 */
	contextMenu: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bindEvents();
		background.updateWhitelist();
	},

	/**
	 * Bind events
	 */
	bindEvents: function () {
		chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
			background[ message.method ]( message, sender, sendResponse );
		});
	},

	/**
	 * Create the context menu if it doesn't already exist
	 */
	createContextMenu: function ( message, sender, sendResponse ) {
		if ( ! background.contextMenu ) {
			background.contextMenu = chrome.contextMenus.create({
				"title": "Edit with Edity",
				"contexts": [ "link", "selection" ],
				"onclick" : background.edit
			});
		}
	},

	/**
	 * Remove the context menu
	 */
	removeContextMenu: function ( message, sender, sendResponse ) {
		if ( background.contextMenu ) {
			chrome.contextMenus.remove( background.contextMenu );
		}
	},

	/**
	 * Set the badge of the Edity icon
	 */
	setBadge: function ( message, sender, sendResponse ) {
		chrome.browserAction.setBadgeText({ 'tabId': sender.tab.id, 'text': message.text });
	},

	/**
	 * Get the badge of the Edity icon
	 */
	getBadge: function ( message, sender, sendResponse ) {
		chrome.browserAction.getBadgeText({ 'tabId': sender.tab.id }, function ( text ) {
			sendResponse( text );
		});
	},

	/**
	 * Get changes for the current URL
	 */
	getChanges: function ( message, sender, sendResponse ) {

		// Check if the URL is in the whitelist
		var url = sender.tab.url;
		if ( background.whitelist.indexOf( url ) === -1 ) {
			sendResponse([]); // Not in the whitelist, so no changes
			return;
		}

		// Check if we already have the changes
		var changes = background.changes;
		if ( url in changes ) {
			sendResponse( changes[ url ] );
			return;
		}

		// Retrieve the changes from the wiki
		var data = { 'titles': url, 'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'format': 'json' };
		$.get( 'https://edity.org/api.php', data, function ( response ) {
			//console.log( response );

			// Check if the wiki page still exists
			var id = parseInt( Object.keys( response.query.pages )[0] );
			if ( id === -1 ) {
				whitelist.splice( whitelist.indexOf( url ), 1 ); // Remove the URL from the whitelist
				sendResponse([]);
				return;
			}

			// Check if the content is valid (in case of vandalism)
			var content = response.query.pages[ id ].revisions[0]['*']; // Unwrap the content
			content = JSON.parse( content );
			if ( content === null ) {
				whitelist.splice( whitelist.indexOf( url ), 1 );
				sendResponse([]);
				return;
			}

			// Assume that the content is a valid array of changes
			changes[ url ] = content;
			sendResponse( changes[ url ] );
		});
	},

	/**
	 * Update the whitelist with the latest list of edited URLs
	 */
	updateWhitelist: function () {
		var data = { 'action': 'query', 'list': 'allpages', 'format': 'json' };
		$.get( 'https://edity.org/api.php', data, function ( response ) {
			//console.log( response );
			response.query.allpages.forEach( function ( page ) {
				background.whitelist.push( page.title );
			});
		});
	},

	/**
	 * Get the edit token and tell the contentScript to make the last clicked element editable
	 */
	edit: function ( info, tab ) {
		if ( background.editToken ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'edit', 'editToken': background.editToken });
		} else {
			var data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				background.editToken = response.query.tokens.csrftoken;
				chrome.tabs.sendMessage( tab.id, { 'method': 'edit', 'editToken': background.editToken });
			});
		}
	}
};

$( background.init );