'use strict';

window.addEventListener(
	'load',
	function() {
		//notifications
		function notify(message, options) {
			if(Notification.permission !== 'granted' && Notification.permission !== 'denied') {
				Notification.requestPermission(function(status) {
					Notification.permission = status;
					//re-notify
					notify(message, options);
				});
			}
			//use native notification
			else if(Notification.permission === 'granted') {
				var notification = new Notification(message, options);
				notification.addEventListener('show', function() {
					setTimeout(function() {
						notification.close();
					}, 5000);
				});
			}
			//fallback on alert
			else {
				alert(message);
			}
		}

		//manage website list
		var websites_ui = document.getElementById('websites');

		function draw_website(website) {
			console.log(website);
			var website_ui = document.createFullElement('tr', {'class' : website.status === null ? 'na' : website.status ? 'ok' : 'nok'});
			website_ui.appendChild(document.createFullElement('td', {}, website.name));
			website_ui.appendChild(document.createFullElement('td', {}, website.url));
			website_ui.appendChild(document.createFullElement('td', {}, website.update ? new Date(website.update).toFullDisplay() : 'NA'));
			var website_actions = document.createFullElement('td');
			website_actions.appendChild(document.createFullElement(
				'a',
				{href : '#', title : 'Unwatch this website and delete all logs'},
				'Delete',
				{
					'click' : function(event) {
						Event.stop(event);
						var xhr = new XMLHttpRequest();
						xhr.addEventListener(
							'load',
							function(event) {
								console.log(event);
								if(event.target.status === 400) {
									notify(JSON.parse(event.responseText).message);
								}
								else {
									update_websites();
								}
							}
						);
						xhr.open('DELETE', '/api/status/' + website.name, true);
						xhr.send(null);
					}
				}
			));
			website_ui.appendChild(website_actions);
			return website_ui;
		}

		function update_websites() {
			websites_ui.clear();
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					var websites = JSON.parse(event.target.responseText);
					websites.map(draw_website).forEach(Node.prototype.appendChild, websites_ui);
				}
			);
			xhr.open('GET', '/api/status', true);
			xhr.send();
		}

		update_websites();

		document.getElementById('website').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var form_data = new FormData();
				form_data.append('website', JSON.stringify({name : this['name'].value, url : this['url'].value, texts : this['texts'].value}));
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 400) {
							notify(JSON.parse(event.target.responseText).message);
						}
						else {
							update_websites();
						}
					}
				);
				xhr.open('POST', '/api/status', true);
				xhr.send(form_data);
			}
		);

		//autoadd
		document.getElementById('website')['name'].value = 'Example';
		document.getElementById('website')['url'].value = 'http://www.example.org';
		document.getElementById('website')['texts'].value = 'Example Domain';
	}
)