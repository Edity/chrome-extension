/**
 * Main content script object
 */
contentScript = {

	/**
	 * The current URL without query string or hash
	 */
	url: window.location.origin + window.location.pathname,

	/**
	 * Array of edits associated to the current URL
	 */
	edits: [],

	/**
	 * Amount of edits visible in the current page
	 * May be less than edits.length, for example in pages with dynamic content
	 */
	liveEditCount: 0,

	/**
	 * Initialization script
	 */
	init: function () {
		contentScript.bind();
		contentScript.background.createContextMenu();
		contentScript.background.hasEdits( function ( hasEdits ) {
			if ( hasEdits ) {
				contentScript.wiki.requestEdits();
			}
		});
	},

	/**
	 * Bind events
	 */
	bind: function () {
		chrome.runtime.onMessage.addListener( contentScript.background.onMessage );
	},

	/**
	 * Sub-object to communicate with the wiki
	 */
	wiki: {

		/**
		 * Request the edits to the current URL
		 */
		requestEdits: function () {
			let data = { 'titles': contentScript.url, 'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'format': 'json' };
			return $.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );

				// Make sure the wiki page exists
				let id = parseInt( Object.keys( response.query.pages )[0] );
				if ( id === -1 ) {
					return;
				}

				// Make sure the content is valid (in case of vandalism)
				let content = response.query.pages[ id ].revisions[0]['*']; // Unwrap the content
				content = JSON.parse( content );
				if ( content === null ) {
					return;
				}

				// Assume that the content is a valid array of edits
				contentScript.edits = content;
				contentScript.edits.forEach( function ( edit ) {
					if ( document.body.innerHTML.indexOf( edit.oldHTML ) > -1 ) {
						document.body.innerHTML = document.body.innerHTML.replace( edit.oldHTML, edit.newHTML ); // This is the magic line
						contentScript.liveEditCount++;
					}
				});
				contentScript.background.updateBadge();
			});
		}
	},

	/**
	 * Sub-object to communicate with the background
	 */
	background: {

		/**
		 * Event handler
		 */
		onMessage: function ( message, sender, sendResponse ) {
			contentScript.background[ message.method ]( message, sender, sendResponse );
		},

		/**
		 * Start the edit mode when the background says so
		 */
		startEdit: function ( message, sender, sendResponse ) {
			contentScript.toolbar.init();
			contentScript.editToken = message.editToken;
		},

		/**
		 * Ask the background if the current URL has edits
		 */
		hasEdits: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'hasEdits', 'url': contentScript.url }, callback );
		},

		/**
		 * Ask the background to update the badge with the latest liveEditCount
		 */
		updateBadge: function ( callback ) {
			let text = '';
			if ( contentScript.liveEditCount > 0 ) {
				text += contentScript.liveEditCount;
			}
			chrome.runtime.sendMessage({ 'method': 'updateBadge', 'text': text }, callback );
		},
	
		/**
		 * Ask the background to add the current URL to the whitelist
		 */
		updateWhitelist: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'updateWhitelist', 'url': contentScript.url }, callback );
		},

		/**
		 * Ask the background to create a context menu specific for this tab
		 */
		createContextMenu: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'createContextMenu', 'url': contentScript.url }, callback );
		}
	},

	/**
	 * Sub-object for the toolbar
	 */
	toolbar: {

		/**
		 * The element being currently edited
		 */
		element: null,

		/**
		 * Original HTML of the element
		 */
		oldHTML: '',

		/**
		 * Initialization script
		 */
		init: function () {
			rangy.init();
			this.build();
			this.bind();
		},

		/**
		 * Build the toolbar
		 */
		build: function () {
			// Create the toolbar and its elements
			this.toolbar = $( '<div>' ).attr( 'id', 'edity-toolbar' );
			this.rightButtons = $( '<div>' ).addClass( 'edity-float-right' );
			this.boldButton = $( '<button>' );
			this.boldButtonText = $( '<b>' ).text( 'B' );
			this.italicButton = $( '<button>' );
			this.italicButtonText = $( '<i>' ).text( 'I' );
			this.strikeButton = $( '<button>' );
			this.strikeButtonText = $( '<s>' ).text( 'S' );
			this.underlineButton = $( '<button>' );
			this.underlineButtonText = $( '<u>' ).text( 'U' );
			this.linkButton = $( '<button>' );
			this.linkButtonText = $( '<span>' ).text( 'Link' );
			this.cancelButton = $( '<button>' );
			this.cancelButtonText = $( '<span>' ).text( 'Cancel' );
			this.saveButton = $( '<button>' );
			this.saveButtonText = $( '<span>' ).text( 'Save' );

			// Put it all together
			this.boldButton.html( this.boldButtonText );
			this.italicButton.html( this.italicButtonText );
			this.strikeButton.html( this.strikeButtonText );
			this.underlineButton.html( this.underlineButtonText );
			this.linkButton.html( this.linkButtonText );
			this.cancelButton.html( this.cancelButtonText );
			this.saveButton.html( this.saveButtonText );
			this.rightButtons.append(
				this.cancelButton,
				this.saveButton
			);
			this.toolbar.append(
				this.rightButtons,
				this.boldButton,
				this.italicButton,
				this.underlineButton,
				this.strikeButton,
				this.linkButton
			);

			// Add it to the DOM
			$( 'body' ).append( this.toolbar );
		},

		/**
		 * Bind events
		 */
		bind: function () {
			$( 'body' ).click( this.onBodyClick );
			this.saveButton.click( this.onSaveButtonClick );
			this.cancelButton.click( this.onCancelButtonClick );
			this.italicButton.click( this.onItalicButtonClick );
			this.boldButton.click( this.onBoldButtonClick );
			this.underlineButton.click( this.onUnderlineButtonClick );
			this.strikeButton.click( this.onStrikeButtonClick );
			this.linkButton.click( this.onLinkButtonClick );
		},

		/**
		 * Update the edits array with the latest edits
		 */
		updateEdits: function () {
			if ( ! contentScript.toolbar.element ) {
				return; // No edits
			}

			// Remove the contenteditable attribute to avoid false positives
			contentScript.toolbar.element.removeAttr( 'contenteditable' );

			let oldHTML = contentScript.toolbar.oldHTML,
				newHTML = contentScript.toolbar.element.prop( 'outerHTML' );

			if ( oldHTML === newHTML ) {
				return; // No edits
			}

			for ( let edit of contentScript.edits ) {

				// If the edit is to an already edited element, merge the edits
				if ( oldHTML === edit.newHTML ) {
					edit.newHTML = newHTML;
					return;
				}
				// If the edit happens to return the HTML to its original state, remove the edit, per useless
				// For example, if a user makes an edit, saves, and then edits again to revert it
				if ( newHTML === edit.oldHTML ) {
					let index = contentScript.edits.indexOf( edit );
					contentScript.edits.splice( index, 1 );
					contentScript.liveEditCount--;
					return;
				}
			}
			// If we reach this point, add the edit to the array of edits
			contentScript.liveEditCount++;
			contentScript.edits.push({ 'oldHTML': oldHTML, 'newHTML': newHTML });
		},

		/**
		 * Event handlers
		 */
		onBodyClick: function ( event ) {
			contentScript.toolbar.updateEdits();

			let element = $( event.target );
			if ( element.closest( '#edity-toolbar' ).length > 0 ) {
				return; // Don't edit the toolbar
			}
			contentScript.toolbar.element = element;
			contentScript.toolbar.oldHTML = element.prop( 'outerHTML' );
			contentScript.toolbar.element.attr( 'contenteditable', true ).focus();
		},

		onSaveButtonClick: function ( event ) {
			contentScript.toolbar.saveDialog.init();
		},

		onCancelButtonClick: function ( event ) {
			contentScript.toolbar.toolbar.remove();
			contentScript.toolbar.element.removeAttr( 'contenteditable' );
			contentScript.toolbar.element.prop( 'outerHTML', contentScript.toolbar.oldHTML );
		},

		onBoldButtonClick: function ( event ) {
			let boldApplier = rangy.createClassApplier( 'edity-bold', { 'elementTagName': 'b' });
			boldApplier.toggleSelection();
		},

		onItalicButtonClick: function ( event ) {
			let italicApplier = rangy.createClassApplier( 'edity-italic', { 'elementTagName': 'i' });
			italicApplier.toggleSelection();
		},

		onUnderlineButtonClick: function ( event ) {
			let underlineApplier = rangy.createClassApplier( 'edity-underline', { 'elementTagName': 'u' });
			underlineApplier.toggleSelection();
		},

		onStrikeButtonClick: function ( event ) {
			let strikeApplier = rangy.createClassApplier( 'edity-strike', { 'elementTagName': 's' });
			strikeApplier.toggleSelection();
		},

		onLinkButtonClick: function ( event ) {
			contentScript.toolbar.linkDialog.init();
		},

		/**
		 * Sub-sub-object for the link dialog
		 */
		linkDialog: {

			/**
			 * Rangy selection object
			 */
			selection: null,

			/**
			 * Save the selection to restore it when the dialog is closed
			 */
			savedSelection: null,

			/**
			 * The link being edited, if any
			 */
			link: null,

			/**
			 * The href of the link
			 */
			href: '',

			/**
			 * The text of the link
			 */
			text: this.href,

			/**
			 * The target of the link
			 */
			target: '_self',

			/**
			 * Initialization script
			 */
			init: function () {
				this.selection = rangy.getSelection();
				this.savedSelection = rangy.saveSelection();
				this.link = this.getLink();
				this.text = this.getText();
				this.href = this.getHref();
				this.target = this.getTarget();
				this.build();
				this.bind();
			},

			/**
			 * Build the link dialog
			 */
			build: function () {
				// Create the save dialog and its elements
				this.linkDialog = $( '<div>' ).addClass( 'edity-dialog' );
				this.hrefInput = $( '<input>' ).attr({ 'type': 'text', 'value': this.href, 'placeholder': this.href });
				this.hrefInputLabel = $( '<label>' ).text( 'Enter the URL of the link' );
				this.textInput = $( '<input>' ).attr({ 'type': 'text', 'value': this.text, 'placeholder': this.text });
				this.textInputLabel = $( '<label>' ).text( 'Enter the text of the link (the URL will be used if not provided)' );
				this.targetCheckbox = $( '<input>' ).attr({ 'type': 'checkbox' });
				this.targetCheckboxLabel = $( '<label>' ).text( 'Open link in a new tab' );
				this.rightButtons = $( '<div>' ).addClass( 'edity-float-right' );
				this.cancelButton = $( '<button>' ).text( 'Cancel' );
				this.saveButton = $( '<button>' ).text( 'Save' );

				// Put it all together
				this.hrefInputLabel.append( this.hrefInput );
				this.textInputLabel.append( this.textInput );
				this.targetCheckboxLabel.prepend( this.targetCheckbox );
				this.rightButtons.append(
					this.cancelButton,
					this.saveButton
				);
				this.linkDialog.append(
					this.hrefInputLabel,
					this.textInputLabel,
					this.targetCheckboxLabel,
					this.rightButtons
				);

				// Add it to the DOM
				$( 'body' ).append( this.linkDialog );
			},

			/**
			 * Bind events
			 */
			bind: function () {
				this.hrefInput.change( this.onHrefInputChange );
				this.textInput.change( this.onTextInputChange );
				this.targetCheckbox.change( this.onTargetCheckboxChange );
				this.cancelButton.click( this.onCancelButtonClick );
				this.saveButton.click( this.onSaveButtonClick );
			},

			/**
			 * Shorthand method to close the link dialog
			 */
			close: function () {
				this.linkDialog.remove();
			},

			/**
			 * Get the link based on the current selection
			 */
			getLink: function () {
				let anchorNode = $( this.selection.anchorNode );
				if ( anchorNode.is( 'a' ) ) {
					return anchorNode;
				}
				let parentNode = $( this.selection.anchorNode.parentNode );
				if ( parentNode.is( 'a' ) ) {
					return parentNode;
				}
				return null;
			},

			/**
			 * Get the link href
			 */
			getHref: function () {
				if ( this.link ) {
					return this.link.attr( 'href' );
				}
				return '';
			},

			/**
			 * Get the link text
			 */
			getText: function () {
				if ( this.link ) {
					return this.link.text();
				}
				return this.selection.toString();
			},

			/**
			 * Get the link target
			 */
			getTarget: function () {
				if ( this.link ) {
					return this.link.attr( 'target' );
				}
				return '_self';
			},

			/**
			 * Event handlers
			 */
			onClose: function ( event ) {
				rangy.restoreSelection( contentScript.toolbar.linkDialog.savedSelection );
			},

			onHrefInputChange: function ( event ) {
				contentScript.toolbar.linkDialog.href = $( event.target ).val();
			},

			onTextInputChange: function ( event ) {
				let text = $( event.target ).val();
				contentScript.toolbar.linkDialog.text = text ? text : contentScript.toolbar.linkDialog.href;
			},

			onTargetCheckboxChange: function ( event ) {
				contentScript.toolbar.linkDialog.target = $( event.target ).prop( 'checked' ) ? '_blank' : '_self';
			},

			onCancelButtonClick: function ( event ) {
				contentScript.toolbar.linkDialog.close();
			},

			onSaveButtonClick: function ( event ) {
				let linkDialog = contentScript.toolbar.linkDialog;

				linkDialog.close();

				if ( linkDialog.link ) {
					linkDialog.link.prop({
						'href': linkDialog.href,
						'target': linkDialog.target,
						'class': 'edity-link'
					}).text( linkDialog.text );
				} else {
					let linkApplier = rangy.createClassApplier( 'edity-link', {
						'elementTagName': 'a',
						'elementProperties': {
							'href': linkDialog.href,
							'target': linkDialog.target
						}
					});
					linkApplier.applyToSelection();
				}
				contentScript.toolbar.updateEdits();
			}
		},

		/**
		 * Sub-sub-object for the save dialog
		 */
		saveDialog: {

			/**
			 * Edit summary
			 */
			summary: '',

			/**
			 * Is it a minor edit?
			 */
			minor: false,

			/**
			 * Initialization script
			 */
			init: function () {
				this.build();
				this.bind();
			},

			/**
			 * Build the save dialog
			 */
			build: function () {
				// Create the save dialog and its elements
				this.saveDialog = $( '<div>' ).addClass( 'edity-dialog' );
				this.summaryInput = $( '<input>' ).attr({ 'type': 'text', 'value': this.summary });
				this.summaryInputLabel = $( '<label>' ).text( 'Briefly describe the edits you did (optional)' );
				this.minorCheckbox = $( '<input>' ).attr({ 'type': 'checkbox' });
				this.minorCheckboxLabel = $( '<label>' ).text( 'This is a minor edit' );
				this.rightButtons = $( '<div>' ).addClass( 'edity-float-right' );
				this.cancelButton = $( '<button>' ).text( 'Cancel' );
				this.saveButton = $( '<button>' ).text( 'Save' );

				// Put it all together
				this.summaryInputLabel.append( this.summaryInput );
				this.minorCheckboxLabel.prepend( this.minorCheckbox );
				this.rightButtons.append(
					this.cancelButton,
					this.saveButton
				);
				this.saveDialog.append(
					this.summaryInputLabel,
					this.minorCheckboxLabel,
					this.rightButtons
				);

				// Add it to the DOM
				$( 'body' ).append( this.saveDialog );
			},

			/**
			 * Bind events
			 */
			bind: function () {
				this.summaryInput.change( this.onSummaryInputChange );
				this.minorCheckbox.change( this.onMinorCheckBoxChange );
				this.cancelButton.click( this.onCancelButtonClick );
				this.saveButton.click( this.onSaveButtonClick );
			},

			/**
			 * Shorthand method to close the link dialog
			 */
			close: function () {
				this.saveDialog.remove();
			},

			/**
			 * Event handlers
			 */
			onSummaryInputChange: function ( event ) {
				contentScript.toolbar.saveDialog.summary = $( event.target ).val();
			},

			onMinorCheckboxChange: function ( event ) {
				contentScript.toolbar.saveDialog.minor = $( event.target ).is( ':checked' );
			},

			onCancelButtonClick: function ( event ) {
				contentScript.toolbar.saveDialog.close();
			},

			onSaveButtonClick: function ( event ) {
				let data = {
					'action': 'edit',
					'title': contentScript.url,
					'text': JSON.stringify( contentScript.edits ),
					'summary': contentScript.toolbar.saveDialog.summary,
					'minor': contentScript.toolbar.saveDialog.minor,
					'token': contentScript.editToken,
					'format': 'json'
				};

				$.post( 'https://edity.org/api.php', data, function ( response ) {
					//console.log( response );
					contentScript.background.updateBadge();
					contentScript.background.updateWhitelist();
					contentScript.toolbar.saveDialog.close();
					contentScript.toolbar.toolbar.remove();
				});
			}
		}
	}
};

$( contentScript.init );