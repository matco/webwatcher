import {UI} from './ui.js';

//subscribers
let subscribers_service;
let subscribers_ui;

function delete_subscriber_listener(event) {
	event.stop();
	const subscriber_ui = this.parentNode.parentNode;
	subscribers_service.remove(subscriber_ui.dataset.id, function() {
		subscriber_ui.parentNode.removeChild(subscriber_ui);
		UI.Notify('Subscriber deleted successfully');
	});
}

function draw_subscriber(subscriber) {
	const subscriber_ui = document.createFullElement('tr', {'data-id': subscriber.id});
	subscriber_ui.appendChild(document.createFullElement('td', {}, subscriber.email));
	const subscribe_actions = document.createFullElement('td');
	subscribe_actions.appendChild(document.createFullElement(
		'a',
		{href: '#', title: 'Delete this subscriber'},
		'Delete',
		{click: delete_subscriber_listener}
	));
	subscriber_ui.appendChild(subscribe_actions);
	return subscriber_ui;
}

function update_subscribers() {
	subscribers_ui.clear();
	subscribers_service.list(function(subscribers) {
		subscribers.map(draw_subscriber).forEach(Node.prototype.appendChild, subscribers_ui);
	});
}

//websites
let websites_service;
let websites_ui;
let website_form;

function edit_website_listener(event) {
	event.stop();
	const website_ui = this.parentNode.parentNode;
	websites_service.get(website_ui.dataset.id, function(website) {
		website_form['id'].value = website.id;
		website_form['name'].setAttribute('disabled', 'disabled');
		website_form['name'].value = website.name;
		website_form['url'].value = website.url;
		website_form['texts'].value = website.texts;
		website_form.style.display = 'block';
	});
}

function delete_website_listener(event) {
	event.stop();
	const website_ui = this.parentNode.parentNode;
	websites_service.remove(website_ui.dataset.id, function() {
		website_ui.parentNode.removeChild(website_ui);
		UI.Notify('Website deleted successfully');
	});
}

function disable_website_listener(event) {
	event.stop();
	const link = this;
	const container = this.parentNode;
	website_action(container.parentNode.dataset.id, 'disable', function() {
		container.removeChild(link);
		container.insertBefore(document.createFullElement(
			'a',
			{href: '#', title: 'Re-enable this website'},
			'Enable',
			{click: enable_website_listener}
		), container.lastChild);
	});
}

function enable_website_listener(event) {
	event.stop();
	const link = this;
	const container = this.parentNode;
	website_action(container.parentNode.dataset.id, 'enable', function() {
		container.removeChild(link);
		container.insertBefore(document.createFullElement(
			'a',
			{href: '#', title: 'Disable this website temporarily'},
			'Disable',
			{click: disable_website_listener}
		), container.lastChild);
	});
}

function website_action(website, action, callback) {
	const xhr = new XMLHttpRequest();
	xhr.addEventListener(
		'load',
		function(event) {
			UI.Notify(JSON.parse(event.target.responseText).message);
			callback();
		}
	);
	xhr.open('GET', `/api/websites/${website}/action/${action}`, true);
	xhr.send();
}

function draw_website(website) {
	const website_ui = document.createFullElement('tr', {'data-id': website.id});
	website_ui.appendChild(document.createFullElement('td', {}, website.name));
	website_ui.appendChild(document.createFullElement('td', {}, website.url));
	website_ui.appendChild(document.createFullElement('td', {}, website.texts));
	const website_actions = document.createFullElement('td');
	website_actions.appendChild(document.createFullElement(
		'a',
		{href: '#', title: 'Edit this website', style: 'margin-right: 5px;'},
		'Edit',
		{click: edit_website_listener}
	));
	if(website.disabled) {
		website_actions.appendChild(document.createFullElement(
			'a',
			{href: '#', title: 'Re-enable this website'},
			'Enable',
			{click: enable_website_listener}
		));
	}
	else {
		website_actions.appendChild(document.createFullElement(
			'a',
			{href: '#', title: 'Disable this website temporarily'},
			'Disable',
			{click: disable_website_listener}
		));
	}
	website_actions.appendChild(document.createFullElement(
		'a',
		{href: '#', title: 'Unwatch this website and delete all logs', style: 'margin-left: 5px;'},
		'Delete',
		{click: delete_website_listener}
	));
	website_ui.appendChild(website_actions);
	return website_ui;
}

