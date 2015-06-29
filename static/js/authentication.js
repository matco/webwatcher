'use strict';

var Authentication = (function() {
	var authenticated = false;
	var authentication_callback;

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

	return {
		Check : function(callback) {
			if(authenticated) {
				callback();
			}
			else {
				authentication_callback = callback;
				var authentication_form = document.getElementById('authentication');
				UI.OpenModal(authentication_form, true);
				authentication_form['password'].focus();
			}
		},
		Init : function() {
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
								location.hash = '#section=config';
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
					location.hash = '#section=status';
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
					xhr.send();
				}
			);
		}
	};
})();