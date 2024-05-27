const notification_close_time = 5000;
let notification_timeout;

//remember if notification permission has been requested to avoid asking to the user more than once
let notification_permission_requested = false;

export const UI = {
	Notify: function(message, options) {
		//ask for permission if user has not explicitly denied nor granted notification (permission can be default or undefined)
		if(!['granted', 'denied'].includes(Notification.permission) && !notification_permission_requested) {
			notification_permission_requested = true;
			Notification.requestPermission(() => {
				//re-notify
				UI.Notify(message, options);
			});
		}
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
				notification_timeout = setTimeout(() => notification.close(), notification_close_time);
			});
		}
	}
};
