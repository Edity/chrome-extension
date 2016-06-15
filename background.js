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
	 * ID of the context menu
	 */
	contextMenu: null,

	/**
	 * Initialization script
	 */
	init: function () {
		background.bindEvents();
		background.requestWhitelist();
		background.requestBlacklist();
		background.contextMenu = chrome.contextMenus.create({
			'title': 'Edit with Edity',
			'contexts': [ 'link', 'selection' ],
			'onclick' : background.edit
		});
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
	 * Send the requested property to the content script
	 */
	sendProperty: function ( message, sender, sendResponse ) {
		sendResponse( background[ message.property ] );
	},

	/**
	 * Update the context menu based on the URL sent from the content script
	 */
	updateContextMenu: function ( message, sender, sendResponse ) {
		var enabled = background.inBlacklist( message.url ) ? false : true;
		chrome.contextMenus.update( background.contextMenu, { 'enabled': enabled });
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
	 * Request the latest whitelist from the wiki
	 */
	requestWhitelist: function () {
		var data = { 'action': 'query', 'list': 'allpages', 'format': 'json' };
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
	 */
	requestBlacklist: function () {
		var data = { 'action': 'query', 'list': 'protectedtitles', 'format': 'json' };
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
	 */
	requestEditToken: function () {
		var data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
		return $.get( 'https://edity.org/api.php', data, function ( response ) {
			//console.log( response );
			background.editToken = response.query.tokens.csrftoken;
		});
	},

	/**
	 * Tell the active tab to make the last clicked element editable
	 */
	edit: function ( info, tab ) {
		if ( background.editToken ) {
			chrome.tabs.sendMessage( tab.id, { 'method': 'edit', 'editToken': background.editToken });
		} else {
			background.requestEditToken().then( function () {
				background.edit( info, tab );
			});
		}
	},

	/**
	 * Check if the given URL is in the whitelist
	 */
	inWhitelist: function ( url ) {
		if ( background.whitelist.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	},

	/**
	 * Check if the given URL is in the blacklist
	 */
	inBlacklist: function ( url ) {
		if ( background.blacklist.indexOf( url ) === -1 ) {
			return false;
		}
		return true;
	}
};

$( background.init );