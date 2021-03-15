import {UI} from './ui.js';

//override fetch function to intercept errors
const original_fetch = window.fetch;
window.fetch = function() {
	const options = arguments.length > 1 ? arguments[1] : {};
	if(options.skipInterceptor) {
		return original_fetch.apply(this, arguments);
	}
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
			async function(event) {
				event.stop();
				const initialization_error = document.getElementById('initialization_error');
				initialization_error.textContent = '';
				if(this['password_1'].value !== this['password_2'].value) {
					initialization_error.textContent = 'Passwords don\'t match';
					return;
				}
				const options = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({value: this['password_1'].value}),
					skipInterceptor: true
				};
				const response = await fetch('/api/configuration/password', options);
				if(response.status === 401) {
					const result = await response.json();
					document.getElementById('initialization_error').textContent = result.message;

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
					location.hash = '#page=config';

					initialization_promise = undefined;
					initialization_resolve();
				}
			}
		);

		document.getElementById('authentication').addEventListener(
			'submit',
			async function(event) {
				event.stop();
				const authentication_error = document.getElementById('authentication_error');
				authentication_error.textContent = '';
				const options = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({password: this['password'].value}),
					skipInterceptor: true
				};
				const response = await fetch('/api/authenticate', options);
				if(response.status === 401) {
					const result = await response.json();
					authentication_error.textContent = result.message;

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

		document.getElementById('authentication_cancel').addEventListener(
			'click',
			function() {
				UI.CloseModal(document.getElementById('authentication'));
				location.hash = '#page=status';

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
			async function() {
				const options = {
					method: 'DELETE'
				};
				await fetch('/api/authenticate', options);
				status.authenticated = false;
				//if application is protected, display login panel
				if(status.protected) {
					Authentication.Open();
				}
				//if application is not protected, return to status page
				else {
					document.getElementById('logout').style.display = 'none';
					document.getElementById('login').style.display = 'block';
					location.hash = '#page=status';
				}
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
				location.hash = '#page=status';
			}
			//update login and logout buttons
			else {
				document.getElementById('login').style.display = status.authenticated ? 'none' : 'block';
				document.getElementById('logout').style.display = !status.authenticated ? 'none' : 'block';
			}
		}
	}
};
