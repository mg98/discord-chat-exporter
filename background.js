function isDiscordUrl(url) {
  return typeof url === "string" && url.startsWith("https://discord.com/");
}

async function sendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url || !isDiscordUrl(tab.url)) {
    return;
  }

  try {
    await sendMessage(tabId, {
      type: "discord-chat-exporter:url-change",
      url: changeInfo.url
    });
  } catch (error) {
    // The tab may not have a content script yet, which is expected on first load.
  }
});
