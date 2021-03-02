/*global Restify, Configuration, Status, Authentication, Router*/

const Subscribers = Restify('/api/subscribers');
const Websites = Restify('/api/websites');

window.addEventListener(
	'load',
	function() {
		Configuration.Init(Websites, Subscribers);
		Status.Init(Websites);
		Authentication.Init();

		const xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				//application must be initialized
				if(event.target.status === 403) {
					Authentication.OpenInitialization(function() {
						document.getElementById('content').style.display = 'block';
						location.hash = '#section=config';
						Router.Init();
					});
				}
				//application is protected
				else if(event.target.status === 401) {
					//location.hash = '#';
					Authentication.Open(false, function() {
						document.getElementById('content').style.display = 'block';
						Router.Init();
					});
				}
				else {
					document.getElementById('content').style.display = 'block';
					Router.Init();
				}
			}
		);
		xhr.open('GET', '/api/status', true);
		xhr.send();

		//debug
		const debug = false;
		if(debug) {
			//add subscriber
			Subscribers.add({email: 'john.doe@example.com'});

			//add websites
			Websites.add({name: 'Example', url: 'http://www.example.org', texts: 'Example Domain'});
			//TODO add a multiple text like 'This domain is established to be used for illustrative examples in documents.'
			Websites.add({name: 'Invalid', url: 'http://www.invalid-website.org', texts: 'Invalid website'});
		}
	}
);
