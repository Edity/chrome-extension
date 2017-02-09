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
	 * The domain of the active tab
	 */
	domain: '',

	/**
	 * The badge of the active tab
	 */
	badge: '',

	/**
	 * Initialization script
	 */
	init: function () {
		popup.background = popup.getBackground();

		// Get the active tab, url, domain and badge
		popup.background.getActiveTab( function ( tab ) {
			popup.tab = tab;
			popup.background.getActiveURL( function ( url ) {
				popup.url = url;
				popup.background.getActiveDomain( function ( domain ) {
					popup.domain = domain;
					popup.background.getActiveBadge( function ( badge ) {
						popup.badge = badge;

						// When all the info is gathered, build the popup
						popup.build();
						popup.bind();
					});					
				});
			});
		});

		// Every time the popup opens, update the edited URLs
		popup.background.wiki.getEditedURLs( function ( editedURLs ) {
			popup.background.editedURLs = editedURLs;
		});
	},

	/**
	 * Build the popup
	 */
	build: function () {
		// Create the header
		this.edityHeader = $( '<div>' ).prop( 'id', 'edity-header' );
		this.edityLogo = $( '<img>' ).prop( 'src', 'images/icon19.png' );
		this.edityTitle = $( '<big>' ).text( 'Edity' );
		this.edityMotto = $( '<span>' ).text( 'Edit the Web' );

		// Create the menu
		this.menu = $( '<ul>' ).prop( 'id', 'edity-menu' );
		this.editPageItem = $( '<li>' ).text( 'Edit this page' );
		this.protectedDomainItem = $( '<li>' ).text( this.domain + ' is protected' );
		this.editCountItem = $( '<li>' ).text( ( this.badge ? this.badge : 'No' ) + ' edit' + ( this.badge === '1' ? '' : 's' ) + ' to this page' );
		this.randomPageItem = $( '<li>' ).text( 'Random edited page' );
		this.reportsAndRequestsItem = $( '<li>' ).text( 'Reports and requests' );

		// Put it all together
		this.edityHeader.append( this.edityLogo, this.edityTitle, this.edityMotto );
		if ( this.background.isProtected( this.domain ) ) {
			this.menu.append( this.protectedDomainItem );
		} else {
			this.menu.append( this.editPageItem, this.editCountItem );
		}
		this.menu.append( this.randomPageItem, this.reportsAndRequestsItem );

		// Add it to the DOM
		$( 'body' ).append( this.edityHeader, this.menu );
	},

	/**
	 * Bind events
	 */
	bind: function () {
		this.edityHeader.click( popup.onEdityHeaderClick );
		this.editPageItem.click( popup.onEditPageItemClick );
		this.editPageItem.click( popup.onEditPageItemClick );
		this.editCountItem.click( popup.onEditCountItemClick );
		this.protectedDomainItem.click( popup.onProtectedDomainItemClick );
		this.randomPageItem.click( popup.onRandomPageItemClick );
		this.reportsAndRequestsItem.click( popup.onReportsAndRequestsItemClick );
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
	 * Visit the wiki
	 */
	onEdityHeaderClick: function ( event ) {
		chrome.tabs.create({
			'url': 'http://edity.org'
		});
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
	onProtectedDomainItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'http://edity.org/Edity:Protected_pages'
		});
	},

	/**
	 * Send the user to the wiki
	 */
	onEditCountItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'http://edity.org/' + ( popup.badge ? popup.url : 'Editing_guidelines' )
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
	 * Send the user to the report page
	 */
	onReportsAndRequestsItemClick: function ( event ) {
		chrome.tabs.create({
			'url': 'http://edity.org/Edity:Reports_and_requests'
		});
	}
};

$( popup.init );