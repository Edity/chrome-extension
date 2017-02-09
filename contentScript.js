/**
 * Main content script object
 */
contentScript = {

	/**
	 * Edits to the current URL retrieved from the wiki
	 */
	edits: [],

	/**
	 * Amount of edits actually done to the current loaded page
	 * May be less than the total number of edits associated to the URL
	 * for example in pages with dynamic content
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
				contentScript.background.getEdits( function ( edits ) {
					//console.log( edits );
					contentScript.edits = edits;
					contentScript.edits.forEach( function ( edit ) {
						if ( document.body.innerHTML.indexOf( edit.oldHTML ) > -1 ) {
							document.body.innerHTML = document.body.innerHTML.replace( edit.oldHTML, edit.newHTML ); // This is the magic line
							contentScript.liveEditCount++;
						}
					});
					contentScript.background.updateBadge();
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
		 * Start the design mode when the background requests it
		 */
		startEdit: function ( message, sender, sendResponse ) {
			document.designMode = 'on';
			contentScript.toolbar.init();
		},

		/**
		 * Send the current URL when the background requests it
		 */
		sendURL: function ( message, sender, sendResponse ) {
			sendResponse( document.URL );
		},

		/**
		 * Send the current domain when the background requests it
		 */
		sendDomain: function ( message, sender, sendResponse ) {
			sendResponse( document.domain );
		},

		/**
		 * Ask the background if the current URL has edits
		 */
		isEdited: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'isEdited' }, callback );
		},

		/**
		 * Ask the background to update the icon
		 */
		updateIcon: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'updateIcon', 'domain': document.domain }, callback );
		},

		/**
		 * Ask the background to update the badge with the latest liveEditCount
		 */
		updateBadge: function ( callback ) {
			var badge = '';
			if ( contentScript.liveEditCount > 0 ) {
				badge += contentScript.liveEditCount; // Using += turns the count into a string
			}
			chrome.runtime.sendMessage({ 'method': 'updateBadge', 'text': badge }, callback );
		},

		/**
		 * Ask the background to add the current URL to the edited URLs
		 */
		updateEditedURLs: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'updateEditedURLs' }, callback );
		},

		/**
		 * Ask the background to send the latest edits to the current URL
		 */
		getEdits: function ( callback ) {
			chrome.runtime.sendMessage({ 'method': 'getEdits' }, callback );
		},

		/**
		 * Ask the background to save the edits done to the current URL
		 */
		saveEdits: function ( data, callback ) {
			chrome.runtime.sendMessage({ 'method': 'saveEdits', 'data': data }, callback );
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
			this.toolbarWrapper = $( '<div>' ).attr( 'id', 'edity-toolbar-wrapper' ).prop( 'contenteditable', false );
			this.toolbar = $( '<div>' ).attr( 'id', 'edity-toolbar' );
			this.rightButtons = $( '<div>' ).addClass( 'edity-float-right' );
			this.boldButton = $( '<button>' ).prop( 'disabled', true );
			this.boldButtonText = $( '<b>' ).text( 'B' );
			this.italicButton = $( '<button>' ).prop( 'disabled', true );
			this.italicButtonText = $( '<i>' ).text( 'I' );
			this.strikeButton = $( '<button>' ).prop( 'disabled', true );
			this.strikeButtonText = $( '<s>' ).text( 'S' );
			this.underlineButton = $( '<button>' ).prop( 'disabled', true );
			this.underlineButtonText = $( '<u>' ).text( 'U' );
			this.linkButton = $( '<button>' ).prop( 'disabled', false );
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
			this.toolbarWrapper.append( this.toolbar );

			// Add it to the DOM
			$( 'html' ).append( this.toolbarWrapper );

			// Move the body down to avoid covering the page
			$( 'body' ).css( 'transform', 'translateY( 50px )' );
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
			this.toolbarWrapper.remove();
			document.designMode = 'off';
			$( 'body' ).css( 'transform', 'translateY( 0 )' );
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
			 * If the user wants to create a new tag, this will be null
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
				this.linkDialog.click( this.onLinkDialogClick );
				this.background.click( this.onBackgroundClick );
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

			onLinkDialogClick: function ( event ) {
				event.stopPropagation();
			},

			onBackgroundClick: function ( event ) {
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
				this.background.click( this.onBackgroundClick );
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

			onSaveDialogClick: function ( event ) {
				event.stopPropagation();
			},

			onBackgroundClick: function ( event ) {
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
						// If the edit happens to return the HTML to its original state, remove it per no longer useful
						// For example, if a user makes an edit, saves, and then edits again to manually undo it
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

				var data = {
					'url': location.href,
					'edits': contentScript.edits,
					'summary': contentScript.toolbar.saveDialog.summary,
					'minor': contentScript.toolbar.saveDialog.minor
				};

				contentScript.background.saveEdits( data );
				contentScript.background.updateBadge();
			}
		}
	}
};

$( contentScript.init );