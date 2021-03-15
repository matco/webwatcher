import 'js-tools/extension.js';
import 'js-tools/dom_extension.js';

import {Configuration} from './configuration.js';
import {Status} from './status.js';
import {Authentication} from './authentication.js';
import {Router} from './router.js';
import {Subscribers, Websites} from './services.js';

window.addEventListener(
	'load',
	async function() {
		await Authentication.Init();
		Configuration.Init();
		Status.Init();
		Router.Init();

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
