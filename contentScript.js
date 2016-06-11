contentScript = {

	/**
	 * The current URL
	 */
	url: null,

	/**
	 * Array of changes to the current URL
	 */
	changes: [],

	/**
	 * Amount of changes actually done to the current page
	 * This may be less than the changes retrived from the wiki
	 * for example in dynamic pages like Facebook
	 * or in pages where the source HTML has changed
	 */
	liveChangeCount: 0,

	/**
	 * Track the last clicked element to make it editable when the background says so
	 */
	lastClickedElement: null,

	/**
	 * List of URLs that aren't be editable
	 */
	blacklist: [
		window.location.origin, // The home page of the sites shouldn't be editable?
		window.location.origin + '/',
		window.location.origin + '/index.html',
	],

	/**
	 * Config of the Hallo text editor
	 */
	halloConfig: {
		plugins: {
			'halloformat': {
				"formattings": {
					"bold": true,
					"italic": true,
					"underline": true,
					"strikethrough": true
				}
			},
			'hallolink': true,
			'halloimage': true
		}
	},

	/**
	 * Initialization script
	 */
	init: function () {
		contentScript.url = contentScript.getCurrentURL();
		contentScript.bindEvents();
		contentScript.updateChanges();
		contentScript.updateContextMenu();
	},

	/**
	 * Bind events
	 */
	bindEvents: function () {
		$( 'body' ).mousedown( function () {
			contentScript.lastClickedElement = $( event.target );
		});
		chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
			contentScript[ message.method ]( message, sender, sendResponse );
		});
	},

	/**
	 * Get the current URL but without the hash
	 */
	getCurrentURL: function () {
		var url = window.location.href,
			indexOfHash = url.indexOf( "#" );
		if ( indexOfHash > -1 ) {
			url = url.substr( 0, indexOfHash );
		}
		return url;
	},

	/**
	 * Get the changes from the background or the wiki 
	 */
	updateChanges: function () {
		chrome.runtime.sendMessage({ 'method': 'getChanges' }, function ( response ) {
			//console.log( response );
			contentScript.changes = response;
			response.forEach( function ( change ) {
				if ( document.body.innerHTML.indexOf( change.oldHTML ) > -1 ) {
					document.body.innerHTML = document.body.innerHTML.replace( change.oldHTML, change.newHTML ); // This is the magic line
					contentScript.liveChangeCount++;
				}
			});
			contentScript.updateBadge();
		});
	},

	/**
	 * Update the badge with the latest liveChangeCount
	 */
	updateBadge: function () {
		var text = '';
		if ( contentScript.liveChangeCount > 0 ) {
			text += contentScript.liveChangeCount;
		}
		chrome.runtime.sendMessage({ 'method': 'setBadge', 'text': text });
	},

	/**
	 * Update the context menu
	 */
	updateContextMenu: function () {
		if ( contentScript.blacklist.indexOf( contentScript.url ) === -1 ) {
			chrome.runtime.sendMessage({ 'method': 'createContextMenu' });
		} else {
			chrome.runtime.sendMessage({ 'method': 'removeContextMenu' });
		}
	},

	/**
	 * Make the last clicked element editable
	 */
	edit: function ( message, sender, sendResponse ) {
		var element = contentScript.lastClickedElement,
			oldHTML = element.prop( 'outerHTML' );

		element.hallo( contentScript.halloConfig ).focus().keydown( function ( event ) {
			if ( event.keyCode === 13 ) {
				contentScript.save( element, oldHTML, message.editToken );
			}
		});
	},

	/**
	 * Save the edited element
	 */
	save: function ( element, oldHTML, editToken ) {

		// Remove all traces of Hallo
		element.removeAttr( 'contentEditable' ).removeClass( 'isModified inEditMode' );
		if ( !element.hasClass() ) {
			element.removeAttr( 'class' );
		}

		var newHTML = element.prop( 'outerHTML' ),
			addChange = true;

		contentScript.changes.forEach( function ( change, index ) {
			// If the change is to an already modified element, merge the changes
			if ( oldHTML === change.newHTML ) {
				change.newHTML = newHTML;
				addChange = false;
			}
			// If the change happens to return the HTML to its original state, remove the change, per useless
			// For example, in case a user makes a mistake and then corrects it, or repents of a vandalism
			if ( change.oldHTML === newHTML ) {
				contentScript.changes.splice( index, 1 );
				contentScript.liveChangeCount--;
				addChange = false;
			}
		});

		// If the change is new, add it to the array of changes
		if ( addChange ) {
			var newChange = { 'oldHTML': oldHTML, 'newHTML': newHTML };
			contentScript.liveChangeCount++;
			contentScript.changes.push( newChange );
		}

		var data = {
			'action': 'edit',
			'title': contentScript.url,
			'text': JSON.stringify( contentScript.changes ),
			'token': editToken,
			'format': 'json'
		};

		$.post( 'https://edity.org/api.php', data, function ( response ) {
			//console.log( response );
			contentScript.updateBadge();
		});

		return;

	}
};

$( contentScript.init );