/**
 * Config of the hallo text editor
 */
var halloConfig = {
	plugins: {
		'halloformat': { 'bold': true, 'italic': true, 'strikethrough': true, 'underline': true },
		'hallolink': true,
		'halloimage': true
	}
};

var url = document.URL;

// If the URL has a hash, remove it and everything after it
var indexOfHash = url.indexOf( "#" );
if ( indexOfHash > -1 ) {
	url = url.substr( 0, indexOfHash );
}

data = {
	'titles': url,
	'action': 'query',
	'prop': 'revisions',
	'rvprop': 'content',
	'format': 'json'
};

/**
 * Changes to the URL retrived from the wiki
 */
var changes = [];

/**
 * Changes that are actually done to the web page
 */
var liveChangeCount = 0;

$.get( 'http://localhost/mediawiki/api.php', data, function ( response ) {
	//console.log( response );

	// Unwrap the content
	for ( var id in response.query.pages ) {
		changes = response.query.pages[ id ].revisions[ 0 ][ '*' ];
	}
	changes = JSON.parse( changes );

	changes.forEach( function ( change ) {
		if ( document.body.innerHTML.search( change.oldHTML ) > -1 ) {
			document.body.innerHTML = document.body.innerHTML.replace( change.oldHTML, change.newHTML );
			liveChangeCount++;
		}
	})

	if ( liveChangeCount > 0 ) {
		chrome.runtime.sendMessage({ 'liveChangeCount': liveChangeCount });
	}
});

// Track the last clicked element and make it editable when the background says so
var lastClickedElement;
$( 'body' ).mousedown( function ( event ) {
	lastClickedElement = $( event.target );
});

chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {

	if ( message.action === 'edit' ) {

		var oldHTML = lastClickedElement.prop( 'outerHTML' );

		lastClickedElement.hallo( halloConfig ).focus().keydown( function ( event ) {

			if ( event.keyCode === 13 ) {

				// Remove all traces of hallo
				lastClickedElement.removeAttr( 'contentEditable' ).removeClass( 'isModified inEditMode' );
				if ( !lastClickedElement.hasClass() ) {
					lastClickedElement.removeAttr( 'class' );
				}

				var newHTML = lastClickedElement.prop( 'outerHTML' );

				var addChange = true;
				changes.forEach( function ( change, index ) {
					// If the change was to an already modified element, merge the changes, rather than adding a new one
					if ( oldHTML === change.newHTML ) {
						change.newHTML = newHTML;
						addChange = false;
					}
					// If the change happens to return the HTML to its original state, remove the change, per useless
					if ( change.oldHTML === newHTML ) {
						changes.splice( index, 1 );
						liveChangeCount--;
						addChange = false;
					}
				});

				// If the change is new, add it to the array of changes
				if ( addChange ) {
					var newChange = { 'oldHTML': oldHTML, 'newHTML': newHTML };
					liveChangeCount++;
					changes.push( newChange );
				}

				data = {
					'action': 'edit',
					'title': url,
					'text': JSON.stringify( changes ),
					'token': message.editToken,
					'format': 'json'
				};

				$.post( 'http://localhost/mediawiki/api.php', data, function ( response ) {
					//console.log( response );
					chrome.runtime.sendMessage({ 'liveChangeCount': liveChangeCount });
				});

				return;
			}
		});
	}
});