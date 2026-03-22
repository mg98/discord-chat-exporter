if (!window.__discordChatExporterInjected) {
    window.__discordChatExporterInjected = true;
    let isExporting = false;

    function showToast(message, kind = "info") {
        const existingToast = document.getElementById("discord-chat-exporter-toast");
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement("div");
        toast.id = "discord-chat-exporter-toast";
        toast.textContent = message;
        toast.style.position = "fixed";
        toast.style.top = "20px";
        toast.style.right = "20px";
        toast.style.zIndex = "2147483647";
        toast.style.maxWidth = "320px";
        toast.style.padding = "10px 14px";
        toast.style.borderRadius = "8px";
        toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.35)";
        toast.style.color = "#fff";
        toast.style.font = "500 14px/1.4 system-ui, sans-serif";
        toast.style.background = kind === "error" ? "#c0392b" : "#2d7d46";
        document.body.appendChild(toast);

        window.setTimeout(function() {
            toast.remove();
        }, 3500);
    }

    function normalizeToken(token) {
        if (typeof token !== "string") {
            return null;
        }

        let normalized = token.trim();

        if (
            (normalized.startsWith('"') && normalized.endsWith('"')) ||
            (normalized.startsWith("'") && normalized.endsWith("'"))
        ) {
            normalized = normalized.slice(1, -1);
        }

        normalized = normalized.trim();

        if (!normalized || normalized === "null" || normalized === "undefined") {
            return null;
        }

        return normalized;
    }

    function getTokenFromWebpack() {
        if (!Array.isArray(window.webpackChunkdiscord_app)) {
            return null;
        }

        const modules = [];
        window.webpackChunkdiscord_app.push([
            ['discord-chat-exporter'],
            {},
            function(runtime) {
                for (const key in runtime.c) {
                    modules.push(runtime.c[key]);
                }
            }
        ]);

        for (const module of modules) {
            const candidate = normalizeToken(module?.exports?.default?.getToken?.());
            if (candidate) {
                return candidate;
            }
        }

        return null;
    }

    function getAuthCandidates() {
        const candidates = [];
        const seen = new Set();

        function addCandidate(source, rawValue) {
            const value = normalizeToken(rawValue);
            if (!value || seen.has(value)) {
                return;
            }

            seen.add(value);
            candidates.push({ source, value });
        }

        addCandidate("webpack", getTokenFromWebpack());
        addCandidate("localStorage", window.localStorage?.getItem("token"));
        addCandidate("sessionStorage", window.sessionStorage?.getItem("token"));

        return candidates;
    }

    async function probeAuthCandidate(candidate) {
        const response = await fetch("https://discord.com/api/v9/users/@me", {
            headers: {
                accept: "*/*",
                authorization: candidate.value
            },
            referrer: window.location.href,
            referrerPolicy: "strict-origin-when-cross-origin",
            method: "GET",
            mode: "cors",
            credentials: "include"
        });

        let body = null;
        try {
            body = await response.clone().json();
        } catch (error) {
            body = null;
        }

        return {
            source: candidate.source,
            value: candidate.value,
            status: response.status,
            ok: response.ok,
            body
        };
    }

    function debugTokenLabel(token) {
        return `${token.slice(0, 8)}... (${token.length} chars)`;
    }

    async function resolveAuthToken() {
        const candidates = getAuthCandidates();

        if (candidates.length === 0) {
            throw new Error("Could not retrieve any Discord auth token candidates.");
        }

        const probeResults = [];
        for (const candidate of candidates) {
            const result = await probeAuthCandidate(candidate);
            probeResults.push(result);
        }

        console.group("Discord Chat Exporter auth probe");
        for (const result of probeResults) {
            console.log(result.source, {
                status: result.status,
                token: debugTokenLabel(result.value),
                user: result.body?.username || null,
                message: result.body?.message || null
            });
        }
        console.groupEnd();

        const validCandidate = probeResults.find(function(result) {
            return result.ok;
        });

        if (!validCandidate) {
            throw new Error(
                "No valid Discord auth token found. See the page console for per-source probe results."
            );
        }

        return {
            source: validCandidate.source,
            value: validCandidate.value,
            username: validCandidate.body?.username || null
        };
    }

    function convertToTSV(data) {
        function escapeAndQuote(str) {
            if (str === null || str === undefined) {
                return '""';
            }

            return '"' + String(str).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
        }

        const headers = ['timestamp', 'author', 'message'];
        return [
            headers.map(header => escapeAndQuote(header)).join('\t'),
            ...data.map(row =>
                headers.map(field => escapeAndQuote(row[field])).join('\t')
            )
        ].join('\n');
    }

    function downloadTSV(tsvString, filename) {
        const blob = new Blob([tsvString], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    const downloadIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.25589 16C3.8899 15.0291 3 13.4422 3 11.6493C3 9.20008 4.8 6.9375 7.5 6.5C8.34694 4.48637 10.3514 3 12.6893 3C15.684 3 18.1317 5.32251 18.3 8.25C19.8893 8.94488 21 10.6503 21 12.4969C21 14.0582 20.206 15.4339 19 16.2417M12 21V11M12 21L9 18M12 21L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    const loadingSpinner = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin: auto; background: none; display: block; shape-rendering: auto;" width="24px" height="24px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
    <circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="14" r="32" stroke-dasharray="150.79644737231007 52.26548245743669">
      <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="2.564102564102564s" values="0 50 50;360 50 50" keyTimes="0;1"></animateTransform>
    </circle>
    <!-- [ldio] generated by https://loading.io/ --></svg>`;

    async function exportCurrentChannel(btn) {
        if (isExporting) {
            showToast("Export already in progress.");
            return;
        }

        let data = [];
        let lastID;

        const urlParts = window.location.href.split("/");
        const channelID = urlParts[urlParts.length - 1];
        isExporting = true;
        if (btn) {
            btn.innerHTML = loadingSpinner;
        }
        try {
            const authToken = await resolveAuthToken();
            showToast(
                authToken.username
                    ? `Starting chat export as ${authToken.username} via ${authToken.source}...`
                    : `Starting chat export using ${authToken.source} auth...`
            );

            while (true) {
                const response = await fetch(
                    `https://discord.com/api/v9/channels/${channelID}/messages?limit=100${lastID ? '&before=' + lastID : ''}`,
                    {
                        headers: {
                            accept: "*/*",
                            "accept-language": "en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7,fr;q=0.6,vi;q=0.5",
                            authorization: authToken.value
                        },
                        referrer: window.location.href,
                        referrerPolicy: "strict-origin-when-cross-origin",
                        body: null,
                        method: "GET",
                        mode: "cors",
                        credentials: "include"
                    }
                );

                if (!response.ok) {
                    throw new Error(`Discord returned ${response.status} while loading messages.`);
                }

                let messages = await response.json();
                lastID = messages.length && messages[messages.length - 1].id;
                messages = messages.map(function(message) {
                    return {
                        timestamp: message.timestamp,
                        author: message.author.username,
                        message: message.content
                    };
                });
                data.push(...messages);

                if (messages.length === 0) {
                    break;
                }
            }

            data = data.slice().reverse();
            const tsvString = convertToTSV(data);
            downloadTSV(tsvString, `chat${channelID}.tsv`);
            showToast(`Exported ${data.length} messages.`);
        } catch (error) {
            console.error("Discord Chat Exporter failed:", error);
            showToast(error.message || "Export failed.", "error");
        } finally {
            isExporting = false;
            if (btn) {
                btn.innerHTML = downloadIcon;
            }
        }
    }

    function getToolbar() {
        return (
            document.querySelector("[class^='upperContainer_'] [class^='toolbar_']") ||
            document.querySelector("header [class*='toolbar_']") ||
            document.querySelector("[class*='toolbar_']")
        );
    }

    let toolbarObserver = null;

    window.addButton = function addButton() {
        const toolbar = getToolbar();
        if (!toolbar) {
            return false;
        }

        if (toolbar.querySelector("[aria-label='Export chat history']")) {
            return true;
        }

        const templateButton = toolbar.querySelector("button, [role='button']");
        if (!templateButton) {
            return false;
        }

        const btn = templateButton.cloneNode(false);
        btn.setAttribute('aria-label', 'Export chat history');
        btn.setAttribute('type', 'button');
        btn.innerHTML = downloadIcon;
        btn.onclick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            exportCurrentChannel(this);
        };
        toolbar.insertBefore(btn, toolbar.firstChild);
        return true;
    };

    function scheduleAddButton() {
        if (window.addButton()) {
            if (toolbarObserver) {
                toolbarObserver.disconnect();
                toolbarObserver = null;
            }
            return;
        }

        if (toolbarObserver || !document.body) {
            return;
        }

        toolbarObserver = new MutationObserver(function() {
            if (window.addButton()) {
                toolbarObserver.disconnect();
                toolbarObserver = null;
            }
        });

        toolbarObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === "complete") {
        setTimeout(scheduleAddButton, 1100);
    } else {
        window.addEventListener("load", function() {
            setTimeout(scheduleAddButton, 1100);
        }, { once: true });
    }

    window.addEventListener("discord-chat-exporter:run-export", function() {
        exportCurrentChannel();
    });
}
