'use strict';

function Restify(url) {

	function send_object(object, callback) {
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
		if(object.key) {
			xhr.open('POST', url + '/' + object.name, true);
		}
		else {
			xhr.open('PUT', url, true);
		}
		xhr.send(form_data);
	}

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

		get : function(key, callback) {
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					var object = JSON.parse(event.target.responseText);
					callback(object);
				}
			);
			xhr.open('GET', url + '/' + key, true);
			xhr.send();
		},

		save : send_object,

		add : send_object,

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
