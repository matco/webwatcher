'use strict';

var UI = {};

UI.Info = function(message, locked) {
	document.getElementById('info_message').textContent = message;
	UI.OpenModal(document.getElementById('info'), locked);
};

UI.StartLoading = function() {
	document.body.classList.add('loading');
	document.getElementById('loading').style.display = 'block';
};

UI.StopLoading = function() {
	document.body.classList.remove('loading');
	document.getElementById('loading').style.display = 'none';
};

(function() {
	var notification_close_time = 5000;
	var notification_timeout;

	window.addEventListener('load', function() {
		function hide_after_animation() {
			this.style.display = 'none';
		}
		var notification = document.getElementById('notification');
		//TODO clean this when all browsers support good event
		notification.addEventListener('animationend', hide_after_animation);
		notification.addEventListener('webkitAnimationEnd', hide_after_animation);
		notification.addEventListener('oanimationend', hide_after_animation);
	});

	//remember if notification permission has been requested to avoid asking to the user more than once
	var notification_permission_requested = false;

	UI.Notify = function(message, options) {
		//ask for permission if user has not explicitly denied nor granted notification (permission can be default or undefined)
		if(!['granted', 'denied'].contains(Notification.permission) && !notification_permission_requested) {
			notification_permission_requested = true;
			Notification.requestPermission(function(status) {
				//re-notify
				UI.Notify(message, options);
			});
		}
		//use native notification
		else if(Notification.permission === 'granted') {
			var notification = new Notification(message, options);
			notification.addEventListener('show', function() {
				setTimeout(function() {
					notification.close();
				}, notification_close_time);
			});
		}
		//fallback on html notification
		else {
			//update icon
			var notification_icon = document.getElementById('notification_icon');
			if(options.hasOwnProperty('icon')) {
				notification_icon.src = options.icon;
				notification_icon.style.display = 'block';
			}
			else {
				notification_icon.style.display = 'none';
			}
			//update title
			var notification_title = document.getElementById('notification_title');
			notification_title.textContent = message;
			//update body
			var notification_body = document.getElementById('notification_body');
			if(options.hasOwnProperty('body')) {
				notification_body.textContent = options.body;
				notification_body.style.display = 'block';
			}
			else {
				notification_body.style.display = 'none';
			}

			//manage display of animation
			var notification = document.getElementById('notification');
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
	var modals = [];

	//close modal with click outside modal
	function click_close_modal(event) {
		var modal = modals.last();
		if(!modal.locked && !modal.contains(event.target)) {
			UI.CloseModal(modal);
		}
	}

	//close modal windows with escape key
	function escape_close_modal(event) {
		var modal = modals.last();
		if(!modal.locked && event.keyCode === 27) {
			UI.CloseModal(modal);
		}
	}

	UI.OpenModal = function(element, locked) {
		//store locking status
		element.locked = locked || false;

		//add new modal to list
		modals.push(element);

		var overlay = document.getElementById('modal_overlay');

		//show overlay if this is first modal open
		if(modals.length === 1) {
			overlay.style.display = 'block';
		}

		//put modal window just over overlay
		var index = parseInt(overlay.style.zIndex) || 100;
		overlay.style.zIndex = index + 2;
		element.style.zIndex = index + 3;
		element.style.display = 'block';

		//add document listeners for first modal
		if(modals.length === 1) {
			document.addEventListener('click', click_close_modal);
			document.addEventListener('keydown', escape_close_modal);
		}
	};

	UI.CloseModal = function(element) {
		//retrieve modal
		var modal = element || modals.last();
		if(modal) {
			//hide modal window
			modal.style.display = 'none';

			var overlay = document.getElementById('modal_overlay');

			//remove document listener for last modal
			if(modals.length === 1) {
				document.removeEventListener('click', click_close_modal);
				document.removeEventListener('keydown', escape_close_modal);
			}

			//put overlay just under modal window
			var index = parseInt(overlay.style.zIndex);
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

(function() {
	//show tab associated content and hide other contents
	function select_tab() {
		if(!this.classList.contains('disabled')) {
			this.parentNode.children.forEach(function(tab) {
				if(tab === this) {
					tab.classList.add('selected');
					document.getElementById(tab.dataset.tab).style.display = 'block';
				}
				else {
					tab.classList.remove('selected');
					document.getElementById(tab.dataset.tab).style.display = 'none';
				}
			}, this);
		}
	}

	UI.Tabify = function(container) {
		container.children.forEach(function(tab) {
			document.getElementById(tab.dataset.tab).style.display = tab.classList.contains('selected') ? 'block' : 'none';
			tab.addEventListener('click', select_tab);
		});
	};
})();

UI.Validate = function(message, yes_callback, no_callback, context, yes_text, no_text) {
	var validate_window = document.getElementById('validate');
	document.getElementById('validate_message').textContent = message;
	//manage buttons
	var validate_buttons = document.getElementById('validate_buttons');
	validate_buttons.clear();
	var no_button = document.createFullElement(
		'button',
		{type : 'button'},
		no_text || 'No',
		{
			click : function(event) {
				Event.stop(event);
				if(no_callback) {
					no_callback.call(context || this);
				}
				UI.CloseModal(validate_window);
			}
		}
	);
	var yes_button = document.createFullElement(
		'button',
		{type : 'button', style : 'margin-left: 5px;', autofocus : true},
		yes_text || 'Yes',
		{
			click : function(event) {
				Event.stop(event);
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

//delay task to let browser time to repaint
UI.Delay = function(callback) {
	setTimeout(callback, 50);
};