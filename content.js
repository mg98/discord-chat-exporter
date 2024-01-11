is_init = false

function init() {
    is_init = true
    const scriptElement = document.createElement('script');
    scriptElement.src = chrome.runtime.getURL('inject.js');
    scriptElement.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(scriptElement);
}

function addBtn() {
    const scriptElement = document.createElement('script');
    scriptElement.src = chrome.runtime.getURL('add-button.js');
    scriptElement.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(scriptElement);
}

if (window.location.href.includes("/channels/") && !is_init) {
    init()
}

chrome.runtime.onMessage.addListener(
  function() {
    is_init ? addBtn() : init()
});