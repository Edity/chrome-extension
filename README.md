# Edity

Edity is a Chrome extension that allows you to edit any web page you encounter. Simple as that. All changes will be immediately visible to everyone who visits the page and has Edity enabled.

http://edity.org

## Tasks
* When I do a change, and then another to the same element, the changes are added, rather than merged
* Make use of chrome.tabs.detectLanguage

## Notes
* To minimize requests, we query the wiki for a list of all edited URLs. We only query again if the user visits one of these URLs.
* Non-HTML resources (JPGs, PDFs, etc.) the new page tab and the home page of the sites cannot be edited.