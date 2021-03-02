/*global Grid*/

import {Authentication} from './authentication.js';
import {UI} from './ui.js';

let websites_service;
let selected_website_id;

//status
let states_grid;

const states_columns = [
	{label: 'Name', data: 'name', type: Grid.DataType.STRING, width: 120, render: render_name},
	{label: 'Last check', data: 'update', type: Grid.DataType.DATE, width: 150, render: render_date},
	{label: 'Downtime', data: 'downtime', type: Grid.DataType.NUMBER, width: 250, render: render_time},
	{label: 'Uptime', data: 'uptime', type: Grid.DataType.NUMBER, width: 250, render: render_time},
	{label: 'Availability', data: 'availability', type: Grid.DataType.NUMBER, width: 80, render: render_online},
	{label: 'Actions', width: 100, unsortable: true, render: render_actions}
];

function render_date(value) {
	return value ? value.toFullDisplay() : 'NA';
}

function render_name(value, record) {
	let title;
	if(record.disabled) {
		title = 'Disabled';
	}
	else {
		title = record.online === null ? 'Not checked yet' : record.online ? 'Online' : 'Offline';
	}
	return document.createFullElement('span', {title: title}, value);
}

function render_time(value, record) {
	return value ? Date.getDurationLiteral(value) : record.online ? '0' : 'NA';
}

function render_online(value) {
	return value ? `${value}%` : 'NA';
}

function render_actions(value, record) {
	if(Authentication.IsAuthenticated()) {
		return document.createFullElement('a', {href: `#section=status&details=${record.name}`, title: 'View website details'}, 'Details');
	}
	return document.createElement('span');
}

function draw_websites(websites) {
	//calculate availability for each website
	websites.forEach(function(website) {
		let availability;
		if(website.uptime || website.downtime) {
			availability = website.uptime / (website.downtime + website.uptime) * 100;
			availability = Math.round(availability * 10) / 10;
		}
		website.availability = availability;
	});
	//update states grid
	states_grid.render(new Grid.Datasource({data: websites}));
}

//details
let details_grid;

const details_columns = [
	{label: 'Start', data: 'start', type: Grid.DataType.DATE, width: 150, render: render_date},
	{label: 'Stop', data: 'stop', type: Grid.DataType.DATE, width: 150, render: render_date},
	{label: 'Duration', data: 'duration', type: Grid.DataType.NUMBER, width: 200, render: render_duration},
	{label: 'Rationale', data: 'rationale', type: Grid.DataType.STRING},
	{label: 'Action', width: 100, unsortable: true, render: render_details_action}
];

function render_duration(value) {
	return value ? Date.getDurationLiteral(value) : 'NA';
}

function render_details_action(value, record) {
	const element = document.createFullElement(
		'a',
		{href: '#', title: 'Delete downtime'},
		'Delete',
		{
			click: function(event) {
				Event.stop(event);
				const xhr = new XMLHttpRequest();
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
				xhr.open('DELETE', `/api/websites/${selected_website_id}/downtimes/${record.id}`, true);
				xhr.send();
			}
		}
	);
	return element;
}

function update_website_details_age(date) {
	let age;
	if(date) {
		age = `Last checked ${date.getAgeLiteral()}`;
	}
	else {
		age = 'Not checked yet';
	}
	document.getElementById('website_details_age').textContent = age;
}

export const Status = {
	Show: function update_states() {
		websites_service.list(draw_websites);
	},
	Detail: function(website_id) {
		selected_website_id = website_id;
		const xhr = new XMLHttpRequest();
		xhr.addEventListener(
			'load',
			function(event) {
				const details = JSON.parse(event.target.responseText);
				//update link
				const website_details_link = document.getElementById('website_details_link');
				website_details_link.setAttribute('href', details.url);
				website_details_link.textContent = details.name;
				//update age
				update_website_details_age(details.update ? new Date(details.update) : undefined);
				//update check link
				const website_details_check = document.getElementById('website_details_check');
				website_details_check.clear();
				website_details_check.appendChild(document.createFullElement(
					'button',
					{},
					'Check now',
					{
						click: function(event) {
							Event.stop(event);
							const that = this;
							this.setAttribute('disabled', 'disabled');
							this.classList.add('loading');
							const xhr = new XMLHttpRequest();
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
							xhr.open('GET', `/api/check/${details.name}`, true);
							xhr.send();
						}
					}
				));
			}
		);
		xhr.open('GET', `/api/websites/${website_id}`, true);
		xhr.send();

		//prepare grid with custom export link
		details_grid = new Grid({
			container: document.getElementById('website_details_downtimes'),
			columns: details_columns,
			path: '/js/grid/',
			rowPerPage: 10,
			actions: [
				{label: 'Export', url: `/api/websites/${website_id}/downtimes`}
			]
		});
		const downtimes_xhr = new XMLHttpRequest();
		downtimes_xhr.addEventListener(
			'load',
			function(event) {
				const downtimes = JSON.parse(event.target.responseText);
				//calculate duration for each downtime
				downtimes.forEach(function(downtime) {
					let duration;
					if(downtime.start && downtime.stop) {
						//TODO improve this as grid does the same job
						duration = Math.round((new Date(downtime.stop).getTime() - new Date(downtime.start).getTime()) / 1000);
					}
					downtime.duration = duration;
				});
				//update downtimes grid
				details_grid.render(new Grid.Datasource({data: downtimes}));
			}
		);
		downtimes_xhr.open('GET', `/api/websites/${website_id}/downtimes`, true);
		downtimes_xhr.setRequestHeader('Accept', 'application/json');
		downtimes_xhr.send();
		UI.OpenModal(document.getElementById('website_details'), true);
	},
	Init: function(Websites) {
		websites_service = Websites;

		//status
		states_grid = new Grid({
			container: document.getElementById('states'),
			columns: states_columns,
			path: '/js/grid/',
			rowPerPage: undefined,
			rowClass: function(record) {
				if(record.disabled) {
					return 'disabled';
				}
				return record.online === null ? 'unchecked' : record.online ? 'online' : 'offline';
			}
		});

		document.getElementById('status_check_now').addEventListener(
			'click',
			function(event) {
				Event.stop(event);
				const that = this;
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');
				const xhr = new XMLHttpRequest();
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
	}
};
