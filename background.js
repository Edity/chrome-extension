background = {

	/**
	 * All changes retrived from the wiki
	 * We store them to minimize requests
	 * This object will have URLs as property names
	 * and the corresponding array of changes as values
	 */
	changes: {},

	/**
	 * Store the edit token because we only need one per session
	 */
	editToken: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bindEvents();
	},

	/**
	 * Bind events
	 */
	bindEvents: function () {
		chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
			background[ message.method ]( message, sender, sendResponse );
		});
	},

	createContextMenu: function () {
		chrome.contextMenus.create({
			"title": "Edit with Edity",
			"contexts": [ "link", "selection" ],
			"onclick" : background.edit
		});
	},

	removeContextMenu: function () {
		chrome.contextMenus.removeAll();
	},

	setBadge: function ( message, sender ) {
		chrome.browserAction.setBadgeText({ 'tabId': sender.tab.id, 'text': message.text });
	},

	getBadge: function ( message, sender, sendResponse ) {
		chrome.browserAction.getBadgeText({ 'tabId': sender.tab.id }, function ( text ) {
			sendResponse( text );
		});
	},

	getChanges: function ( message, sender, sendResponse ) {
		var url = sender.tab.url,
			changes = background.changes;

		if ( url in changes ) {
			sendResponse( changes[ url ] );
			return;
		}

		var data = { 'titles': url, 'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'format': 'json' };

		$.get( 'https://edity.org/api.php', data, function ( response ) {
			console.log( response );

			// First check if the wiki page exists
			var id = parseInt( Object.keys( response.query.pages )[0] );
			if ( id === -1 ) {
				changes[ url ] = [];
				sendResponse( changes[ url ] );
				return;
			}

			// Then check if the content is valid (in case of recent vandalism)
			var content = response.query.pages[ id ].revisions[0]['*']; // Unwrap the content
			content = JSON.parse( content );
			if ( content === null ) {
				changes[ url ] = [];
				sendResponse( changes[ url ] );
				return;
			}

			// If we reach this point, assume that the content is a valid array of changes
			changes[ url ] = content;
			sendResponse( changes[ url ] );
		});
	},

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