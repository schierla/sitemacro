var siteMacroRecord = {
    steps: [], 
    counter: null,
    div1: null, 
    div2: null,
    ok: null, 
    cancel: null,
    paddingtop: null,
    paddingbottom: null,

    clicked: function(e) {
        if(e.target == siteMacroRecord.ok || e.target == siteMacroRecord.cancel) return;
        siteMacroRecord.steps.push(siteMacroRecord.fillTarget({type:"click" }, e.target));
        siteMacroRecord.counter.innerHTML += ".";
    }, 

    changed: function(e) {
        if(e.target == siteMacroRecord.ok || e.target == siteMacroRecord.cancel) return;
        siteMacroRecord.steps.push(siteMacroRecord.fillTarget({type:"change", value: e.target.value}, e.target));
        siteMacroRecord.counter.innerHTML += ".";
    }, 

    fillTarget: function(obj, elem) {
        if(elem.innerText) obj.text = elem.innerText;
        if(elem.name) obj.name = elem.name;
        obj.target = siteMacroRecord.buildXPath(elem);
        return obj;
    },

    unloaded: function(e) {
        siteMacroRecord.accept();
    },

    message: function(msg) {
        if(msg == "cancel") {
            siteMacroRecord.cleanup();
        }
    },

    accept: function() {
        chrome.runtime.sendMessage({command: "add", url: window.location.href, steps: siteMacroRecord.steps});
        siteMacroRecord.cleanup();
    },

    abort: function() {
        chrome.runtime.sendMessage({command: "cancel", url: window.location.href});
        siteMacroRecord.cleanup();
    },

    cleanup: function() {
        window.removeEventListener("click", siteMacroRecord.clicked, true);
        window.removeEventListener("change", siteMacroRecord.changed, true);
        window.removeEventListener("unload", siteMacroRecord.unloaded);
        chrome.runtime.onMessage.removeListener(siteMacroRecord.message);        
        document.body.removeChild(siteMacroRecord.div1);
        document.body.removeChild(siteMacroRecord.div2);
        document.body.style.paddingTop=siteMacroRecord.paddingtop;
        document.body.style.paddingBottom=siteMacroRecord.paddingbottom;
    },
    
	buildXPath: function (t) {
		var path = "";
		if (t.id != "") return 'id("' + t.id + '")';
		while (t.nodeName != "HTML") {
			var c = t.parentNode.firstChild;
			var num = 1;
			while (c != t) {
				if (c.nodeName == t.nodeName)
					num++;
				c = c.nextSibling;
			}
			path = "/" + t.nodeName.toLowerCase() + "[" + num + "]" + path;
			t = t.parentNode;
			if (t.id != "") return 'id("' + t.id + '")' + path;
		}
		path = "/" + t.nodeName.toLowerCase() + path;
		return path;
    }, 
    
    redDiv: function() {
        var div = document.createElement("div");
        div.style.position="fixed"; div.style.left="0px"; div.style.width="100vw"; div.style.background="#700"; div.style.lineHeight="1.5em";
        div.style.textAlign="center"; div.style.zIndex=9999; div.style.color="#fff"; div.style.fontWeight="bold";
        div.appendChild(document.createTextNode(chrome.i18n.getMessage("pageRecording")));
        div.style.transition="height 0.5s ease";
        return div;
    },

    showRecording: function() {
        siteMacroRecord.div1 = siteMacroRecord.redDiv();
        siteMacroRecord.div1.style.top="0px"; siteMacroRecord.div1.style.height="100vh";
        document.body.appendChild(siteMacroRecord.div1);

        siteMacroRecord.counter = document.createElement("span");
        siteMacroRecord.div1.appendChild(siteMacroRecord.counter);

        siteMacroRecord.ok = document.createElement("button"); 
        siteMacroRecord.ok.appendChild(document.createTextNode(chrome.i18n.getMessage("pageRecordOk")));
        siteMacroRecord.ok.style.float="right"; siteMacroRecord.ok.style.marginRight = "2em";
        siteMacroRecord.div1.appendChild(siteMacroRecord.ok);
        siteMacroRecord.ok.addEventListener("click", siteMacroRecord.accept);

        siteMacroRecord.cancel = document.createElement("button"); 
        siteMacroRecord.cancel.appendChild(document.createTextNode(chrome.i18n.getMessage("pageRecordCancel")));
        siteMacroRecord.cancel.style.float="right"; siteMacroRecord.cancel.style.marginRight = "0.5em";
        siteMacroRecord.div1.appendChild(siteMacroRecord.cancel);
        siteMacroRecord.cancel.addEventListener("click", siteMacroRecord.abort);

        siteMacroRecord.div2 = siteMacroRecord.redDiv();
        siteMacroRecord.div2.style.bottom="0px"; siteMacroRecord.div2.style.height="1.5em";
        document.body.appendChild(siteMacroRecord.div2);

        setTimeout(() => {
            siteMacroRecord.div1.style.height="1.5em"; 
        }, 100);
        siteMacroRecord.paddingtop = document.body.style.paddingTop;
        siteMacroRecord.paddingbottom = document.body.style.paddingBottom;
        document.body.style.paddingTop="1.5em";
        document.body.style.paddingBottom="1.5em";
    }
}

window.addEventListener("click", siteMacroRecord.clicked, true);
window.addEventListener("change", siteMacroRecord.changed, true);
window.addEventListener("unload", siteMacroRecord.unloaded);
siteMacroRecord.showRecording();
chrome.runtime.onMessage.addListener(siteMacroRecord.message);