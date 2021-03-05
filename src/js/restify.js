import {UI} from './ui.js';

export function Restify(url) {

	function send_object(object, callback) {
		const form_data = new FormData();
		form_data.append('object', JSON.stringify(object));
		const xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				if(event.target.status === 200) {
					if(callback) {
						if(!object.id) {
							const object = JSON.parse(event.target.responseText);
							callback(object);
						}
						else {
							callback();
						}
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
		if(object.id) {
			xhr.open('PUT', `${url}/${object.id}`, true);
		}
		else {
			xhr.open('POST', url, true);
		}
		xhr.send(form_data);
	}

	return {
		list: function(callback) {
			const xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					const objects = JSON.parse(event.target.responseText);
					callback(objects);
				}
			);
			xhr.open('GET', url, true);
			xhr.send();
		},

		get: function(id, callback) {
			const xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					const object = JSON.parse(event.target.responseText);
					callback(object);
				}
			);
			xhr.open('GET', `${url}/${id}`, true);
			xhr.send();
		},

		save: send_object,

		add: send_object,

		remove: function(id, callback) {
			const xhr = new XMLHttpRequest();
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
			xhr.open('DELETE', `${url}/${id}`, true);
			xhr.send();
		}
	};
}
