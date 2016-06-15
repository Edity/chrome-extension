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
	 * for example in dynamic pages or in pages where the source has changed
	 */
	liveEditCount: 0,

	/**
	 * Track the last clicked element to make it editable when the background says so
	 */
	lastClickedElement: null,

	/**
	 * Config of the Hallo text editor
	 */
	halloConfig: {
		'editable': true,
		'plugins': {
			'halloformat': {
				'formattings': {
					'bold': true,
					'italic': true,
					'underline': true,
					'strikethrough': true
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
		contentScript.url = contentScript.getCleanURL();
		contentScript.bindEvents();
		contentScript.updateContextMenu();
		contentScript.requestChanges();
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
	 * Get the current URL, normalized
	 */
	getCleanURL: function () {
		return window.location.origin + window.location.pathname;
	},

	/**
	 * Ask the background to update the badge
	 */
	updateBadge: function () {
		var text = '';
		if ( contentScript.liveEditCount > 0 ) {
			text += contentScript.liveEditCount;
		}
		chrome.runtime.sendMessage({ 'method': 'updateBadge', 'text': text });
	},

	/**
	 * Ask the background to update the context menu
	 */
	updateContextMenu: function () {
		chrome.runtime.sendMessage({ 'method': 'updateContextMenu', 'url': contentScript.url });
	},

	/**
	 * Ask the background to update the whitelist with the current URL
	 */
	updateWhitelist: function () {
		chrome.runtime.sendMessage({ 'method': 'updateWhitelist', 'url': contentScript.url });
	},

	/**
	 * Request the changes from the wiki 
	 */
	requestChanges: function () {
		chrome.runtime.sendMessage({ 'method': 'sendProperty', 'property': 'whitelist' }, function ( whitelist ) {
			//console.log( response );

			if ( whitelist.indexOf( contentScript.url ) === -1 ) {
				return; // Not in the whitelist
			}
/*
			if ( blacklist.indexOf( contentScript.url ) > -1 ) {
				return; // In the blacklist
			}
*/
			var data = { 'titles': contentScript.url, 'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );

				// Make sure the wiki page exists
				var id = parseInt( Object.keys( response.query.pages )[0] );
				if ( id === -1 ) {
					return;
				}

				// Make sure the content is valid (in case of vandalism)
				var content = response.query.pages[ id ].revisions[0]['*']; // Unwrap the content
				content = JSON.parse( content );
				if ( content === null ) {
					return;
				}

				// Assume that the content is a valid array of changes
				contentScript.changes = content;
				contentScript.changes.forEach( function ( change ) {
					if ( document.body.innerHTML.indexOf( change.oldHTML ) > -1 ) {
						document.body.innerHTML = document.body.innerHTML.replace( change.oldHTML, change.newHTML ); // This is the magic line
						contentScript.liveEditCount++;
					}
				});
				contentScript.updateBadge();
			});
		});
	},

	/**
	 * Make the last clicked element editable
	 */
	edit: function ( message, sender, sendResponse ) {
		var element = contentScript.lastClickedElement,
			oldHTML = element.prop( 'outerHTML' );

		// Initialize Rangy
		rangy.init();
		console.log( rangy );

		// Create the toolbar elements
		var toolbar = $( '<div>' ).attr( 'id', 'edity-toolbar' ),
			saveButton = $( '<button>' ).attr( 'id', 'edity-save-button' ).text( 'Save' ).click( function ( event ) {
				contentScript.save( element, oldHTML, message.editToken );
			});
			boldButton = $( '<button>' ).attr( 'id', 'edity-bold-button' ).html( '<strong>B</strong>' ).click( function ( event ) {
				var boldApplier = rangy.createCssClassApplier( 'edity-bold', { 'elementTagName': 'strong' });
				boldApplier.toggleSelection();
			});
			italicButton = $( '<button>' ).attr( 'id', 'edity-italic-button' ).html( '<em>i</em>' ).click( function ( event ) {
				var italicApplier = rangy.createCssClassApplier( 'edity-italic', { 'elementTagName': 'em' });
				italicApplier.toggleSelection();
			});
			underlineButton = $( '<button>' ).attr( 'id', 'edity-underline-button' ).html( '<u>U</u>' ).click( function ( event ) {
				var underlineApplier = rangy.createCssClassApplier( 'edity-underline', { 'elementTagName': 'u' });
				underlineApplier.toggleSelection();
			});
			strikeButton = $( '<button>' ).attr( 'id', 'edity-strike-button' ).html( '<strike>S</strike>' ).click( function ( event ) {
				var strikeApplier = rangy.createCssClassApplier( 'edity-strike', { 'elementTagName': 'strike' });
				strikeApplier.toggleSelection();
			});
			linkButton = $( '<button>' ).attr( 'id', 'edity-link-button' ).html( 'Link' ).click( function ( event ) {
				var linkApplier = rangy.createCssClassApplier( 'edity-link', { 'elementTagName': 'a' });
				linkApplier.toggleSelection();
			});

		// Put it all together
		toolbar.append( saveButton, boldButton, italicButton, underlineButton, strikeButton, linkButton );

		// Add it to the DOM
		$( 'body' ).append( toolbar );

		// Make the element editable
		element.attr( 'contentEditable', true ).focus();
	},

	/**
	 * Save the edited element
	 */
	save: function ( element, oldHTML, editToken ) {

		// Remove all traces of the editor
		$( '#edity-toolbar' ).remove();
		element.removeAttr( 'contentEditable' );

		var newHTML = element.prop( 'outerHTML' ),
			addChange = true;

		contentScript.changes.forEach( function ( change, index ) {

			// If the change is to an already modified element, merge the changes
			if ( oldHTML === change.newHTML ) {
				change.newHTML = newHTML;
				addChange = false;
			}
			// If the change happens to return the HTML to its original state, remove the change, per useless
			// For example, if a user makes a change and then repents
			if ( newHTML === change.oldHTML ) {
				contentScript.changes.splice( index, 1 );
				contentScript.liveEditCount--;
				addChange = false;
			}
		});

		// If the change is new, add it to the array of changes
		if ( addChange ) {
			var newChange = { 'oldHTML': oldHTML, 'newHTML': newHTML };
			contentScript.liveEditCount++;
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
			contentScript.updateWhitelist();
		});
	}
};

$( contentScript.init );