export class Restify {
	constructor(url) {
		this.url = url;
	}

	list() {
		return fetch(this.url).then(r => r.json());
	}
	get(pk) {
		return fetch(`${this.url}/${pk}`).then(r => r.json());
	}
	save(object) {
		const options = {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(object)
		};
		return fetch(`${this.url}/${object.pk}`, options).then(r => r.json());
	}
	add(object) {
		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(object)
		};
		return fetch(this.url, options).then(r => r.json());
	}
	delete(pk) {
		const options = {
			method: 'DELETE',
		};
		return fetch(`${this.url}/${pk}`, options).then(r => r.json());
	}
}
