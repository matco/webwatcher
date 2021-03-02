const Hash = {
	Encode: function(object) {
		let hash = '';
		for(const key in object) {
			if(object.hasOwnProperty(key)) {
				if(hash) {
					hash += '&';
				}
				hash += (`${key}=${object[key]}`);
			}
		}
		return `#${hash}`;
	},
	Decode: function(hash) {
		//remove front dash
		const hash_content = hash.substring(1);
		//transform hash to an object
		const parameters = hash_content.split('&');
		let parameter;
		const data = {};
		for(let i = 0; i < parameters.length; i++) {
			parameter = parameters[i].split('=');
			data[parameter[0]] = parameter.length > 1 ? parameter[1] : true;
		}
		return data;
	}
};
