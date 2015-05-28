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
			var menu_config = document.getElementById('menu_config');
			var menu_status = document.getElementById('menu_status');

			function unselect_all() {
				//stop refreshing status page
				if(refresh_status_page_inverval) {
					clearInterval(refresh_status_page_inverval);
				}
				//hide all pages
				config.style.display = 'none';
				status.style.display = 'none';
				//unselect links
				menu_config.classList.remove('selected');
				menu_status.classList.remove('selected');
			}

			//retrieve data encoded in hash
			var data = Hash.Decode(location.hash);

			if(data.section === 'config') {
				//check authentication
				Authentication.Check(function() {
					unselect_all();
					//update page
					Configuration.Show();
					//display page
					menu_config.classList.add('selected');
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
				menu_status.classList.add('selected');
				status.style.display = 'block';
			}
		}
	);
})();