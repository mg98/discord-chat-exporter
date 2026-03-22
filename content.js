(function() {
    if (window.__discordChatExporterContentLoaded) {
        return;
    }

    window.__discordChatExporterContentLoaded = true;

    let isInit = false;
    let lastUrl = window.location.href;
    let initPromise = null;

    function injectScript(fileName) {
        return new Promise(function(resolve, reject) {
            const scriptElement = document.createElement('script');
            scriptElement.src = chrome.runtime.getURL(fileName);
            scriptElement.onload = function() {
                this.remove();
                resolve();
            };
            scriptElement.onerror = function() {
                this.remove();
                reject(new Error(`Failed to load ${fileName}.`));
            };
            (document.head || document.documentElement).appendChild(scriptElement);
        });
    }

    function isChannelPage(url = window.location.href) {
        return url.includes("/channels/");
    }

    function init() {
        if (isInit) {
            return initPromise || Promise.resolve();
        }

        isInit = true;
        initPromise = injectScript('inject.js');
        return initPromise;
    }

    function addBtn() {
        return injectScript('add-button.js');
    }

    async function ensureExporterReady(options = {}) {
        if (!isChannelPage()) {
            return;
        }

        await init();

        if (options.addButton) {
            await addBtn();
        }
    }

    ensureExporterReady();

    chrome.runtime.onMessage.addListener(function(message) {
        if (message?.type === "discord-chat-exporter:url-change") {
            ensureExporterReady({
                addButton: true
            }).catch(function(error) {
                console.error("Discord Chat Exporter failed to refresh:", error);
            });
        }
    });

    const observer = new MutationObserver(function() {
        if (window.location.href === lastUrl) {
            return;
        }

        lastUrl = window.location.href;
        ensureExporterReady({
            addButton: true
        }).catch(function(error) {
            console.error("Discord Chat Exporter failed after navigation:", error);
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
