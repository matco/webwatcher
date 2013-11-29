'use strict';

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
						UI.Notify(JSON.parse(event.target.responseText).message);
					}
					else {
						if(callback) {
							callback();
						}
					}
				}
			);
			xhr.open('PUT', url, true);
			xhr.send(form_data);
		},

		remove : function(key, callback) {
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					if(event.target.status === 400) {
						UI.Notify(JSON.parse(event.responseText).message);
					}
					else {
						if(callback) {
							callback();
						}
					}
				}
			);
			xhr.open('DELETE', url + '/' + key, true);
			xhr.send();
		}
	};
}

var UI = {};
(function() {
	//show tab associated content and hide other contents
	function select_tab() {
		if(!this.classList.contains('disabled')) {
			this.parentNode.children.forEach(function(tab) {
				if(tab === this) {
					tab.classList.add('selected');
					document.getElementById(tab.dataset.tab).style.display = 'block';
				}
				else {
					tab.classList.remove('selected');
					document.getElementById(tab.dataset.tab).style.display = 'none';
				}
			}, this);
		}
	}

	UI.Tabify = function(container) {
		container.children.forEach(function(tab) {
			document.getElementById(tab.dataset.tab).style.display = tab.classList.contains('selected') ? 'block' : 'none';
			tab.addEventListener('click', select_tab);
		});
	};

	var notification_close_time = 5000;
	var notification_interval;
	var notification_timeout;

	UI.Notify = function(message) {
		var notification = document.getElementById('notification');
		//stop current animation if required
		if(notification_interval) {
			clearInterval(notification_interval);
		}
		if(notification_timeout) {
			clearTimeout(notification_timeout);
		}
		//update notification
		notification.textContent = message;
		notification.style.opacity = 1;
		notification.style.display = 'block';
		//start animation
		notification_timeout = setTimeout(function() {
			notification_interval = setInterval(function() {
				if(notification.style.opacity <= 0.01) {
					notification.style.display = 'none';
					clearInterval(notification_interval);
				}
				else {
					notification.style.opacity -= 0.01;
				}
			}, 10);
		}, notification_close_time);
	}
})();

