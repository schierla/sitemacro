function listPages() {
    var pages = document.getElementById("pages");
    var granted = document.getElementById("granted");
    var missing = document.getElementById("missing");
    document.getElementById("todo").style.display="none"; 
    document.getElementById("done").style.display="none"; 
    document.getElementById("anymissing").style.display="none"; 
    document.getElementById("anygranted").style.display="none"; 
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
        if(data.prefix) {
            for(var key in data.prefix) {
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
        if(missing.firstChild) document.getElementById("anymissing").style.display="block"; 
        if(granted.firstChild) document.getElementById("anygranted").style.display="block"; 

        if(missing.firstChild) {
            document.getElementById("todo").style.display="block"; 
        } else {
            document.getElementById("done").style.display="block"; 
            window.close();
        }
        return;
    }
    chrome.permissions.contains({ origins: [ li.firstChild.data ] }, ok => {
        if (ok) granted.appendChild(li);
        else missing.appendChild(li);
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
    if(li) {
        var url = li.firstChild.data;
        missing.removeChild(li);
        if(url.endsWith("*")) 
            chrome.runtime.sendMessage({command: "deletePrefix", prefix: url.substr(0, url.length - 1)}, remove);
        else 
            chrome.runtime.sendMessage({command: "delete", url: url}, remove);
    } else {
        listPages();
    }
}

function load() {
    listPages();
    document.getElementById("grant").addEventListener("click", grant);
    document.getElementById("remove").addEventListener("click", remove);
}

window.addEventListener("load", load);