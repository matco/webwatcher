'use strict';

var Subscribers = Restify('/api/subscribers');
var Websites = Restify('/api/websites');

window.addEventListener(
	'load',
	function() {
		Configuration.Init(Websites, Subscribers);
		Status.Init(Websites);
		Authentication.Init();

		var xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				if(event.target.status === 403) {
					location.hash = '#';
					UI.OpenModal(document.getElementById('initialization'), true);
				}
				else {
					document.getElementById('content').style.display = 'block';
					location.hash = '#section=status';
					//trigger manually hash change event
					var event = document.createEvent('UIEvent');
					event.initUIEvent('hashchange', true, true, this.window, 1);
					window.dispatchEvent(event);
				}
			}
		);
		xhr.open('GET', '/api/status', true);
		xhr.send();

		//debug
		var debug = false;
		if(debug) {
			//add subscriber
			Subscribers.add({email : 'john.doe@example.com'});

			//add websites
			Websites.add({name : 'Example', url : 'http://www.example.org', texts : 'Example Domain'});
			//TODO add a multiple text like 'This domain is established to be used for illustrative examples in documents.'
			Websites.add({name : 'Invalid', url : 'http://www.invalid-website.org', texts : 'Invalid website'});
		}
	}
)