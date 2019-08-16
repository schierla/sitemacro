var database = {};
var _pages = document.getElementById("pages");
var _steps = document.getElementById("steps");
var _delete = document.getElementById("delete");
var _save = document.getElementById("save");
var _details = document.getElementById("details");
var _type = document.getElementById("type");
var _prefix = document.getElementById("prefix");

_delete.appendChild(document.createTextNode(chrome.i18n.getMessage("optionDelete")));
_save.appendChild(document.createTextNode(chrome.i18n.getMessage("optionSave")));
document.getElementById("applyTo").appendChild(document.createTextNode(chrome.i18n.getMessage("optionApplyTo")));
document.getElementById("optionExact").appendChild(document.createTextNode(chrome.i18n.getMessage("optionExact")));
document.getElementById("optionPrefix").appendChild(document.createTextNode(chrome.i18n.getMessage("optionPrefix")));

var reload = function() {
    chrome.storage.local.get(null, data => { 
        database = data;
        while(_pages.firstChild) _pages.removeChild(_pages.firstChild);
        var option = document.createElement("option"); option.appendChild(document.createTextNode(chrome.i18n.getMessage("optionPlaceholder")));
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
    _details.style.display="none";
    if(!data) return;
    for(var i=0; i<data.steps.length; i++) {
        var li = document.createElement("li");
        var step = data.steps[i];
        if(step.type == "click") {
            li.appendChild(document.createTextNode(chrome.i18n.getMessage("stepClick", elemName(step))));
        } else if(step.type == "change") {
            li.appendChild(document.createTextNode(chrome.i18n.getMessage("stepChange", [step.value, elemName(step)])));
        } else if(step.type == "wait") {
            li.appendChild(document.createTextNode(chrome.i18n.getMessage("stepWait", [step.duration])));
        }
        _steps.appendChild(li);
    }

    _type.value = 'exact';
    _prefix.value = ''; 

    if(database.prefix) {
        for(var key in database.prefix) {
            if(database.prefix[key] == _pages.value) {
                _type.value = 'prefix'; 
                _prefix.value = key; 
            }
        }
    }
    _prefix.oldValue = _prefix.value;                
    typeChanged();

    _details.style.display = "block";

}

var deleted = function() {
    var key = "data/" + _pages.value;
    if(!database[key]) return;
    chrome.runtime.sendMessage({command: "delete", url: _pages.value}, reload);
}

var saved = function() {
    var key = "data/" + _pages.value;
    if(!database[key]) return;

    if(database.prefix && _prefix.oldValue in database.prefix) {
        chrome.runtime.sendMessage({command: "deletePrefix", prefix: _prefix.oldValue}, reload);
    }
    
    if(_prefix.value != "") {
        chrome.runtime.sendMessage({command: "addPrefix", prefix: _prefix.value, url: _pages.value }, reload);
        chrome.permissions.request({origins: [_prefix.value + "*"]});
    }

    reload();
}

var typeChanged = function() {
    if(_type.value == 'prefix') {
        _prefix.removeAttribute("disabled");
        if(_prefix.value == "") _prefix.value = _pages.value;
      } else {
        _prefix.setAttribute("disabled", "disabled");
        _prefix.value = ""; 
    }
}

_pages.addEventListener("change", selected);
_delete.addEventListener("click", deleted);
_type.addEventListener("change", typeChanged);
_save.addEventListener("click", saved);
reload();
selected();
typeChanged();