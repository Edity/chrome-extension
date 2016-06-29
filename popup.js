/**
 * Main popup object
 */
popup = {

	/**
	 * Convenience property to access the background
	 */
	background: null,

	/**
	 * The active tab
	 */
	tab: null,

	/**
	 * The URL of the active tab
	 */
	url: '',

	/**
	 * The badge of the active tab
	 */
	badge: '',

	/**
	 * Initialization script
	 */
	init: function () {
		popup.background = popup.getBackground();
		popup.background.getActiveTab( function ( tab ) {
			popup.tab = tab;
			popup.background.getActiveURL( function ( url ) {
				popup.url = url;
				popup.background.getActiveBadge( function ( badge ) {
					popup.badge = badge;
					popup.build();
					popup.bind();
				});
			});
		});
	},

	/**
	 * Build the popup
	 */
	build: function () {
		// Create the elements
		this.header = $( '<div>' ).prop( 'id', 'edity-header' );
		this.logo = $( '<img>' ).attr( 'src', 'images/icon19.png' );
		this.title = $( '<big>' ).text( 'Edity' );
		this.motto = $( '<span>' ).text( 'Edit the Web' );

		this.menu = $( '<ul>' ).prop( 'id', 'edity-menu' );
		this.editPageItem = $( '<li>' ).text( 'Edit this page' );
		this.protectedPageItem = $( '<li>' ).text( 'This page is protected' );
		this.editCountItem = $( '<li>' ).text( ( this.badge ? this.badge : 'No' ) + ' edit' + ( this.badge === '1' ? '' : 's' ) + ' to this page' );
		this.reloadEditsItem = $( '<li>' ).text( 'Reload edits to this page' );
		this.randomPageItem = $( '<li>' ).text( 'Random edited page' );
		this.reportItem = $( '<li>' ).text( 'Report a problem' );

		// Put it all together
		this.header.append(
			this.logo,
			this.title,
			this.motto
		);
		this.menu.append(
			this.randomPageItem,
			this.reportItem
		);
		if ( this.background.isProtected( this.url ) ) {
			this.menu.prepend(
				this.protectedPageItem
			);
		} else {
			this.menu.prepend(
				this.editPageItem,
				this.editCountItem,
				this.reloadEditsItem
			);
		}

		// Add it to the DOM
		$( 'body' ).append(
			this.header,
			this.menu
		);
	},

	/**
	 * Bind events
	 */
	bind: function () {
		this.editPageItem.click( popup.onEditPageItemClick );
		this.editCountItem.click( popup.onEditCountItemClick );
		this.reloadEditsItem.click( popup.onReloadEditsItemClick );
		this.randomPageItem.click( popup.onRandomPageItemClick );
		this.reportItem.click( popup.onReportItemClick );
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
		popup.background.contentScript.startEdit( popup.tab );
		popup.close();
	},

	/**
	 * Send the user to the wiki
	 */
	onProtectedPageItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/Edity:Protected_sites'
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
		chrome.tabs.update( popup.tab.id, {
			'url': popup.background.editedURLs[ Math.floor( Math.random() * popup.background.editedURLs.length ) ]
		});
		popup.close();
	},

	/**
	 * Request the latest edits from the wiki
	 */
	onReloadEditsItemClick: function ( event ) {
		popup.background.wiki.getEditedURLs( function ( editedURLs ) {
			popup.background.editedURLs = editedURLs;
			chrome.tabs.reload(); // A reload is not strictly necessary, but it's easier to program and clearer to the user
		});
	},

	/**
	 * Send the user to the report page
	 */
	onReportItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'https://edity.org/Edity:Report_a_problem'
		});
	}
};

$( popup.init );