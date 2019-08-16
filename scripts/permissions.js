function listPages() {
    var pages = document.getElementById("pages");
    var granted = document.getElementById("granted");
    var missing = document.getElementById("missing");
    document.getElementById("todo").style.display = "none";
    document.getElementById("done").style.display = "none";
    document.getElementById("anymissing").style.display = "none";
    document.getElementById("anygranted").style.display = "none";
    while (pages.firstChild) pages.removeChild(pages.firstChild);
    while (granted.firstChild) granted.removeChild(granted.firstChild);
    while (missing.firstChild) missing.removeChild(missing.firstChild);
    chrome.storage.local.get(null, data => {
        for (var key in data) {
            if (key.startsWith("data/")) {
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(key.substr(5)));
                pages.appendChild(li);
            }
        }
        if (data.prefix) {
            for (var key in data.prefix) {
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(key + "*"));
                pages.appendChild(li);
            }
        }
        checkNextPage();
    });
}

function checkNextPage() {
    var pages = document.getElementById("pages");
    var granted = document.getElementById("granted");
    var missing = document.getElementById("missing");
    var li = pages.firstChild;
    if (!li) {
        if (missing.firstChild) {
            document.getElementById("todo").style.display = "block";
        } else {
            document.getElementById("done").style.display = "block";
            window.close();
        }
        return;
    }
    chrome.permissions.contains({ origins: [li.firstChild.data] }, ok => {
        if (ok) {
            document.getElementById("anygranted").style.display = "block";
            granted.appendChild(li);
        } else {
            document.getElementById("anymissing").style.display = "block";
            missing.appendChild(li);
        }
        checkNextPage();
    });
}

function grant() {
    var missing = document.getElementById("missing");
    var li = missing.firstChild;
    var origins = [];
    while (li) {
        origins.push(li.firstChild.data);
        li = li.nextSibling;
    }

    chrome.permissions.request({ origins: origins }, ok => {
        listPages();
    });
}

function remove() {
    var missing = document.getElementById("missing");
    var li = missing.firstChild;
    if (li) {
        var url = li.firstChild.data;
        missing.removeChild(li);
        if (url.endsWith("*"))
            chrome.runtime.sendMessage({ command: "deletePrefix", prefix: url.substr(0, url.length - 1) }, remove);
        else
            chrome.runtime.sendMessage({ command: "delete", url: url }, remove);
    } else {
        listPages();
    }
}

document.title = chrome.i18n.getMessage("extensionName");
document.getElementById("permissionTitle").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionTitle")));
document.getElementById("permissionAllowed").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionAllowed")));
document.getElementById("permissionMissing").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionMissing")));
document.getElementById("grant").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionGrant")));
document.getElementById("remove").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionRemove")));
document.getElementById("done").appendChild(document.createTextNode(chrome.i18n.getMessage("permissionDone")));


document.getElementById("grant").addEventListener("click", grant);
document.getElementById("remove").addEventListener("click", remove);
listPages();
