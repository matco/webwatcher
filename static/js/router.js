'use strict';

(function() {
	var refresh_status_page_inverval;

	window.addEventListener(
		'hashchange',
		function() {
			//retrieve pages
			var config = document.getElementById('config');
			var status = document.getElementById('status');
			//retrieve links
			var config_link = document.querySelector('a[href="#config"]');
			var status_link = document.querySelector('a[href="#status"]');

			function unselect_all() {
				//stop refreshing status page
				if(refresh_status_page_inverval) {
					clearInterval(refresh_status_page_inverval);
				}
				//hide all pages
				config.style.display = 'none';
				status.style.display = 'none';
				//unselect links
				config_link.classList.remove('selected');
				status_link.classList.remove('selected');
			}

			//route
			if(location.hash === '#config') {
				//check authentication
				Authentication.Check(function() {
					unselect_all();
					//update page
					Configuration.Show();
					//display page
					config_link.classList.add('selected');
					config.style.display = 'block';
				});
			}
			else {
				unselect_all();
				//update page
				Status.Show();
				//refresh page automatically
				refresh_status_page_inverval = setInterval(Status.Show, 10000);
				//display page
				status_link.classList.add('selected');
				status.style.display = 'block';
			}
		}
	);
})();