window.addEventListener(
	'load',
	function() {
		//manage configuration
		var configuration = document.getElementById('configuration');

		function update_configuration() {
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					var settings = JSON.parse(event.target.responseText);
					configuration['sender_email'].value = settings.sender_email || '';
					configuration['website_timeout'].value = settings.website_timeout || '';
					configuration['avoid_cache'].checked = settings.avoid_cache === 'True';
				}
			);
			xhr.open('GET', '/api/configuration', true);
			xhr.send(null);
		}

		configuration.addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						UI.Notify('Modifications save successfully');
					}
				);
				var form_data = new FormData();
				form_data.append('configuration', JSON.stringify({
					sender_email : this['sender_email'].value,
					website_timeout : this['website_timeout'].value,
					avoid_cache : this['avoid_cache'].checked
				}));
				xhr.open('POST', '/api/configuration', true);
				xhr.send(form_data);
			}
		);

		//manage subscribers list
		var Subscribers = restify('/api/subscriber');

		var subscribers_ui = document.getElementById('subscribers');

		function delete_subscriber_listener(event) {
			Event.stop(event);
			var subscriber_ui = this.parentNode.parentNode;
			Subscribers.remove(subscriber_ui.dataset.key, function() {
				subscriber_ui.parentNode.removeChild(subscriber_ui);
				UI.Notify('Subscriber deleted successfully');
			});
		}

		function draw_subscriber(subscriber) {
			var subscriber_ui = document.createFullElement('tr', {'data-key' : subscriber.email});
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
					UI.Notify('Subscriber added successfully');
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
				UI.Notify('Website deleted successfully');
			});
		}

		function draw_website(website) {
			var website_ui = document.createFullElement('tr', {'data-key' : website.name});
			website_ui.appendChild(document.createFullElement('td', {}, website.name));
			website_ui.appendChild(document.createFullElement('td', {}, website.url));
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

		document.getElementById('website').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var form = this;
				var website = {name : this['name'].value, url : this['url'].value, texts : this['texts'].value, online : null};
				Websites.add(website, function() {
					websites_ui.appendChild(draw_website(website));
					form.reset();
					UI.Notify('Website added successfully');
				});
			}
		);

		document.getElementById('initialization').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var initialization_error = document.getElementById('initialization_error');
				initialization_error.textContent = '';
				if(this['password_1'].value !== this['password_2'].value) {
					initialization_error.textContent = 'Passwords don\t match';
				}
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 401) {
							authentication_error.textContent = JSON.parse(event.target.responseText).message;
						}
						else {
							login();
							document.getElementById('initialization').style.display = 'none';
							document.getElementById('content').style.display = 'block';
							location.hash = '#config';
						}
					}
				);
				var form_data = new FormData();
				form_data.append('value', this['password_1'].value);
				xhr.open('POST', '/api/configuration/password', true);
				xhr.send(form_data);
			}
		);

		document.getElementById('authentication').addEventListener(
			'submit',
			function(event) {
				Event.stop(event);
				var authentication_error = document.getElementById('authentication_error');
				authentication_error.textContent = '';
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 401) {
							authentication_error.textContent = JSON.parse(event.target.responseText).message;
						}
						else {
							login();
							if(authentication_callback) {
								authentication_callback();
								authentication_callback = undefined;
							}
						}
					}
				);
				var form_data = new FormData();
				form_data.append('credentials', JSON.stringify({password : this['password'].value}));
				xhr.open('POST', '/api/authenticate', true);
				xhr.send(form_data);
			}
		);

		document.getElementById('authentication_cancel').addEventListener(
			'click',
			function() {
				authentication_callback = undefined;
				document.getElementById('authentication').style.display = 'none';
				location.hash = '#status';
			}
		);

		document.getElementById('login').addEventListener(
			'click',
			function() {
				document.getElementById('authentication').style.display = 'block';
			}
		);

		document.getElementById('logout').addEventListener(
			'click',
			function() {
				var xhr = new XMLHttpRequest();
				xhr.addEventListener('load', logout);
				xhr.open('DELETE', '/api/authenticate', true);
				xhr.send(null);
			}
		);

		//status
		function draw_state(state) {
			var state_ui = document.createFullElement('tr', {'data-key' : state.name, 'class' : state.online === null ? 'na' : state.online ? 'ok' : 'nok'});
			state_ui.appendChild(document.createFullElement('td', {}, state.name));
			state_ui.appendChild(document.createFullElement('td', {}, state.update ? new Date(state.update).toFullDisplay() : 'NA'));
			state_ui.appendChild(document.createFullElement('td', {}, state.downtime));
			state_ui.appendChild(document.createFullElement('td', {}, state.uptime));
			var online;
			if(state.uptime || state.downtime) {
				online = state.uptime / (state.downtime + state.uptime) * 100;
				online = Math.round(online * 10) / 10;
				online += '%';
			}
			else {
				online = 'NA';
			}
			state_ui.appendChild(document.createFullElement('td', {}, online));
			var state_actions = document.createFullElement('td');
			state_actions.appendChild(document.createFullElement(
				'a',
				{href : '#', title : 'View details'},
				'Details',
				{click : detail_website_listener}
			));
			state_ui.appendChild(state_actions);
			return state_ui;
		}

		function update_states() {
			var states = document.getElementById('states');
			states.clear();
			Websites.list(function(websites) {
				websites.map(draw_state).forEach(Node.prototype.appendChild, states);
			});
		}

		document.getElementById('status_check_now').addEventListener(
			'click',
			function(event) {
				Event.stop(event);
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(xhr_event) {
						if(xhr_event.target.status === 200) {
							update_states();
							UI.Notify('Websites have been checked successfully');
						}
					}
				);
				xhr.open('GET', '/api/check', true);
				xhr.send(null);
			}
		);

		//status details
		document.getElementById('status_details_close').addEventListener(
			'click',
			function() {
				document.getElementById('status_details').style.display = 'none';
			}
		);

		function draw_downtime(downtime) {
			var downtime_ui = document.createFullElement('tr');
			var start = new Date(downtime.start);
			var stop = downtime.stop ? new Date(downtime.stop) : undefined;
			downtime_ui.appendChild(document.createFullElement('td', {}, start.toFullDisplay()));
			downtime_ui.appendChild(document.createFullElement('td', {}, stop ? stop.toFullDisplay() : ''));
			downtime_ui.appendChild(document.createFullElement('td', {style : 'text-align: right;'}, stop ? Math.round((stop.getTime() - start.getTime()) / 1000) : ''));
			downtime_ui.appendChild(document.createFullElement('td', {title : downtime.rationale, style : 'width: 320px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;'}, downtime.rationale));
			return downtime_ui;
		}

		function detail_website_listener(event) {
			Event.stop(event);
			xhr.addEventListener(
				'load',
				function(event) {
					var details = JSON.parse(event.target.responseText);
					//update link
					var status_details_link = document.getElementById('status_details_link');
					status_details_link.setAttribute('href', details.url);
					status_details_link.textContent = details.name;
					//update age
					document.getElementById('status_details_age').textContent = new Date(details.update).getAgeLiteral();
					//update check link
					var status_details_check = document.getElementById('status_details_check');
					status_details_check.clear();
					status_details_check.appendChild(document.createFullElement(
						'a',
						{href : '#'},
						'Check now',
						{
							click : function(event) {
								Event.stop(event);
								var xhr = new XMLHttpRequest();
								xhr.addEventListener(
									'load',
									function(xhr_event) {
										if(xhr_event.target.status === 200) {
											document.getElementById('status_details_age').textContent = new Date().getAgeLiteral()
											UI.Notify('Website has been checked successfully');
										}
									}
								);
								xhr.open('GET', '/api/check/' + details.name, true);
								xhr.send(null);
							}
						}
					));
					//update downtime
					var status_details_downtimes = document.getElementById('status_details_downtimes');
					status_details_downtimes.clear();
					details.downtimes.map(draw_downtime).forEach(Node.prototype.appendChild, status_details_downtimes);
				}
			);
			xhr.open('GET', '/api/details/' + this.parentNode.parentNode.dataset.key, true);
			xhr.send(null);
			document.getElementById('status_details').style.display = 'block';
		}

		UI.Tabify(document.querySelector('#config > aside > ul'));
		document.querySelector('#config > aside > ul > li[data-tab="section_1"]').click();

		//manage navigation
		var refresh_status_page_inverval;

		window.addEventListener(
			'hashchange',
			function() {
				//retrieve pages
				var config = document.getElementById('config');
				var status = document.getElementById('status');
				//retrieve links
				var config_link = document.querySelector('a[href="#config"]');
				var status_link = document.querySelector('a[href="#status"]');

				function unselect_all() {
					//stop refreshing status page
					if(refresh_status_page_inverval) {
						clearInterval(refresh_status_page_inverval);
					}
					//hide all pages
					config.style.display = 'none';
					status.style.display = 'none';
					//unselect links
					config_link.classList.remove('selected');
					status_link.classList.remove('selected');
				}

				//route
				if(location.hash === '#config') {
					var display_config = function() {
						unselect_all();
						//update page
						update_configuration();
						update_subscribers();
						update_websites();
						//display page
						config_link.classList.add('selected');
						config.style.display = 'block';
					}
					//check authentication
					if(!authenticated) {
						require_authentication(display_config);
					}
					else {
						display_config();
					}
				}
				else {
					unselect_all();
					//update page
					update_states();
					//refresh page automatically
					refresh_status_page_inverval = setInterval(update_states, 10000);
					//display page
					status_link.classList.add('selected');
					status.style.display = 'block';
				}
			}
		);

		var authenticated = false;
		var authentication_callback;

		function require_authentication(callback) {
			authentication_callback = callback;
			document.getElementById('authentication').style.display = 'block';
		}

		function login() {
			authenticated = true;
			document.getElementById('authentication').style.display = 'none';
			document.getElementById('login').style.display = 'none';
			document.getElementById('logout').style.display = 'block';
		}

		function logout() {
			authenticated = false;
			document.getElementById('login').style.display = 'none';
			document.getElementById('logout').style.display = 'block';
			location.hash = '#status';
		}

		var xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				if(event.target.status === 403) {
					location.hash = '#';
					document.getElementById('initialization').style.display = 'block';
				}
				else {
					document.getElementById('content').style.display = 'block';
					location.hash = '#status';
					//trigger manually hash change event
					var event = document.createEvent('UIEvent');
					event.initUIEvent('hashchange', true, true, this.window, 1);
					window.dispatchEvent(event);
				}
			}
		);
		xhr.open('GET', '/api/status', true);
		xhr.send(null);

		//debug
		var debug = false;
		if(debug) {
			//add subscriber
			Subscribers.add({email : 'john.doe@example.com'});

			//add websites
			Websites.add({name : 'Example', url : 'http://www.example.org', texts : 'Example Domain'});
			//TODO a multiple text like 'This domain is established to be used for illustrative examples in documents.'
			Websites.add({name : 'Invalid', url : 'http://www.invalid-website.org', texts : 'Invalid website'});
		}
	}
)