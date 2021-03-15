import {UI} from './ui.js';

//override fetch function to intercept errors
const original_fetch = window.fetch;
window.fetch = function() {
	return new Promise(resolve => {
		original_fetch.apply(this, arguments).then(response => {
			//no right to perform the request
			if(response.status === 401) {
				Authentication.Open(true).then(() => resolve(original_fetch.apply(this, arguments)));
			}
			else {
				resolve(response);
			}
		});
	});
};

const status = {
	protected: true,
	authenticated: false
};

let authentication_promise = undefined;
let authentication_resolve = undefined;
let authentication_reject = undefined;

let initialization_promise = undefined;
let initialization_resolve = undefined;
let initialization_reject = undefined;

export const Authentication = {
	GetStatus: function() {
		//return a copy of the status object
		return Object.assign({}, status);
	},
	Open: function(cancellable) {
		//authentication window may have already been open
		if(authentication_promise) {
			return authentication_promise;
		}
		authentication_promise = new Promise((resolve, reject) => {
			authentication_resolve = resolve;
			authentication_reject = reject;

			document.getElementById('authentication_cancel').style.display = cancellable ? 'inline' : 'none';
			const authentication_form = document.getElementById('authentication');
			UI.OpenModal(authentication_form, true);
			authentication_form['password'].focus();
		});
		return authentication_promise;
	},
	OpenInitialization: function() {
		//initialization window may have already been open
		if(initialization_promise) {
			return initialization_promise;
		}
		initialization_promise = new Promise((resolve, reject) => {
			initialization_resolve = resolve;
			initialization_reject = reject;

			const initialization_form = document.getElementById('initialization');
			UI.OpenModal(initialization_form, true);
			initialization_form['password_1'].focus();
		});
		return initialization_promise;
	},
	Init: async function() {
		document.getElementById('initialization').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const initialization_error = document.getElementById('initialization_error');
				initialization_error.textContent = '';
				if(this['password_1'].value !== this['password_2'].value) {
					initialization_error.textContent = 'Passwords don\'t match';
					return;
				}
				const xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 401) {
							document.getElementById('authentication_error').textContent = JSON.parse(event.target.responseText).message;

							initialization_promise = undefined;
							initialization_reject();
						}
						else {
							//after initialization, consider that user is logged in
							status.protected = true;
							status.authenticated = true;
							UI.CloseModal(document.getElementById('initialization'));
							document.getElementById('login').style.display = 'none';
							document.getElementById('logout').style.display = 'block';
							location.hash = '#section=config';

							initialization_promise = undefined;
							initialization_resolve();
						}
					}
				);
				const form_data = new FormData();
				form_data.append('value', this['password_1'].value);
				xhr.open('POST', '/api/configuration/password', true);
				xhr.send(form_data);
			}
		);

		document.getElementById('authentication').addEventListener(
			'submit',
			function(event) {
				event.stop();
				const authentication_error = document.getElementById('authentication_error');
				authentication_error.textContent = '';
				const xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 401) {
							authentication_error.textContent = JSON.parse(event.target.responseText).message;

							authentication_promise = undefined;
							authentication_reject();
						}
						else {
							status.authenticated = true;
							UI.CloseModal(document.getElementById('authentication'));
							document.getElementById('login').style.display = 'none';
							document.getElementById('logout').style.display = 'block';

							authentication_promise = undefined;
							authentication_resolve();
						}
					}
				);
				const form_data = new FormData();
				form_data.append('credentials', JSON.stringify({password: this['password'].value}));
				xhr.open('POST', '/api/authenticate', true);
				xhr.send(form_data);
			}
		);

		document.getElementById('authentication_cancel').addEventListener(
			'click',
			function() {
				UI.CloseModal(document.getElementById('authentication'));
				location.hash = '#section=status';

				authentication_promise = undefined;
				authentication_reject();
			}
		);

		document.getElementById('login').addEventListener(
			'click',
			function() {
				Authentication.Open(true);
			}
		);

		document.getElementById('logout').addEventListener(
			'click',
			function() {
				const xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function() {
						status.authenticated = false;
						//if application is protected, display login panel
						if(status.protected) {
							Authentication.Open();
						}
						//if application is not protected, return to status page
						else {
							document.getElementById('logout').style.display = 'none';
							document.getElementById('login').style.display = 'block';
							location.hash = '#section=status';
						}
					});
				xhr.open('DELETE', '/api/authenticate', true);
				xhr.send();
			}
		);

		//it's important to check the status to know if application is protected or not
		//the UI will be different depending on if application is protected or not
		const response = await fetch('/api/status');
		//application must be initialized
		if(response.status === 403) {
			await Authentication.OpenInitialization();
		}
		else {
			//update stored status from response
			Object.assign(status, await response.json());
			//application is protected and user is not logged in
			if(status.protected && !status.authenticated) {
				await Authentication.Open();
				location.hash = '#section=status';
			}
			//update login and logout buttons
			else {
				document.getElementById('login').style.display = status.authenticated ? 'none' : 'block';
				document.getElementById('logout').style.display = !status.authenticated ? 'none' : 'block';
			}
		}
	}
};
