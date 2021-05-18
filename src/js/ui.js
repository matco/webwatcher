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

(function() {
	const modals = [];

	//close modal with click outside modal
	function click_close_modal(event) {
		const modal = modals.last();
		if(!modal.locked && !modal.contains(event.target)) {
			UI.CloseModal(modal);
		}
	}

	//close modal windows with escape key
	function escape_close_modal(event) {
		const modal = modals.last();
		if(!modal.locked && event.keyCode === 27) {
			UI.CloseModal(modal);
		}
	}

	UI.OpenModal = function(element, locked) {
		//store locking status
		element.locked = locked || false;

		//add new modal to list
		modals.push(element);

		const overlay = document.getElementById('modal_overlay');

		//show overlay if this is first modal open
		if(modals.length === 1) {
			overlay.style.display = 'block';
		}

		//put modal window just over overlay
		const index = parseInt(overlay.style.zIndex) || 100;
		overlay.style.zIndex = index + 2;
		element.style.zIndex = index + 3;
		element.style.display = 'flex';

		//add document listeners for first modal
		if(modals.length === 1) {
			document.addEventListener('click', click_close_modal);
			document.addEventListener('keydown', escape_close_modal);
		}
	};

	UI.CloseModal = function(element) {
		//retrieve modal
		const modal = element || modals.last();
		if(modal) {
			//hide modal window
			modal.style.display = 'none';

			const overlay = document.getElementById('modal_overlay');

			//remove document listener for last modal
			if(modals.length === 1) {
				document.removeEventListener('click', click_close_modal);
				document.removeEventListener('keydown', escape_close_modal);
			}

			//put overlay just under modal window
			const index = parseInt(overlay.style.zIndex);
			overlay.style.zIndex = index - 2;

			if(modals.length === 1) {
				//remove overlay if this is last open modal
				overlay.style.display = 'none';
			}

			//remove modal from list
			modals.removeElement(modal);
		}
	};

	UI.CloseModals = function() {
		modals.slice().forEach(UI.CloseModal);
	};

	UI.IsModalOpen = function() {
		return !modals.isEmpty();
	};
})();

UI.Validate = function(message, yes_callback, no_callback, context, yes_text, no_text) {
	const validate_window = document.getElementById('validate');
	document.getElementById('validate_message').textContent = message;
	//manage buttons
	const validate_buttons = document.getElementById('validate_buttons');
	validate_buttons.empty();
	const no_button = document.createFullElement(
		'button',
		{type: 'button'},
		no_text || 'No',
		{
			click: function(event) {
				event.stop();
				if(no_callback) {
					no_callback.call(context || this);
				}
				UI.CloseModal(validate_window);
			}
		}
	);
	const yes_button = document.createFullElement(
		'button',
		{type: 'button', style: 'margin-left: 5px;', autofocus: true},
		yes_text || 'Yes',
		{
			click: function(event) {
				event.stop();
				if(yes_callback) {
					yes_callback.call(context || this);
				}
				UI.CloseModal(validate_window);
			}
		}
	);
	validate_buttons.appendChild(no_button);
	validate_buttons.appendChild(yes_button);

	//yes_button.focus();
	UI.OpenModal(validate_window, true);
};

export {UI};
