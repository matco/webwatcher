'use strict';

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

function restify(url) {

	return {
		list : function(callback) {
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					var objects = JSON.parse(event.target.responseText);
					callback(objects);
				}
			);
			xhr.open('GET', url, true);
			xhr.send();
		},

		add : function(object, callback) {
			var form_data = new FormData();
			form_data.append('object', JSON.stringify(object));
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					if(event.target.status === 400) {
						notify(JSON.parse(event.target.responseText).message);
					}
					else {
						callback();
					}
				}
			);
			xhr.open('POST', url, true);
			xhr.send(form_data);
		},

		remove : function(key, callback) {
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					if(event.target.status === 400) {
						notify(JSON.parse(event.responseText).message);
					}
					else {
						callback();
					}
				}
			);
			xhr.open('DELETE', url + '/' + key, true);
			xhr.send();
		}
	};
}

window.addEventListener(
	'load',
	function() {
		//manage subscribers list
		var Subscribers = restify('/api/subscriber');

		var subscribers_ui = document.getElementById('subscribers');

		function delete_subscriber_listener(event) {
			Event.stop(event);
			var subscriber_ui = this.parentNode.parentNode;
			Subscribers.remove(subscriber_ui.dataset.key, function() {
				subscriber_ui.parentNode.removeChild(subscriber_ui);
			});
		}

		function draw_subscriber(subscriber) {
			var subscriber_ui = document.createFullElement('tr', {'data-key' : subscriber.email, 'class' : 'na'});
			subscriber_ui.appendChild(document.createFullElement('td', {}, subscriber.email));
			var subscribe_actions = document.createFullElement('td');
			subscribe_actions.appendChild(document.createFullElement(
				'a',
				{href : '#', title : 'Delete this subscriber'},
				'Delete',
				{click : delete_subscriber_listener}
			));
			subscriber_ui.appendChild(subscribe_actions);
			return subscriber_ui;
		}

		function update_subscribers() {
			subscribers_ui.clear();
			Subscribers.list(function(subscribers) {
				subscribers.map(draw_subscriber).forEach(Node.prototype.appendChild, subscribers_ui);
			});
		}

		document.getElementById('subscriber').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var form = this;
				var subscriber = {email : this['email'].value};
				Subscribers.add(subscriber, function() {
					subscribers_ui.appendChild(draw_subscriber(subscriber));
					form.reset();
				});
			}
		);

		//manage websites list
		var Websites = restify('/api/website');

		var websites_ui = document.getElementById('websites');

		function delete_website_listener(event) {
			Event.stop(event);
			var website_ui = this.parentNode.parentNode;
			Websites.remove(website_ui.dataset.key, function() {
				website_ui.parentNode.removeChild(website_ui);
			});
		}

		function draw_website(website) {
			var website_ui = document.createFullElement('tr', {'data-key' : website.name, 'class' : website.status === null ? 'na' : website.status ? 'ok' : 'nok'});
			website_ui.appendChild(document.createFullElement('td', {}, website.name));
			website_ui.appendChild(document.createFullElement('td', {}, website.url));
			website_ui.appendChild(document.createFullElement('td', {}, website.update ? new Date(website.update).toFullDisplay() : 'NA'));
			var website_actions = document.createFullElement('td');
			website_actions.appendChild(document.createFullElement(
				'a',
				{href : '#', title : 'Unwatch this website and delete all logs'},
				'Delete',
				{click : delete_website_listener}
			));
			website_ui.appendChild(website_actions);
			return website_ui;
		}

		function update_websites() {
			websites_ui.clear();
			Websites.list(function(websites) {
				websites.map(draw_website).forEach(Node.prototype.appendChild, websites_ui);
			});
		}

		update_subscribers();
		update_websites();

		document.getElementById('website').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var form = this;
				var website = {name : this['name'].value, url : this['url'].value, texts : this['texts'].value};
				Websites.add(website, function() {
					websites_ui.appendChild(draw_website(website));
					form.reset();
				});
			}
		);

		//debug
		var debug = false;
		if(debug) {
			//add subscriber
			document.getElementById('subscriber')['email'].value = 'matthieu.corageoud@rodanotech.ch';
			document.getElementById('subscriber').submit();

			//add website
			setTimeout(function() {
				document.getElementById('website')['name'].value = 'Example';
				document.getElementById('website')['url'].value = 'http://www.example.org';
				document.getElementById('website')['texts'].value = 'Example Domain';
				//document.getElementById('website')['texts'].value = 'This domain is established to be used for illustrative examples in documents.';
				document.getElementById('website').submit();
			}, 1000);

			//add website
			setTimeout(function() {
				document.getElementById('website')['name'].value = 'Invalid';
				document.getElementById('website')['url'].value = 'http://www.invalid-website.org';
				document.getElementById('website')['texts'].value = '"Invalid website';
				//document.getElementById('website')['texts'].value = 'This domain is established to be used for illustrative examples in documents.';
				document.getElementById('website').submit();
			}, 2000);
		}
	}
)