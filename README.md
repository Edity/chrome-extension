# Edity

Edity is a Chrome extension that allows you to edit any web page you encounter. Simple as that. All edits will be immediately visible to everyone who visits the page and has Edity enabled.

http://edity.org

## Tasks
* Improve the link dialog
* Dynamic popup
* Check for underscore bugs

## Code conventions
Edity is a relatively complex Chrome extension and will only get more complex, so some conventions are needed to keep the code under control.

We follow the Chrome code conventions to integrate better, see https://www.chromium.org/developers/web-development-style-guide

Additionally, we follow the following conventions:
* Methods that start with "get" always return a value synchronously
* Methods that start with "request" always do an AJAX request to edity.org
* Methods that start with "update" always update a value asynchronously