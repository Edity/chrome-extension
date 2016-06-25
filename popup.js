/**
 * Main popup object
 */
popup = {

	/**
	 * Convenience property to access the background
	 */
	background: null,

	/**
	 * Initialization script
	 */
	init: function () {
		popup.background = popup.getBackground();
		popup.build();
		popup.bind();
	},

	/**
	 * Build the popup
	 */
	build: function () {
		// Create all the buttons
		this.editPageItem = $( '<li>' ).text( 'Edit this page' );
		this.protectedPageItem = $( '<li>' ).text( 'This page is protected' );
		this.editCountItem = $( '<li>' ).text( 'No edits to this page' );
		this.latestEditsItem = $( '<li>' ).text( 'Request latest edits to this page' );
		this.randomPageItem = $( '<li>' ).text( 'Random edited page' );
		this.reportItem = $( '<li>' ).text( 'Report a problem' );
		this.shareItem = $( '<li>' ).text( 'Help spread the word' );

		// Add the relevant ones to the menu
		if ( this.background.inBlacklist( this.background.url ) ) {
			$( '#edity-menu' ).append( this.protectedPageItem );
		} else {
			$( '#edity-menu' ).append( this.editPageItem );
		}
		$( '#edity-menu' ).append(
			this.editCountItem,
			this.latestEditsItem,
			this.randomPageItem,
			this.reportItem,
			this.shareItem
		);
	},

	/**
	 * Bind events
	 */
	bind: function () {
		this.editPageItem.click( popup.onEditPageItemClick );
		this.protectedPageItem.click( popup.onProtectedPageItemClick );
		this.editCountItem.click( popup.onEditCountItemClick );
		this.latestEditsItem.click( popup.onLatestEditsItemClick );
		this.randomPageItem.click( popup.onRandomPageItemClick );
		this.reportItem.click( popup.onReportItemClick );
		this.shareItem.click( popup.onShareItemClick );
	},

	/**
	 * Convenience method to close the popup
	 */
	close: function () {
		window.close();
	},

	/**
	 * Convenience method to get the background
	 */
	getBackground: function () {
		return chrome.extension.getBackgroundPage().background;
	},

	/**
	 * Start the edit mode
	 */
	onEditPageItemClick: function ( event ) {
		popup.background.queryCurrentTab( function ( tab ) {
			popup.background.edit( tab );
			popup.close();
		});
	},

	/**
	 * Send the user to the wiki
	 */
	onProtectedPageItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/Edity:Protected_pages'
		});
	},

	/**
	 * Send the user to the wiki
	 */
	onEditCountItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/' + popup.url
		});
	},

	/**
	 * Send the user to a random edited page
	 */
	onRandomPageItemClick: function ( event ) {
		popup.background.queryCurrentTab( function ( tab ) {
			chrome.tabs.update( tab.id, {
				'url': popup.background.whitelist[ Math.floor( Math.random() * popup.background.whitelist.length ) ]
			});
			popup.close();
		});
	},

	/**
	 * Request the latest edits from the wiki
	 */
	onLatestEditsItemClick: function ( event ) {
		popup.background.requestWhitelist().then( function () {
			chrome.tabs.reload(); // A reload is not strictly necessary, but it's clearer to the user
			popup.close();
		});
	},

	/**
	 * Send the user to the report page
	 */
	onReportItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/Edity:Report_a_problem'
		});
	},

	/**
	 * Send the user to the report page
	 */
	onShareItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/Edity:Help_spread_the_word'
		});
	}
};

$( popup.init );