function update_websites() {
	websites_ui.clear();
	websites_service.list(function(websites) {
		websites.map(draw_website).forEach(Node.prototype.appendChild, websites_ui);
	});
}

export const Configuration = {
	Show: function() {
		const xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				const settings = JSON.parse(event.target.responseText);
				const configuration = document.getElementById('configuration');
				configuration['protect_app'].checked = settings.protect_app === 'True';
				configuration['smtp_host'].value = settings.smtp_host || '';
				configuration['smtp_port'].value = settings.smtp_port || '';
				configuration['smtp_username'].value = settings.smtp_username || '';
				configuration['smtp_password'].value = settings.smtp_password || '';
				configuration['sender_email'].value = settings.sender_email || '';
				configuration['website_timeout'].value = settings.website_timeout || '';
				configuration['avoid_cache'].checked = settings.avoid_cache === 'True';
			}
		);
		xhr.open('GET', '/api/configuration', true);
		xhr.send();
		//update other sections
		update_subscribers();
		update_websites();
	},
	Init: function(Websites, Subscribers) {
		//services
		websites_service = Websites;
		subscribers_service = Subscribers;

		//general
		UI.Tabify(document.querySelector('#config > aside > ul'));
		document.querySelector('#config > aside > ul > li[data-tab="section_1"]').click();

		//basic configuration
		document.getElementById('configuration').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function() {
						UI.Notify('Modifications saved successfully');
					}
				);
				const form_data = new FormData();
				form_data.append('configuration', JSON.stringify({
					protect_app: this['protect_app'].checked,
					smtp_host: this['smtp_host'].value,
					smtp_port: this['smtp_port'].value,
					smtp_username: this['smtp_username'].value,
					smtp_password: this['smtp_password'].value,
					sender_email: this['sender_email'].value,
					website_timeout: this['website_timeout'].value,
					avoid_cache: this['avoid_cache'].checked
				}));
				xhr.open('POST', '/api/configuration', true);
				xhr.send(form_data);
			}
		);

		//subscribers
		subscribers_ui = document.getElementById('subscribers');

		document.getElementById('subscriber').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const form = this;
				const subscriber = {email: this['email'].value};
				subscribers_service.add(subscriber, function() {
					subscribers_ui.appendChild(draw_subscriber(subscriber));
					form.reset();
					UI.Notify('Subscriber added successfully');
				});
			}
		);

		//websites
		websites_ui = document.getElementById('websites');
		website_form = document.getElementById('website');

		document.getElementById('website_add').addEventListener(
			'click',
			function() {
				website_form.reset();
				website_form['id'].value = '';
				website_form['name'].removeAttribute('disabled');
				website_form.style.display = 'block';
			}
		);

		document.getElementById('website_cancel').addEventListener(
			'click',
			function() {
				website_form.style.display = 'none';
			}
		);

		website_form.addEventListener(
			'submit',
			function(event) {
				event.stop();
				const form = this;
				const website = {id: this['id'].value || undefined, name: this['name'].value, url: this['url'].value, texts: this['texts'].value, online: null};
				if(website.id) {
					websites_service.save(website, function() {
						websites_ui.removeChild(websites_ui.querySelector(`tr[data-id="${website.id}"]`));
						websites_ui.appendChild(draw_website(website));
						form.reset();
						form.style.display = 'none';
						UI.Notify('Website saved successfully');
					});
				}
				else {
					websites_service.add(website, function(website) {
						websites_ui.appendChild(draw_website(website));
						form.reset();
						UI.Notify('Website added successfully');
					});
				}
			}
		);

		//other
		document.getElementById('recalculate').addEventListener(
			'click',
			function(event) {
				event.stop();
				const that = this;
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');
				const xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(xhr_event) {
						that.removeAttribute('disabled');
						that.classList.remove('loading');
						UI.Notify(JSON.parse(xhr_event.target.responseText).message);
					}
				);
				xhr.open('GET', '/api/recalculate', true);
				xhr.send();
			}
		);
	}
};
