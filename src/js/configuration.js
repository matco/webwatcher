import {UI} from './ui.js';
import {Subscribers, Websites} from './services.js';

//subscribers
let subscribers_ui;

function delete_subscriber_listener(event) {
	event.stop();
	const subscriber_ui = this.parentNode.parentNode;
	Subscribers.delete(subscriber_ui.dataset.id).then(() => {
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
	Subscribers.list().then(s => s.map(draw_subscriber).forEach(Node.prototype.appendChild, subscribers_ui));
}

//websites
let websites_ui;
let website_form;

function edit_website_listener(event) {
	event.stop();
	const website_ui = this.parentNode.parentNode;
	Websites.get(website_ui.dataset.id).then(website => {
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
	Websites.delete(website_ui.dataset.id).then(() => {
		website_ui.parentNode.removeChild(website_ui);
		UI.Notify('Website deleted successfully');
	});
}

function disable_website_listener(event) {
	event.stop();
	const link = this;
	const container = this.parentNode;
	website_action(container.parentNode.dataset.id, 'disable').then(() => {
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

function website_action(website, action) {
	return fetch(`/api/websites/${website}/action/${action}`)
		.then(r => r.json())
		.then(r => UI.Notify(r.message));
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
	Websites.list().then(w => w.map(draw_website).forEach(Node.prototype.appendChild, websites_ui));
}

export const Configuration = {
	Show: async function() {
		const response = await fetch('/api/configuration');
		const configuration = await response.json();
		const configuration_form = document.getElementById('configuration');
		configuration_form['protect_app'].checked = configuration.protect_app === 'True';
		configuration_form['smtp_host'].value = configuration.smtp_host || '';
		configuration_form['smtp_port'].value = configuration.smtp_port || '';
		configuration_form['smtp_username'].value = configuration.smtp_username || '';
		configuration_form['smtp_password'].value = configuration.smtp_password || '';
		configuration_form['sender_email'].value = configuration.sender_email || '';
		configuration_form['website_timeout'].value = configuration.website_timeout || '';
		configuration_form['avoid_cache'].checked = configuration.avoid_cache === 'True';
		//update other sections
		update_subscribers();
		update_websites();
	},
	Init: function() {
		//general
		UI.Tabify(document.querySelector('#config > aside > ul'));
		document.querySelector('#config > aside > ul > li[data-tab="section_1"]').click();

		//basic configuration
		document.getElementById('configuration').addEventListener(
			'submit',
			async function(event) {
				event.stop();
				const configuration = {
					protect_app: this['protect_app'].checked,
					smtp_host: this['smtp_host'].value,
					smtp_port: this['smtp_port'].value,
					smtp_username: this['smtp_username'].value,
					smtp_password: this['smtp_password'].value,
					sender_email: this['sender_email'].value,
					website_timeout: this['website_timeout'].value,
					avoid_cache: this['avoid_cache'].checked
				};
				const options = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(configuration)
				};
				await fetch('/api/configuration', options);
				UI.Notify('Modifications saved successfully');
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
				Subscribers.add(subscriber).then(subscriber => {
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
					Websites.save(website).then(() => {
						websites_ui.removeChild(websites_ui.querySelector(`tr[data-id="${website.id}"]`));
						websites_ui.appendChild(draw_website(website));
						form.reset();
						form.style.display = 'none';
						UI.Notify('Website saved successfully');
					});
				}
				else {
					Websites.add(website).then(website => {
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
			async function(event) {
				event.stop();
				const that = this;
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');

				const response = await fetch('/api/recalculate');
				const result = await response.json();

				that.removeAttribute('disabled');
				that.classList.remove('loading');
				UI.Notify(result.message);
			}
		);
	}
};
