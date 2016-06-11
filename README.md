# Edity

Edity is a Chrome extension that allows you to edit any web page you encounter. Simple as that. All changes will be immediately visible to everyone who visits the page and has Edity enabled.

http://edity.org

## Tasks
* When I do a change, and then another to the same element, the changes are added, rather than merged
* When changing tabs, the liveChangeCount doesn't update. This requires to store the changes of each tab, which would also be efficient to save requests, but I must be careful not to grow too big.
* Make use of chrome.tabs.detectLanguage

Edity does a LOT of requests to edity.org, one per page load. To minimize requests, there are many checks in place:
* Non-HTML resources (JPGs, PDFs, etc.) are ignored.
* The new page tab is ignored.
* Data retrieved from edity.org is stored and reused when a user revisits a page.
* Home pages (google.com, facebook.com, etc.) are considered protected and therefore ignored.
More strategies are always welcome.