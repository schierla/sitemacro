var database = {};
var _pages = document.getElementById("pages");
var _steps = document.getElementById("steps");
var _macros = document.getElementById("macros");
var _delete = document.getElementById("delete");

_macros.appendChild(document.createTextNode(chrome.i18n.getMessage("optionMacros")));
_delete.appendChild(document.createTextNode(chrome.i18n.getMessage("optionDelete")));

var reload = function() {
    chrome.storage.local.get(null, data => { 
        database = data;
        while(_pages.firstChild) _pages.removeChild(_pages.firstChild);
        var option = document.createElement("option"); option.appendChild(document.createTextNode("<< please select >>"));
        _pages.appendChild(option);
        for(var key in data) {
            if(key.startsWith("data/")) {
                var url = key.substr(5);
                var option = document.createElement("option");
                option.value = url; option.appendChild(document.createTextNode(url));
                _pages.appendChild(option);
            }
        }    
        selected();
    });
}

var elemName = function(step) {
    if(step.name) {
        return chrome.i18n.getMessage("elemName", [step.target, step.name]);
    } else if(step.text) {
        return chrome.i18n.getMessage("elemText", [step.target, step.text]);
    } else {
        return chrome.i18n.getMessage("elemPath", [step.target]);
    }
}

var selected = function() {
    var key = "data/" + _pages.value;
    var data = database[key];
    while(_steps.firstChild) _steps.removeChild(_steps.firstChild);
    _delete.style.display="none";
    if(!data) return;
    for(var i=0; i<data.steps.length; i++) {
        var li = document.createElement("li");
        var step = data.steps[i];
        if(step.type == "click") {
            li.appendChild(document.createTextNode(chrome.i18n.getMessage("stepClick", elemName(step))));
        } else if(step.type == "change") {
            li.appendChild(document.createTextNode(chrome.i18n.getMessage("stepChange", [step.value, elemName(step)])));
        }
        _steps.appendChild(li);
    }
    _delete.style.display="block";
}

var deleted = function() {
    var key = "data/" + _pages.value;
    if(!database[key]) return;
    chrome.runtime.sendMessage({command: "delete", url: _pages.value}, reload);
}


_pages.addEventListener("change", selected);
_delete.addEventListener("click", deleted);
reload();
selected();