const UI = {};

(function() {
	const notification_close_time = 5000;
	let notification_timeout;

	window.addEventListener('load', function() {
		//manage non native notifications
		function hide() {
			this.style.display = 'none';
		}
		const notification = document.getElementById('notification');
		notification.addEventListener('click', hide);
		//TODO clean this mess as soon as browsers support good event
		notification.addEventListener('animationend', hide);
		notification.addEventListener('webkitAnimationEnd', hide);
	});

	//remember if notification permission has been requested to avoid asking to the user more than once
	let notification_permission_requested = false;

	UI.Notify = function(message, options) {
		//ask for permission if user has not explicitly denied nor granted notification (permission can be default or undefined)
		if(!['granted', 'denied'].includes(Notification.permission) && !notification_permission_requested) {
			notification_permission_requested = true;
			Notification.requestPermission(function() {
				//re-notify
				UI.Notify(message, options);
			});
		}
		//use native notification
		else if(Notification.permission === 'granted') {
			const enhanced_options = Object.assign({
				lang: 'EN',
				silent: true
			}, options);
			const notification = new Notification(message, enhanced_options);
			if(notification_timeout) {
				clearTimeout(notification_timeout);
			}
			notification.addEventListener('show', function() {
				notification_timeout = setTimeout(function() {
					notification.close();
				}, notification_close_time);
			});
		}
		//fallback on html notification
		else {
			//update icon
			const notification_icon = /**@type HTMLImageElement */ (document.getElementById('notification_icon'));
			if(options.hasOwnProperty('icon')) {
				notification_icon.src = options.icon;
				notification_icon.style.display = 'block';
			}
			else {
				notification_icon.style.display = 'none';
			}
			//update title
			const notification_title = document.getElementById('notification_title');
			notification_title.textContent = message;
			//update body
			const notification_body = document.getElementById('notification_body');
			if(options.hasOwnProperty('body')) {
				notification_body.textContent = options.body;
				notification_body.style.display = 'block';
			}
			else {
				notification_body.style.display = 'none';
			}

			//manage display of animation
			const notification = document.getElementById('notification');
			if(notification_timeout) {
				clearTimeout(notification_timeout);
			}
			//update notification
			notification.classList.remove('fadeout');
			notification.style.display = 'block';
			//add class that will start animation
			notification_timeout = setTimeout(function() {
				notification.classList.add('fadeout');
			}, notification_close_time);
		}
	};
})();

export {UI};
