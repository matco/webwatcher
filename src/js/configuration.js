import {UI} from './ui.js';
import {Subscribers, Websites} from './services.js';

//subscribers
function delete_subscriber_listener(event) {
	event.stop();
	const subscriber_ui = this.parentNode.parentNode;
	Subscribers.delete(subscriber_ui.dataset.pk).then(() => {
		subscriber_ui.parentNode.removeChild(subscriber_ui);
		UI.Notify('Subscriber deleted successfully');
	});
}

function draw_subscriber(subscriber) {
	const subscriber_ui = document.createFullElement('tr', {'data-pk': subscriber.pk});
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

//websites
function edit_website_listener(event) {
	event.stop();
	const website_ui = this.parentNode.parentNode;
	Websites.get(website_ui.dataset.pk).then(website => {
		const website_form = document.getElementById('website');
		website_form['pk'].value = website.pk;
		website_form['name'].value = website.name;
		website_form['url'].value = website.url;
		website_form['text'].value = website.text;
		website_form.style.display = 'block';
	});
}

function delete_website_listener(event) {
	event.stop();
	const website_ui = this.parentNode.parentNode;
	Websites.delete(website_ui.dataset.pk).then(() => {
		website_ui.parentNode.removeChild(website_ui);
		UI.Notify('Website deleted successfully');
	});
}

function disable_website_listener(event) {
	event.stop();
	const link = this;
	const container = this.parentNode;
	website_action(container.parentNode.dataset.pk, 'disable').then(() => {
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
	website_action(container.parentNode.dataset.pk, 'enable').then(() => {
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
	const website_ui = document.createFullElement('tr', {'data-pk': website.pk});
	website_ui.appendChild(document.createFullElement('td', {}, website.name));
	website_ui.appendChild(document.createFullElement('td', {}, website.url));
	website_ui.appendChild(document.createFullElement('td', {}, website.text));
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

const subscriber_comparator = (s1, s2) => s1.email.compareTo(s2.email);
const website_comparator = (w1, w2) => w1.name.compareTo(w2.name);

export const Configuration = {
	ShowMain: async function() {
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
	},
	ShowSubscribers: function() {
		const subscribers_ui = document.getElementById('subscribers');
		subscribers_ui.empty();
		Subscribers.list().then(s => s.sort(subscriber_comparator).map(draw_subscriber).forEach(Node.prototype.appendChild, subscribers_ui));
	},
	ShowWebsites: function() {
		const websites_ui = document.getElementById('websites');
		websites_ui.empty();
		Websites.list().then(w => w.sort(website_comparator).map(draw_website).forEach(Node.prototype.appendChild, websites_ui));
	},
	Init: function() {
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
					method: 'PUT',
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
		document.getElementById('subscriber').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const form = this;
				const subscriber = {email: this['email'].value};
				Subscribers.add(subscriber).then(subscriber => {
					document.getElementById('subscribers').appendChild(draw_subscriber(subscriber));
					form.reset();
					UI.Notify('Subscriber added successfully');
				});
			}
		);

		//websites
		document.getElementById('website_add').addEventListener(
			'click',
			function() {
				const website_form = document.getElementById('website');
				website_form.reset();
				website_form['pk'].value = '';
				website_form['name'].removeAttribute('disabled');
				website_form.style.display = 'block';
			}
		);

		document.getElementById('website_cancel').addEventListener(
			'click',
			function() {
				document.getElementById('website').style.display = 'none';
			}
		);

		document.getElementById('website').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const form = this;
				const website = {pk: this['pk'].value || undefined, name: this['name'].value, url: this['url'].value, text: this['text'].value};
				const websites_ui = document.getElementById('websites');
				if(website.pk) {
					Websites.save(website).then(() => {
						const website_ui = websites_ui.querySelector(`tr[data-pk="${website.pk}"]`);
						websites_ui.insertBefore(draw_website(website), website_ui.nextSibling);
						websites_ui.removeChild(website_ui);
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
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');

				const response = await fetch('/api/recalculate');
				const result = await response.json();

				this.removeAttribute('disabled');
				this.classList.remove('loading');
				UI.Notify(result.message);
			}
		);

		document.getElementById('test_mail').addEventListener(
			'click',
			async function(event) {
				event.stop();
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');

				const response = await fetch('/api/testmail', {method: 'POST'});
				const result = await response.json();

				this.removeAttribute('disabled');
				this.classList.remove('loading');
				UI.Notify(result.message);
			}
		);
	}
};
