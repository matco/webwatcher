'use strict';

var Status = (function() {
	var websites_service;
	var selected_website_id;

	//status
	var states_grid;

	var states_columns = [
		{label : 'Name', data: 'name', type : Grid.DataType.STRING, width : 120, render : render_name},
		{label : 'Last check', data: 'update', type : Grid.DataType.DATE, width : 150, render : render_date},
		{label : 'Downtime', data : 'downtime', type : Grid.DataType.NUMBER, width : 250, render : render_time},
		{label : 'Uptime', data : 'uptime', type : Grid.DataType.NUMBER, width : 250, render : render_time},
		{label : 'Availability', data : 'availability', type : Grid.DataType.NUMBER, width : 80, render : render_online},
		{label : 'Actions', width : 100, unsortable : true, render : render_actions}
	];

	function render_date(value) {
		return value ? value.toFullDisplay() : 'NA';
	}

	function render_name(value, record) {
		var element = document.createFullElement('span');
		if(record.disabled) {
			element.appendChild(document.createFullElement('img', {src : '/images/bullet_black.png', alt : 'Disabled', title : 'Disabled', style : 'vertical-align: bottom;'}));
		}
		element.appendChild(document.createTextNode(value));
		return element;
	}

	function render_time(value, record) {
		return value ? Date.getDurationLiteral(value) : record.online ? '0' : 'NA';
	}

	function render_online(value) {
		return value ? value + '%' : 'NA';
	}

	function render_actions(value, record) {
		return document.createFullElement('a', {href : '#section=status&details=' + record.name, title : 'View website details'}, 'Details');
	}

	function draw_websites(websites) {
		//calculate availability for each website
		websites.forEach(function(website) {
			var availability;
			if(website.uptime || website.downtime) {
				availability = website.uptime / (website.downtime + website.uptime) * 100;
				availability = Math.round(availability * 10) / 10;
			}
			website.availability = availability;
		});
		//update states grid
		states_grid.render(new Grid.Datasource({data : websites}));
	}

	//details
	var details_grid;

	var details_columns = [
		{label : 'Start', data: 'start', type : Grid.DataType.DATE, width : 150, render : render_date},
		{label : 'Stop', data: 'stop', type : Grid.DataType.DATE, width : 150, render : render_date},
		{label : 'Duration', data: 'duration', type : Grid.DataType.NUMBER, width : 200, render : render_duration},
		{label : 'Rationale', data : 'rationale', type : Grid.DataType.STRING},
		{label : 'Action', width : 100, unsortable : true, render : render_details_action}
	];

	function render_duration(value) {
		return value ? Date.getDurationLiteral(value) : 'NA';
	}

	function render_details_action(value, record) {
		if(Authentication.IsAuthenticated()) {
			var element = document.createFullElement(
				'a',
				{href : '#', title : 'Delete downtime'},
				'Delete',
				{
					click : function(event) {
						Event.stop(event);
						var xhr = new XMLHttpRequest();
						xhr.addEventListener(
							'load',
							function(xhr_event) {
								if(xhr_event.target.status === 200) {
									details_grid.datasource.data.removeElement(record);
									details_grid.render(details_grid.datasource);
									UI.Notify('Downtime has been deleted successfully');
								}
								else {
									UI.Notify('Unable to delete downtime');
								}
							}
						);
						xhr.open('DELETE', '/api/website/' + selected_website_id + '/downtime/' + record.id, true);
						xhr.send();
					}
				}
			);
			return element;
		}
		return document.createElement('span');
	}

	function update_website_details_age(date) {
		var age;
		if(date) {
			age = 'Last checked ' + date.getAgeLiteral();
		}
		else {
			age = 'Not checked yet';
		}
		document.getElementById('website_details_age').textContent = age;
	}

	return {
		Show : function update_states() {
			websites_service.list(draw_websites);
		},
		Detail : function(key) {
			selected_website_id = key;
			var xhr = new XMLHttpRequest();
			xhr.addEventListener(
				'load',
				function(event) {
					var details = JSON.parse(event.target.responseText);
					//update link
					var website_details_link = document.getElementById('website_details_link');
					website_details_link.setAttribute('href', details.url);
					website_details_link.textContent = details.name;
					//update age
					update_website_details_age(details.update ? new Date(details.update) : undefined);
					//update check link
					var website_details_check = document.getElementById('website_details_check');
					website_details_check.clear();
					website_details_check.appendChild(document.createFullElement(
						'button',
						{},
						'Check now',
						{
							click : function(event) {
								Event.stop(event);
								var that = this;
								this.setAttribute('disabled', 'disabled');
								this.classList.add('loading');
								var xhr = new XMLHttpRequest();
								xhr.addEventListener(
									'load',
									function(xhr_event) {
										that.removeAttribute('disabled');
										that.classList.remove('loading');
										if(xhr_event.target.status === 200) {
											update_website_details_age(new Date());
											UI.Notify('Website has been checked successfully');
										}
										else {
											UI.Notify('Unable to check website');
										}
									}
								);
								xhr.open('GET', '/api/check/' + details.name, true);
								xhr.send();
							}
						}
					));
					//calculate duration for each downtime
					details.downtimes.forEach(function(downtime) {
						var duration;
						if(downtime.start && downtime.stop) {
							//TODO improve this as grid does the same job
							duration = Math.round((new Date(downtime.stop).getTime() - new Date(downtime.start).getTime()) / 1000);
						}
						downtime.duration = duration;
					});
					//update downtimes grid
					details_grid.render(new Grid.Datasource({data : details.downtimes}));
				}
			);
			xhr.open('GET', '/api/website/' + key + '/details', true);
			xhr.send();
			UI.OpenModal(document.getElementById('website_details'));
		},
		Init : function(Websites) {
			websites_service = Websites;

			//status
			states_grid = new Grid({
				container : document.getElementById('states'),
				columns : states_columns,
				path : '/js/grid/',
				rowPerPage : undefined,
				rowClass : function(record) {
					return record.online === null ? 'na' : record.online ? 'ok' : 'nok';
				}
			});

			document.getElementById('status_check_now').addEventListener(
				'click',
				function(event) {
					Event.stop(event);
					var that = this;
					this.setAttribute('disabled', 'disabled');
					this.classList.add('loading');
					var xhr = new XMLHttpRequest();
					xhr.addEventListener(
						'load',
						function(xhr_event) {
							that.removeAttribute('disabled');
							that.classList.remove('loading');
							if(xhr_event.target.status === 200) {
								//TODO improve this as only enabled websites are checked
								draw_websites(JSON.parse(xhr_event.target.responseText));
								UI.Notify('Websites have been checked successfully');
							}
							else {
								UI.Notify('Unable to check websites');
							}
						}
					);
					xhr.open('GET', '/api/check', true);
					xhr.send();
				}
			);

			//details
			details_grid = new Grid({
				container : document.getElementById('website_details_downtimes'),
				columns : details_columns,
				path : '/js/grid/',
				rowPerPage : 10
			});
		}
	};
})();
