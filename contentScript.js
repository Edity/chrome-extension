/**
 * Main content script object
 */
contentScript = {

	/**
	 * The current URL, normalized
	 */
	url: location.origin + location.pathname,

	/**
	 * Edits associated with the current URL
	 */
	edits: [],

	/**
	 * Amount of edits actually done to the current page
	 * May be less than the edits associated with the current URL
	 * for example in dynamic pages or if the source changed
	 */
	liveEditCount: 0,

	/**
	 * Initialization script
	 */
	init: function () {
		contentScript.bind();
		contentScript.background.updateIcon();
		contentScript.background.isEdited( function ( isEdited ) {
			if ( isEdited ) {
				contentScript.wiki.getEdits( function ( edits ) {
					if ( edits ) {
						edits.forEach( function ( edit ) {
							if ( document.body.innerHTML.indexOf( edit.oldHTML ) > -1 ) {
								document.body.innerHTML = document.body.innerHTML.replace( edit.oldHTML, edit.newHTML ); // This is the magic line
								contentScript.liveEditCount++;
							}
						});
						contentScript.background.updateBadge();
					}
				});
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
	 * Get the elements just edited
	 */
	getEditedElements: function () {
		return $( '*' ).filter( function () {
			var oldHTML = $( this ).data( 'oldHTML' );
			if ( ! oldHTML ) {
				return false;
			}
			if ( oldHTML === this.outerHTML ) {
				return false;
			}
			return true;
		});
	},

	/**
	 * Sub-object to communicate with the wiki
	 */
	wiki: {

		/**
		 * Request the edits associated with the current URL
		 */
		getEdits: function ( callback ) {
			var data = { 'titles': contentScript.url, 'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'format': 'json' };
			$.get( 'https://edity.org/api.php', data, function ( response ) {
				//console.log( response );
				// Make sure the wiki page exists
				var pageId = parseInt( Object.keys( response.query.pages )[0] );
				if ( pageId === -1 ) {
					return;
				}
				// Make sure the content returned is valid (in case of wiki vandalism)
				var content = response.query.pages[ pageId ].revisions[0]['*']; // Unwrap the content
				content = JSON.parse( content );
				if ( content === null ) {
					return; // Better validation required
				}
				// At this point, assume that the content is a valid response and pass it to the callback
				callback( content );
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
		 * Start the design mode when the background says so
		 */
		startEdit: function ( message, sender, sendResponse ) {
			document.designMode = "on";
			contentScript.toolbar.init();
			contentScript.editToken = message.editToken;
		},

		/**
		 * Send the current URL to the background
		 */
		sendURL: function ( message, sender, sendResponse ) {
			sendResponse( contentScript.url );
		},

		/**
		 * Ask the background if the current URL has edits
		 */
		isEdited: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'isEdited', 'url': contentScript.url }, callback );
		},

		/**
		 * Ask the background to update the icon
		 */
		updateIcon: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'updateIcon', 'url': contentScript.url }, callback );
		},

		/**
		 * Ask the background to update the badge with the latest liveEditCount
		 */
		updateBadge: function ( callback ) {
			var text = '';
			if ( contentScript.liveEditCount > 0 ) {
				text += contentScript.liveEditCount;
			}
			chrome.runtime.sendMessage({ 'method': 'updateBadge', 'text': text }, callback );
		},

		/**
		 * Ask the background to add the current URL to the edited URLs
		 */
		updateEditedURLs: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'updateEditedURLs', 'url': contentScript.url }, callback );
		}
	},

	/**
	 * Sub-object for the toolbar
	 */
	toolbar: {

		/**
		 * Rangy selection object
		 */
		selection: null,

		/**
		 * Initialization script
		 */
		init: function () {
			this.selection = rangy.getSelection();
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
			$( document ).on( 'click keyup', this.onDocumentActivity );
			this.saveButton.click( this.onSaveButtonClick );
			this.cancelButton.click( this.onCancelButtonClick );
			this.italicButton.click( this.onItalicButtonClick );
			this.boldButton.click( this.onBoldButtonClick );
			this.underlineButton.click( this.onUnderlineButtonClick );
			this.strikeButton.click( this.onStrikeButtonClick );
			this.linkButton.click( this.onLinkButtonClick );
		},

		/**
		 * Close the toolbar
		 */
		close: function () {
			this.toolbar.remove();
			document.designMode = "off";
		},

		/**
		 * When the caret moves to a new element, save the original HTML and the selection
		 */
		onDocumentActivity: function ( event ) {
			if ( $( event.target ).closest( '#edity-toolbar' ).length > 0 ) {
				return; // Ignore toolbar activity
			}

			// Update the selection
			contentScript.toolbar.selection = rangy.getSelection();

			// Save the original HTML of the selected element
			var selection = contentScript.toolbar.selection;
			if ( selection.rangeCount > 0 ) {
				var node = selection.getRangeAt(0).commonAncestorContainer;
				if ( node.nodeType === 3 ) {
					node = node.parentNode;
				}
				var element = $( node );
				if ( ! element.data( 'oldHTML' ) ) {
					element.data( 'oldHTML', node.outerHTML );
				}
			}
		},

		onBoldButtonClick: function ( event ) {
			var boldApplier = rangy.createClassApplier( 'edity-bold', { 'elementTagName': 'b' });
			boldApplier.toggleSelection();
		},

		onItalicButtonClick: function ( event ) {
			var italicApplier = rangy.createClassApplier( 'edity-italic', { 'elementTagName': 'i' });
			italicApplier.toggleSelection();
		},

		onUnderlineButtonClick: function ( event ) {
			var underlineApplier = rangy.createClassApplier( 'edity-underline', { 'elementTagName': 'u' });
			underlineApplier.toggleSelection();
		},

		onStrikeButtonClick: function ( event ) {
			var strikeApplier = rangy.createClassApplier( 'edity-strike', { 'elementTagName': 's' });
			strikeApplier.toggleSelection();
		},

		onLinkButtonClick: function ( event ) {
			contentScript.toolbar.linkDialog.init();
		},

		onCancelButtonClick: function ( event ) {
			contentScript.toolbar.close();
			contentScript.getEditedElements().each( function () {
				this.outerHTML = $( this ).data( 'oldHTML' );
			});
		},

		onSaveButtonClick: function ( event ) {
			contentScript.toolbar.saveDialog.init();
		},

		/**
		 * Sub-sub-object for the link dialog
		 */
		linkDialog: {

			/**
			 * The <a> tag to edit, if any
			 * The user may want to edit an exising <a> tag or create a new one
			 */
			anchor: null,

			/**
			 * The href of the link
			 */
			href: '',

			/**
			 * The text of the link
			 */
			text: '',

			/**
			 * The target of the link
			 */
			target: '',

			/**
			 * Initialization script
			 */
			init: function () {
				this.anchor = this.getAnchor();
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
				// Create the link dialog and its elements
				this.background = $( '<div>' ).addClass( 'edity-dialog-background' );
				this.linkDialog = $( '<div>' ).addClass( 'edity-dialog' );
				this.hrefInput = $( '<input>' ).attr({ 'type': 'text', 'autofocus': true, 'placeholder': this.href }).val( this.href );
				this.hrefInputLabel = $( '<label>' ).text( 'Enter the link address' );
				this.textInput = $( '<input>' ).attr({ 'type': 'text', 'placeholder': this.text }).val( this.text );
				this.textInputLabel = $( '<label>' ).text( 'Enter the link text (or the link address will be used)' );
				this.targetCheckbox = $( '<input>' ).attr({ 'type': 'checkbox' }).prop( 'checked', ( this.target === '_blank' ? true : false ) );
				this.targetCheckboxLabel = $( '<label>' ).text( 'Open the link in a new tab' );
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
				this.background.append( this.linkDialog );

				// Add it to the DOM
				contentScript.toolbar.toolbar.append( this.background );
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
			 * Close the dialog
			 */
			close: function () {
				this.background.remove();
			},

			/**
			 * Get the <a> tag based on the selection
			 */
			getAnchor: function () {
				var anchorNode = $( contentScript.toolbar.selection.anchorNode );
				if ( anchorNode.is( 'a' ) ) {
					return anchorNode;
				}
				var parentNode = $( contentScript.toolbar.selection.anchorNode.parentNode );
				if ( parentNode.is( 'a' ) ) {
					return parentNode;
				}
				return null;
			},

			/**
			 * Get the link href
			 */
			getHref: function () {
				if ( this.anchor ) {
					return this.anchor.attr( 'href' );
				}
				return '';
			},

			/**
			 * Get the link text
			 */
			getText: function () {
				if ( this.anchor ) {
					return this.anchor.text();
				}
				return contentScript.toolbar.selection.toString();
			},

			/**
			 * Get the link target
			 */
			getTarget: function () {
				if ( this.anchor ) {
					return this.anchor.attr( 'target' );
				}
				return '_self';
			},

			onHrefInputChange: function ( event ) {
				contentScript.toolbar.linkDialog.href = $( event.target ).val();
			},

			onTextInputChange: function ( event ) {
				var text = $( event.target ).val();
				contentScript.toolbar.linkDialog.text = text ? text : contentScript.toolbar.linkDialog.href;
			},

			onTargetCheckboxChange: function ( event ) {
				contentScript.toolbar.linkDialog.target = $( event.target ).prop( 'checked' ) ? '_blank' : '_self';
			},

			onCancelButtonClick: function ( event ) {
				contentScript.toolbar.linkDialog.close();
			},

			onSaveButtonClick: function ( event ) {
				var linkDialog = contentScript.toolbar.linkDialog;

				if ( ! linkDialog.href ) {
					return; // Nothing to do
				}

				if ( ! linkDialog.text ) {
					linkDialog.text = linkDialog.href; // Use the href as text
				}

				linkDialog.close(); // Closing the dialog will restore the selection

				var anchor = linkDialog.anchor;
				if ( anchor ) {
					anchor.attr({ 'href': linkDialog.href, 'target': linkDialog.target }).text( linkDialog.text );
				} else {
					anchor = $( '<a>' ).attr({ 'href': linkDialog.href, 'target': linkDialog.target }).text( linkDialog.text );

					var range = contentScript.toolbar.selection.getRangeAt(0);
					range.deleteContents();
					range.insertNode( anchor[0] );
				}

				// Select the recently added link
				var range = document.createRange();
				range.selectNodeContents( anchor[0] );
				var selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange( range );
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
				this.background = $( '<div>' ).addClass( 'edity-dialog-background' );
				this.saveDialog = $( '<div>' ).addClass( 'edity-dialog' );
				this.summaryInput = $( '<input>' ).attr({ 'type': 'text', 'autofocus': true }).val( this.summary );
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
				this.background.append( this.saveDialog );

				// Add it to the DOM
				contentScript.toolbar.toolbar.append( this.background );
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
			 * Close the dialog
			 */
			close: function () {
				this.background.remove();
			},

			/**
			 * Event handlers
			 */
			onSummaryInputChange: function ( event ) {
				contentScript.toolbar.saveDialog.summary = $( event.target ).val();
			},

			onMinorCheckboxChange: function ( event ) {
				contentScript.toolbar.saveDialog.minor = $( event.target ).prop( 'checked' );
			},

			onCancelButtonClick: function ( event ) {
				contentScript.toolbar.saveDialog.close();
			},

			onSaveButtonClick: function ( event ) {
				contentScript.toolbar.close();

				// Merge the new edits with the old
				contentScript.getEditedElements().each( function () {

					var oldHTML = $( this ).data( 'oldHTML' ),
						newHTML = this.outerHTML;

					for ( var edit of contentScript.edits ) {

						// If the edit is to an already edited element, merge them
						if ( oldHTML === edit.newHTML ) {
							edit.newHTML = newHTML;
							return;
						}
						// If the edit happens to return the HTML to its original state, remove the edit, per useless
						// For example, if a user makes an edit, saves, and then edits again to revert it
						if ( newHTML === edit.oldHTML ) {
							var index = contentScript.edits.indexOf( edit );
							contentScript.edits.splice( index, 1 );
							contentScript.liveEditCount--;
							return;
						}
					}
					// If we reach this point, add the edit to the edits array
					contentScript.liveEditCount++;
					contentScript.edits.push({ 'oldHTML': oldHTML, 'newHTML': newHTML });
				});

				// Update the wiki
				var data = {
					'action': 'edit',
					'title': contentScript.url,
					'text': JSON.stringify( contentScript.edits ),
					'summary': contentScript.toolbar.saveDialog.summary,
					'minor': contentScript.toolbar.saveDialog.minor,
					'token': contentScript.editToken,
					'format': 'json'
				};
				$.post( 'https://edity.org/api.php', data, function ( response ) {
					console.log( response );
					contentScript.background.updateBadge();
					contentScript.background.updateEditedURLs();
				});
			}
		}
	}
};

$( contentScript.init );