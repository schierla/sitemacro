var siteMacroPage = {
    steps: [], 
    counter: null,
    div1: null, 
    div2: null,
    paddingtop: null,
    paddingbottom: null,
    aborted: false,

    clicked: function(e) {
        // console.log("Clicked: " + siteMacroPage.buildXPath(e.target));
        siteMacroPage.steps.push({type:"click", target: siteMacroPage.buildXPath(e.target), text: e.target.innerText, value: e.target.value, name: e.target.name});
        siteMacroPage.counter.innerHTML = siteMacroPage.steps.length + " steps";
    }, 

    changed: function(e) {
        // console.log("Changed: " + siteMacroPage.buildXPath(e.target) + " got value " + e.target.value);
        siteMacroPage.steps.push({type:"change", target: siteMacroPage.buildXPath(e.target), text: e.target.innerText, value: e.target.value, name: e.target.name});
        siteMacroPage.counter.innerHTML = siteMacroPage.steps.length + " steps";
    }, 

    unloaded: function(e) {
        if(!siteMacroPage.aborted) chrome.runtime.sendMessage({url: window.location.href, steps: siteMacroPage.steps});
    },

    message: function(msg) {
        if(msg == "abort") {
            siteMacroPage.aborted = true;
            window.removeEventListener("click", siteMacroPage.clicked, true);
            window.removeEventListener("change", siteMacroPage.changed, true);
            window.removeEventListener("unload", siteMacroPage.unloaded);
            chrome.runtime.onMessage.removeListener(siteMacroPage.message);        
            document.body.removeChild(siteMacroPage.div1);
            document.body.removeChild(siteMacroPage.div2);
            document.body.style.paddingTop=siteMacroPage.paddingtop;
            document.body.style.paddingBottom=siteMacroPage.paddingbottom;
        }
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
        div.style.position="fixed"; div.style.left="0px"; div.style.width="100vw"; div.style.background="#700";
        div.style.textAlign="center"; div.style.zIndex=9999; div.style.color="#fff"; div.style.fontWeight="bold";
        div.appendChild(document.createTextNode("SiteMacro recording... "));
        div.style.transition="height 0.5s ease";
        return div;
    },

    showRecording: function() {
        siteMacroPage.div1 = siteMacroPage.redDiv();
        siteMacroPage.div1.style.top="0px"; siteMacroPage.div1.style.height="100vh";
        document.body.appendChild(siteMacroPage.div1);

        siteMacroPage.counter = document.createElement("span");
        siteMacroPage.div1.appendChild(siteMacroPage.counter);

        siteMacroPage.div2 = siteMacroPage.redDiv();
        siteMacroPage.div2.style.bottom="0px"; siteMacroPage.div2.style.height="1.3em";
        document.body.appendChild(siteMacroPage.div2);

        setTimeout(() => {
            siteMacroPage.div1.style.height="1.3em"; 
        }, 100);
        siteMacroPage.paddingtop = document.body.style.paddingTop;
        siteMacroPage.paddingbottom = document.body.style.paddingBottom;
        document.body.style.paddingTop="1.3em";
        document.body.style.paddingBottom="1.3em";
    }
}

window.addEventListener("click", siteMacroPage.clicked, true);
window.addEventListener("change", siteMacroPage.changed, true);
window.addEventListener("unload", siteMacroPage.unloaded);
siteMacroPage.showRecording();
chrome.runtime.onMessage.addListener(siteMacroPage.message);