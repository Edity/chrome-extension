chrome.contextMenus.create({
	"title": "Edit with Edity",
	"contexts": [ "link", "selection" ],
	"onclick" : edit
});

/**
 * We only need to get the edit token once per session
 */
var editToken;

function edit( info, tab ) {
	if ( editToken ) {
		chrome.tabs.sendMessage( tab.id, { 'action': 'edit', 'editToken': editToken });
	} else {
		var data = { 'action': 'query', 'meta': 'tokens', 'format': 'json' };
		$.get( 'http://edity.org/api.php', data, function ( response ) {
			editToken = response.query.tokens.csrftoken;
			chrome.tabs.sendMessage( tab.id, { 'action': 'edit', 'editToken': editToken });
		});
	}
}

chrome.runtime.onMessage.addListener( function ( message ) {
	if ( 'liveChangeCount' in message ) {
		chrome.browserAction.setBadgeText({ text: '' + message.liveChangeCount });	
	}
});