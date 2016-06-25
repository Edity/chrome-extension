# Edity

Edity is a Chrome extension that allows you to edit any web page you encounter. Simple as that. All edits will be immediately visible to everyone who visits the page and has Edity enabled.

http://edity.org

## Tasks
* Improve the link dialog
* Dynamic popup
* Check for underscore bugs
* JavaScript diff engine at edity.org

## Code conventions
Edity is a relatively complex Chrome extension and will only get more complex, so some conventions are needed to keep the code under control.
* Methods that start with "get" always return a value synchronously.
* Methods that start with "request" always do an AJAX request (normally to edity.org) and return a jQuery promise.
* Methods that start with "update" always update a value asynchronously.