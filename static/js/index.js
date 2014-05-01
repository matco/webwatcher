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
					if(event.target.status === 200) {
						if(callback) {
							callback();
						}
					}
					else if(event.target.status === 400) {
						UI.Notify(JSON.parse(event.target.responseText).message);
					}
					//unauthorized
					else if(event.target.status === 401) {
						UI.Notify(JSON.parse(event.target.responseText).message);
						//TODO show login window
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

window.addEventListener(
	'load',
	function() {
		//helpers
		function render_date(value) {
			return value ? value.toFullDisplay() : 'NA';
		}

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
						UI.Notify('Modifications saved successfully');
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
			website_ui.appendChild(document.createFullElement('td', {}, website.texts));
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
					initialization_error.textContent = 'Passwords don\'t match';
					return;
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
							document.getElementById('content').style.display = 'block';
							location.hash = '#config';
							UI.CloseModal(document.getElementById('initialization'));
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
				location.hash = '#status';
				UI.CloseModal(document.getElementById('authentication'));
			}
		);

		document.getElementById('login').addEventListener(
			'click',
			function() {
				UI.OpenModal(document.getElementById('authentication'), true);
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
		var states_columns = [
			{label : 'Name', data: 'name', type : Grid.DataType.STRING, width : 120},
			{label : 'Last check', data: 'update', type : Grid.DataType.DATE, width : 150, render : render_date},
			{label : 'Downtime', data : 'downtime', type : Grid.DataType.NUMBER, width : 250, render : render_time},
			{label : 'Uptime', data : 'uptime', type : Grid.DataType.NUMBER, width : 250, render : render_time},
			{label : 'Availability', data : 'availability', type : Grid.DataType.NUMBER, width : 80, render : render_online},
			{label : 'Actions', width : 100, unsortable : true, render : render_actions}
		];

		var states_grid = new Grid({
			container : document.getElementById('states'),
			columns : states_columns,
			path : '/js/grid/',
			rowPerPage : undefined,
			rowClass : function(record) {
				return record.online === null ? 'na' : record.online ? 'ok' : 'nok';
			}
		});

		function render_time(value, record) {
			return value ? Date.getDurationLiteral(value) : record.online ? '0' : 'NA';
		}

		function render_online(value) {
			return value ? value + '%' : 'NA';
		}

		function render_actions(value, record) {
			return document.createFullElement('a', {href : '#', title : 'View website details'}, 'Details', {click : function(event) {Event.stop(event); detail_website(record.name)}});
		}

		function update_states() {
			Websites.list(function(websites) {
				//calculate availability for each website
				websites.forEach(function(website) {
					var availability;
					if(website.uptime || website.downtime) {
						availability = website.uptime / (website.downtime + website.uptime) * 100;
						availability = Math.round(availability * 10) / 10;
					}
					website.availability = availability;
				});
				//update states grid
				states_grid.render(new Grid.Datasource({data : websites}));
			});
		}

		document.getElementById('status_check_now').addEventListener(
			'click',
			function(event) {
				Event.stop(event);
				var that = this;
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(xhr_event) {
						that.removeAttribute('disabled');
						that.classList.remove('loading');
						if(xhr_event.target.status === 200) {
							update_states();
							UI.Notify('Websites have been checked successfully');
						}
						else {
							UI.Notify('Unable to check websites');
						}
					}
				);
				xhr.open('GET', '/api/check', true);
				xhr.send(null);
			}
		);

		//status details
		document.getElementById('website_details_close').addEventListener(
			'click',
			function() {
				UI.CloseModal(document.getElementById('website_details'));
			}
		);

		var details_columns = [
			{label : 'Start', data: 'start', type : Grid.DataType.DATE, width : 150, render : render_date},
			{label : 'Stop', data: 'stop', type : Grid.DataType.DATE, width : 150, render : render_date},
			{label : 'Duration', data: 'duration', type : Grid.DataType.NUMBER, width : 200, render : render_duration},
			{label : 'Rationale', data : 'rationale', type : Grid.DataType.STRING}
		];

		var details_grid = new Grid({
			container : document.getElementById('website_details_downtimes'),
			columns : details_columns,
			path : '/js/grid/',
			rowPerPage : 10
		});

		function render_duration(value) {
			return value ? Date.getDurationLiteral(value) : 'NA';
		}

		function update_website_details_age(date) {
			var age;
			if(date) {
				age = 'Last checked ' + date.getAgeLiteral();
			}
			else {
				age = 'Not checked yet';
			}
			document.getElementById('website_details_age').textContent = age;
		}

		function detail_website(key) {
			xhr.addEventListener(
				'load',
				function(event) {
					var details = JSON.parse(event.target.responseText);
					//update link
					var website_details_link = document.getElementById('website_details_link');
					website_details_link.setAttribute('href', details.url);
					website_details_link.textContent = details.name;
					//update age
					update_website_details_age(details.update ? new Date(details.update) : undefined);
					//update check link
					var website_details_check = document.getElementById('website_details_check');
					website_details_check.clear();
					website_details_check.appendChild(document.createFullElement(
						'button',
						{},
						'Check now',
						{
							click : function(event) {
								Event.stop(event);
								var xhr = new XMLHttpRequest();
								xhr.addEventListener(
									'load',
									function(xhr_event) {
										if(xhr_event.target.status === 200) {
											update_website_details_age(new Date());
											UI.Notify('Website has been checked successfully');
										}
									}
								);
								xhr.open('GET', '/api/check/' + details.name, true);
								xhr.send(null);
							}
						}
					));
					//calculate duration for each downtime
					details.downtimes.forEach(function(downtime) {
						var duration;
						if(downtime.start && downtime.stop) {
							//TODO improve this as grid do the same job
							duration = Math.round((new Date(downtime.stop).getTime() - new Date(downtime.start).getTime()) / 1000);
						}
						downtime.duration = duration;
					});
					//update downtimes grid
					details_grid.render(new Grid.Datasource({data : details.downtimes}));
				}
			);
			xhr.open('GET', '/api/details/' + key, true);
			xhr.send(null);
			UI.OpenModal(document.getElementById('website_details'));
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
			UI.OpenModal(document.getElementById('authentication'), true);
		}

		function login() {
			authenticated = true;
			UI.CloseModal(document.getElementById('authentication'));
			document.getElementById('login').style.display = 'none';
			document.getElementById('logout').style.display = 'block';
		}

		function logout() {
			authenticated = false;
			document.getElementById('logout').style.display = 'none';
			document.getElementById('login').style.display = 'block';
			location.hash = '#status';
		}

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