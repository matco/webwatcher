'use strict';

var Authentication = (function() {
	var authenticated = false;

	var authentication_callback;
	var initialization_callback;

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
		//TODO improve this
		window.location.reload();
	}

	return {
		Check : function(callback) {
			if(authenticated) {
				callback();
			}
			else {
				Authentication.Open(true, callback);
			}
		},
		IsAuthenticated : function() {
			return authenticated;
		},
		Open : function(cancellable, callback) {
			authentication_callback = callback;
			document.getElementById('authentication_cancel').style.display = cancellable ? 'inline' : 'none';
			var authentication_form = document.getElementById('authentication');
			UI.OpenModal(authentication_form, true);
			authentication_form['password'].focus();
		},
		OpenInitialization : function(callback) {
			initialization_callback = callback;
			var initialization_form = document.getElementById('initialization');
			UI.OpenModal(initialization_form, true);
			initialization_form['password_1'].focus();
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
								if(initialization_callback) {
									initialization_callback();
									initialization_callback = undefined;
								}
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
					Authentication.Open(true);
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