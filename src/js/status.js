import {Authentication} from './authentication.js';
import {UI} from './ui.js';
import {Table, Datasource} from '@matco/basic-table';
import {Websites} from './services.js';

let selected_website_pk;
let states_grid;
let details_grid;

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

function render_actions(_, record) {
	if(Authentication.GetStatus().authenticated) {
		return document.createFullElement('a', {href: `#page=status&details=${record.pk}`, title: 'View website details'}, 'Details');
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
	states_grid.render(new Datasource({data: websites}));
}

function render_duration(value) {
	return value ? Date.getDurationLiteral(value) : 'NA';
}

function render_details_action(value, record) {
	const element = document.createFullElement(
		'button',
		{class: 'text', title: 'Delete downtime'},
		'Delete',
		{
			click: async function(event) {
				event.stop();

				const options = {
					method: 'DELETE',
				};
				const response = await fetch(`/api/websites/${selected_website_pk}/downtimes/${record.pk}`, options);
				if(response.status === 200) {
					details_grid.datasource.data.removeElement(record);
					details_grid.render(details_grid.datasource);
					UI.Notify('Downtime has been deleted successfully');
				}
				else {
					UI.Notify('Unable to delete downtime');
				}
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
		Websites.list().then(draw_websites);
	},
	Detail: async function(website_pk) {
		selected_website_pk = website_pk;

		const response = await fetch(`/api/websites/${website_pk}`);
		const details = await response.json();
		//update link
		const website_details_link = document.getElementById('website_details_link');
		website_details_link.setAttribute('href', details.url);
		website_details_link.textContent = details.name;
		//update age
		update_website_details_age(details.update ? new Date(details.update) : undefined);
		//update check link
		document.getElementById('website_details_check').dataset.websiteId = website_pk;

		//prepare grid with custom export link
		const action = {label: 'Export', url: `/api/websites/${website_pk}/downtimes`};
		details_grid.setActions([action]);

		const downtimes_response = await fetch(`/api/websites/${website_pk}/downtimes`, {headers: {'Accept': 'application/json'}});
		const downtimes = await downtimes_response.json();
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
		details_grid.render(new Datasource({data: downtimes}));
		UI.OpenModal(document.getElementById('website_details'), true);
	},
	Init: function() {
		states_grid = new Table({
			container: document.getElementById('states'),
			columns: [
				{label: 'Name', data: 'name', type: Table.DataType.STRING, width: 120, render: render_name},
				{label: 'Last check', data: 'update', type: Table.DataType.DATE, width: 150, render: render_date},
				{label: 'Downtime', data: 'downtime', type: Table.DataType.NUMBER, width: 250, render: render_time},
				{label: 'Uptime', data: 'uptime', type: Table.DataType.NUMBER, width: 250, render: render_time},
				{label: 'Availability', data: 'availability', type: Table.DataType.NUMBER, width: 80, render: render_online},
				{label: 'Actions', width: 100, unsortable: true, render: render_actions}
			],
			rowPerPage: undefined,
			rowClass: function(record) {
				if(record.disabled) {
					return 'disabled';
				}
				return !record.update ? 'unchecked' : record.online ? 'online' : 'offline';
			}
		});

		details_grid = new Table({
			container: document.getElementById('website_details_downtimes'),
			columns: [
				{label: 'Start', data: 'start', type: Table.DataType.DATE, width: 150, render: render_date},
				{label: 'Stop', data: 'stop', type: Table.DataType.DATE, width: 150, render: render_date},
				{label: 'Duration', data: 'duration', type: Table.DataType.NUMBER, width: 200, render: render_duration},
				{label: 'Rationale', data: 'rationale', type: Table.DataType.STRING},
				{label: 'Action', width: 100, unsortable: true, render: render_details_action}
			],
			rowPerPage: 10
		});

		document.getElementById('status_check_now').addEventListener(
			'click',
			async function(event) {
				event.stop();
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');

				const response = await fetch('/api/check');
				this.removeAttribute('disabled');
				this.classList.remove('loading');
				if(response.status === 200) {
					const websites = await response.json();
					//TODO improve this as only enabled websites are checked
					draw_websites(websites);
					UI.Notify('Websites have been checked successfully');
				}
				else {
					UI.Notify('Unable to check websites');
				}
			}
		);

		document.getElementById('website_details_check').addEventListener(
			'click',
			async function() {
				this.setAttribute('disabled', 'disabled');
				this.classList.add('loading');
				const response = await fetch(`/api/check/${this.dataset.websiteId}`);
				this.removeAttribute('disabled');
				this.classList.remove('loading');
				if(response.status === 200) {
					update_website_details_age(new Date());
					UI.Notify('Website has been checked successfully');
				}
				else {
					UI.Notify('Unable to check website');
				}
			}
		);
	}
};
