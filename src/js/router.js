import {Configuration} from './configuration.js';
import {Status} from './status.js';
import {UI} from './ui.js';
import {Hash} from './hash.js';

let refresh_status_page_interval;

export const Router = {
	Init: function() {
		window.addEventListener(
			'hashchange',
			function() {
				//retrieve pages
				const config = document.getElementById('config');
				const status = document.getElementById('status');
				//retrieve links
				const menu_config = document.getElementById('menu_config');
				const menu_status = document.getElementById('menu_status');

				function unselect_all() {
					//stop refreshing status page
					if(refresh_status_page_interval) {
						clearInterval(refresh_status_page_interval);
					}
					//hide all pages
					config.style.display = 'none';
					status.style.display = 'none';
					//unselect links
					menu_config.classList.remove('selected');
					menu_status.classList.remove('selected');
				}

				function unselect_all_config() {
					document.querySelectorAll('a[href^="#page=config"]').forEach(a => a.classList.remove('selected'));
					document.getElementById('section_main').style.display = 'none';
					document.getElementById('section_subscribers').style.display = 'none';
					document.getElementById('section_websites').style.display = 'none';
					document.getElementById('section_other').style.display = 'none';
				}

				//close all modals
				UI.CloseModals();

				//retrieve data encoded in hash
				const data = Hash.Decode(location.hash);

				if(data.page === 'config') {
					unselect_all();
					unselect_all_config();
					//update page
					if(data.section === 'subscribers') {
						Configuration.ShowSubscribers();
						document.querySelector('a[href="#page=config&section=subscribers"]').classList.add('selected');
						document.getElementById('section_subscribers').style.display = 'block';
					}
					else if(data.section === 'websites') {
						Configuration.ShowWebsites();
						document.querySelector('a[href="#page=config&section=websites"]').classList.add('selected');
						document.getElementById('section_websites').style.display = 'block';
					}
					else if(data.section === 'other') {
						document.querySelector('a[href="#page=config&section=other"]').classList.add('selected');
						document.getElementById('section_other').style.display = 'block';
					}
					else {
						Configuration.ShowMain();
						document.querySelector('a[href="#page=config&section=main"]').classList.add('selected');
						document.getElementById('section_main').style.display = 'block';
					}
					//display page
					menu_config.classList.add('selected');
					config.style.display = 'flex';
				}
				else {
					unselect_all();
					//update page
					Status.Show();
					//refresh page automatically
					refresh_status_page_interval = setInterval(Status.Show, 10000);
					//display page
					menu_status.classList.add('selected');
					status.style.display = 'block';
					//details
					if(data.hasOwnProperty('details')) {
						Status.Detail(data.details);
					}
				}
			}
		);

		//trigger manually hash change event
		const event = document.createEvent('UIEvent');
		event.initUIEvent('hashchange', true, true, window, 1);
		window.dispatchEvent(event);
	}
};
