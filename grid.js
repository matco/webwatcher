'use strict';

function Grid(parameters) {
	//required parameters
	this.container;
	this.columns;
	this.datasource;
	this.path;
	//optional parameters with default value
	this.id;
	this.title;
	this.actions = [];
	this.statusText = 'Display items ${start} - ${stop} of ${total}';
	this.rowPerPage = 10;
	this.rowClass;
	this.enableSearch = true;
	this.allowMissingData = false;
	//events
	this.afterRender;

	//bind parameters
	for(var parameter in parameters) {
		this[parameter] = parameters[parameter];
	}

	//internal variables
	this.start = 0;

	//try to identify grid
	if(!this.id) {
		this.id = this.container.id;
	}

	//check required parameters
	if(!this.container || !this.columns) {
		throw new Error('Following parameters are required : container and columns');
	}

	//check columns
	for(var i = 0; i < this.columns.length; i++) {
		var column = this.columns[i];
		if(!column.data && !column.render || !column.label) {
			throw new Error('Column ' + i + ' is incomplete (must have data or render, and label)');
		}
		if(!column.unsortable && (!column.data || !column.type)) {
			throw new Error('Column ' + column.label + ' must have data or type to be sortable or be set as unsortable');
		}
	}

	var that = this;

	//header
	this.header = document.createFullElement('div', {'class' : 'grid_header'});
	if(this.title) {
		this.header.appendChild(document.createFullElement('h2', {}, this.title));
	}

	//table
	this.table = document.createFullElement('table', {'class' : 'grid_content'});

	//table header
	this.head = document.createElement('thead');
	var header_line = document.createFullElement('tr', {style : 'height: 21px;'});
	this.head.appendChild(header_line);

	for(var i = 0; i < this.columns.length; i++) {
		var column = this.columns[i];
		var header_column = document.createFullElement('th', {style : 'width: ' + column.width + 'px;'});
		//create or use label
		var header_label = String.isString(column.label) ? document.createTextNode(column.label) : column.label;
		header_column.appendChild(header_label);
		if(!column.unsortable) {
			header_column.style.cursor = 'pointer';
			header_column.addEventListener(
				'click',
				(function(field) {
					return function(event) {
						var previous_sort_order = that.datasource.sortingOrders[0];
						that.addOrdering(field, !previous_sort_order.descendant);
					};
				})(column.data)
			);
			header_column.appendChild(document.createFullElement('img', {src : this.path + 'bullet_arrow_up.png', style : 'display : none;'}));
		}
		header_line.appendChild(header_column);
	}
	this.table.appendChild(this.head);

	//table body
	this.body = document.createFullElement('tbody');
	this.table.appendChild(this.body);

	//footer
	this.footer = document.createFullElement('div', {'class' : 'grid_footer'});

	var search_bar = document.createFullElement('div', {'class' : 'grid_footer_search'});
	this.footer.appendChild(search_bar);

	/*this.refreshButton = document.createFullElement('a');
	this.refreshButton.appendChild(document.createFullElement('img', {'src' : this.path + 'arrow_refresh.png'}));
	this.footer.appendChild(this.refreshButton);*/

	if(this.enableSearch) {
		var search_form = document.createFullElement('form', {style : 'float: left;'});
		var search_label = document.createFullElement('label', {}, 'Filter');
		this.search_input = document.createFullElement('input', {type : 'search', style : 'margin-left: 10px; margin-right: 10px;'});
		//scan search input
		var last_filter = '';
		setInterval(function() {
			if(last_filter !== that.search_input.value) {
				last_filter = that.search_input.value;
				that.filter(last_filter);
			}
		}, 300);
		search_label.appendChild(this.search_input);
		search_form.appendChild(search_label);
		search_bar.appendChild(search_form);
	}

	this.loading = document.createFullElement('img', {src : this.path + 'loading.png'});
	search_bar.appendChild(this.loading);

	this.buttons = document.createFullElement('div', {'class' : 'grid_footer_buttons'});
	this.footer.appendChild(this.buttons);

	this.setActions(this.actions);

	if(this.rowPerPage) {
		//info
		this.info = document.createFullElement('div', {'class' : 'grid_footer_info'});
		this.status = document.createFullElement('span', {style : 'margin-left: 5px;'});
		this.info.appendChild(this.status);
		this.footer.appendChild(this.info);

		//controls
		this.controls = document.createFullElement('div', {'class' : 'grid_footer_controls'});
		this.footer.appendChild(this.controls);

		//first
		this.firstButton = document.createFullElement('a', {href : '#', title : 'First', alt : 'First', 'class' : 'control_first'}, undefined,
			{
				'click' : function(event) {
					Event.stop(event);
					if(that.start !== 0) {
						that.start = 0;
						that.draw();
					}
				}
			});
		this.controls.appendChild(this.firstButton);

		//previous
		this.previousButton = document.createFullElement('a', {href : '#', title : 'Previous', alt : 'Previous', 'class' : 'control_previous'}, undefined,
			{
				'click' : function(event) {
					Event.stop(event);
					if(that.start > 1) {
						that.start -= that.rowPerPage;
						that.draw();
					}
				}
			});
		this.controls.appendChild(this.previousButton);

		//next
		this.nextButton = document.createFullElement('a', {href : '#', title : 'Next', alt : 'Next', 'class' : 'control_next'}, undefined,
			{
				'click' : function(event) {
					Event.stop(event);
					if(that.start + that.rowPerPage < that.datasource.getLength()) {
						that.start += that.rowPerPage;
						that.draw();
					}
				}
			});
		this.controls.appendChild(this.nextButton);

		//last
		this.lastButton = document.createFullElement('a', {href : '#', title : 'Last', alt : 'Last', 'class' : 'control_last'}, undefined,
			{
				'click' : function(event) {
					Event.stop(event);
					var last_start = (Math.ceil(that.datasource.length / that.rowPerPage) - 1) * that.rowPerPage;
					if(that.start !== last_start) {
						that.start = last_start;
						that.draw();
					}
				}
			});
		this.controls.appendChild(this.lastButton);
	}

	//insertion
	this.container.clear();
	this.container.appendChild(this.header);
	this.container.appendChild(this.table);
	this.container.appendChild(this.footer);
	//display footer only if there is something in it
	this.footer.style.display = this.enableSearch || this.rowPerPage || !this.actions.isEmpty() ? 'block' : 'none';
}

Grid.prototype.setActions = function(actions) {
	this.actions = actions;
	this.buttons.clear();
	for(var i = 0; i < this.actions.length; i++) {
		var action = this.actions[i];
		var action_item;
		if(String.isString(action.label)) {
			action_item = document.createFullElement('a', {href : action.url, 'class' : 'button'}, action.label);
		}
		else {
			action_item = action.label;
		}
		this.buttons.appendChild(action_item);
	}
	//display footer only if there is something in it
	this.footer.style.display = this.enableSearch || this.rowPerPage || !this.actions.isEmpty() ? 'block' : 'none';
};

(function() {
	function resort(grid) {
		grid.start = 0;
		grid.draw();
		var sorting_order = grid.datasource.sortingOrders[0];
		//update sort image
		var i, column;
		for(i = 0; i < grid.columns.length; i++) {
			column = grid.columns[i];
			//only columns with data are sortable
			if(column.data && !column.unsortable) {
				var header_column = grid.head.firstChild.childNodes[i];
				if(column.data === sorting_order.field) {
					header_column.lastChild.style.display = 'inline';
					header_column.lastChild.src = grid.path + (sorting_order.descendant ? 'bullet_arrow_down.png' : 'bullet_arrow_up.png');
				}
				else {
					header_column.lastChild.style.display = 'none';
				}
			}
		}
	}

	Grid.prototype.setOrdering = function(field, descendant) {
		this.datasource.sortingOrders = [{field : field, descendant : descendant}];
		resort(this);
	};

	Grid.prototype.addOrdering = function(field, descendant) {
		//remove any ordering if it already exists
		this.datasource.sortingOrders = this.datasource.sortingOrders.filter(Array.objectFilter({field : field}).negatize());
		//add new sort order
		this.datasource.sortingOrders.unshift({field : field, descendant : descendant});
		//no need to sort on more than three columns
		if(this.datasource.sortingOrders.length > 3) {
			this.datasource.sortingOrders.pop();
		}
		resort(this);
	};
})();

(function() {
	function data_filter(filter) {
		this.loading.style.display = 'inline';
		this.datasource.filter(filter);
		this.start = 0;
		this.draw();
		this.loading.style.display = 'none';
	}

	Grid.prototype.filter = function(filter, filter_column, exact_matching) {
		var that = this;
		data_filter.call(this, function(record) {
			for(var i = 0; i < that.columns.length; i++) {
				var column = that.columns[i];
				//filter only on one column if asked
				if(!filter_column || filter_column && column.data === filter_column.data) {
					//var value = column.render ? record[i].rendered : record[i].raw;
					var value = record[column.data];
					if(typeof value === 'string') {
						if(exact_matching && value === filter || value.nocaseIncludes(filter)) {
							return true;
						}
					}
					else if(typeof value === 'object') {
						//this does not work anymore
						if(exact_matching && value.innerHTML === filter || value.innerHTML.nocaseIncludes(filter)) {
							return true;
						}
					}
				}
			}
			return false;
		});
	};

	Grid.prototype.filterFunction = function(filter) {
		data_filter.call(this, function(record) {
			return filter(record);
		});
	};
})();

Grid.prototype.unfilter = function() {
	this.loading.style.display = 'inline';
	this.datasource.unfilter();
	this.start = 0;
	this.draw();
	this.loading.style.display = 'none';
};

Grid.prototype.render = function(datasource) {
	this.loading.style.display = 'inline';

	//keep a handle on datasource
	this.datasource = datasource;

	//datasource is required and must be a grid datasource
	if(!this.datasource || this.datasource.constructor !== Grid.Datasource) {
		throw new Error('A datasource is required to render the grid');
	}

	//search can not be enabled for lazy datasource
	if(this.datasource && this.datasource.lazy) {
		if(this.enableSearch) {
			throw new Error('Search can not be enabled for lazy datasource');
		}
	}

	//restore state
	var serialized_state = sessionStorage.getItem(this.id);
	if(serialized_state) {
		try {
			var state = JSON.parse(serialized_state);

			this.start = state.start;
			this.datasource.sortingOrders = state.datasource.sortingOrders;
			//remove now invalid columns from restored sorting columns
			this.datasource.sortingOrders = this.datasource.sortingOrders.filter(function(sorting_order) {
				var column = this.columns.find(Array.objectFilter({data : sorting_order.field}));
				return column && !column.unsortable;
			}, this);

			/*if(this.enableSearch && state.search) {
				this.search_input.value = state.search;
			}*/
		} catch(exception) {
			//unable to restore state
			console.error('Unable to restore state for grid ' + this.id);
		}
	}

	//set arbitrary sorting order if needed
	if(this.datasource.sortingOrders.isEmpty()) {
		//find first sortable column
		var column = this.columns.find(Array.objectFilter({unsortable : true}).negatize());
		//if there is a sortable column, add it in sorting orders
		if(column) {
			this.datasource.sortingOrders.push({field : column.data, descendant : false});
		}
	}

	//initialize datasource and render retrieved data if any
	var that = this;
	datasource.init(function() {

		//check start offset
		if(that.start > that.datasource.getLength()) {
			that.start = 0;
		}

		//update column ui
		var column_index = that.columns.indexOf(that.columns.find(Array.objectFilter({data : that.datasource.sortingOrders[0].field})));
		var header_column = that.head.childNodes[0].childNodes[column_index];
		header_column.lastChild.style.display = 'inline';
		header_column.lastChild.src = that.path + (that.datasource.sortingOrders[0].descendant ? 'bullet_arrow_down.png' : 'bullet_arrow_up.png');

		//data may already be available
		if(datasource.data) {
			var columns_length = that.columns.length;
			var i, j, column;

			//check data
			if(!that.allowMissingData) {
				for(i = 0; i < columns_length; i++) {
					column = that.columns[i];
					if(column.data) {
						for(j = 0; j < datasource.data.length; j++) {
							if(!datasource.data[j].hasOwnProperty(that.columns[i].data)) {
								throw new Error('Column ' + i + ' used data ' + that.columns[i].data + ' but this data does not exist in record ' + j);
							}
						}
					}
				}
			}

			//do search if needed
			if(that.enableSearch && that.search_input.value) {
				that.filter(that.search_input.value);
			}
		}

		//call callback
		if(that.afterRender) {
			that.afterRender.call(that);
		}

		try {
			that.draw();
			that.loading.style.display = 'none';
		} catch(exception) {
			throw new Error('Unable to draw grid : ' + exception);
		}
	});
};

Grid.prototype.draw = function() {
	//save state
	try {
		var state = {
			datasource : {
				sortingOrders : this.datasource.sortingOrders
			},
			start : this.start
		};
		if(this.enableSearch) {
			state.search = this.search_input.value;
		}
		sessionStorage.setItem(this.id, JSON.stringify(state));
	} catch(exception) {
		//unable to save state
		//console.error('Unable to save state : ' + exception.message);
	}

	//empty table
	while(this.body.firstChild) {
		this.body.removeChild(this.body.firstChild);
	}
	//manage pagination
	if(this.rowPerPage) {
		//check range
		if(this.start < 0) {
			this.start = 0;
		}
		//manage first and previous button
		if(this.start > 1) {
			this.previousButton.style.opacity = 1;
			this.previousButton.style.cursor = 'pointer';
			this.firstButton.style.opacity = 1;
			this.firstButton.style.cursor = 'pointer';
		}
		else {
			this.previousButton.style.opacity = 0.2;
			this.previousButton.style.cursor = 'auto';
			this.firstButton.style.opacity = 0.2;
			this.firstButton.style.cursor = 'auto';
		}
		//manage next and last button
		if(this.start + this.rowPerPage < this.datasource.getLength()) {
			this.nextButton.style.opacity = 1;
			this.nextButton.style.cursor = 'pointer';
			this.lastButton.style.opacity = 1;
			this.lastButton.style.cursor = 'pointer';
		}
		else {
			this.nextButton.style.opacity = 0.2;
			this.nextButton.style.cursor = 'auto';
			this.lastButton.style.opacity = 0.2;
			this.lastButton.style.cursor = 'auto';
		}
	}
	//retrieve data to display
	var that = this;
	this.datasource.getData(this.start, this.rowPerPage, function(data) {
		//no data
		if(data.isEmpty()) {
			var no_data = document.createFullElement('tr', {'class' : 'even'});
			no_data.appendChild(document.createFullElement('td', {colspan : that.columns.length}, 'No data to display'));
			that.body.appendChild(no_data);
			//display status
			if(that.rowPerPage) {
				that.status.clear();
			}
		}
		else {
			var i, j;
			//revive and render data
			var rendered_data = [];
			for(i = 0; i < data.length; i++) {
				rendered_data[i] = [];
				var original_record = data[i];
				//store original record //TODO find an other way to store it as this prevent having a column linked to data name "record"
				rendered_data[i].record = original_record;
				for(j = 0; j < that.columns.length; j++) {
					column = that.columns[j];
					var record = {};
					if(column.data) {
						record.raw = original_record[column.data];
					}
					//revive date
					if(column.type === Grid.DataType.DATE && record.raw) {
						record.raw = new Date(record.raw);
					}
					//render
					if(column.render) {
						try {
							record.rendered = column.render(record.raw, original_record);
						} catch(exception) {
							throw new Error('Unable to use render function for column ' + i + ' with data ' + record.raw + ' : ' + exception);
						}
						if(record.rendered === undefined) {
							throw new Error('Render function for column ' + i + ' does not produce a valid result with data ' + record.raw);
						}
					}
					rendered_data[i][j] = record;
				}
			}
			//insert in table
			for(var i = 0; i < rendered_data.length; i++) {
				var line = document.createElement('tr');
				if(that.rowClass) {
					line.classList.add(that.rowClass.call(undefined, rendered_data[i].record));
				}
				else {
					line.classList.add(i % 2 === 0 ? 'even' : 'odd');
				}
				for(var j = 0; j < that.columns.length; j++) {
					var column = that.columns[j];
					var value = column.render ? rendered_data[i][j].rendered : rendered_data[i][j].raw;
					var element = document.createFullElement('td');
					//string are just appended
					if(typeof value === 'string') {
						//value must not be falsy
						if(value) {
							element.appendChild(document.createTextNode(value));
						}
					}
					//number are aligned to the right
					else if(typeof value === 'number') {
						element.setAttribute('style', 'text-align: right;');
						element.appendChild(document.createTextNode(value + ''));
					}
					//boolean are converted to string
					else if(typeof value === 'boolean') {
						element.appendChild(document.createTextNode(value + ''));
					}
					//render function may have returned a HTML element
					else {
						//value must not be falsy
						if(value) {
							element.appendChild(value);
						}
					}
					line.appendChild(element);
				}
				that.body.appendChild(line);
			}
			//display status
			if(that.rowPerPage) {
				that.status.clear();
				//calculate max index
				var max = that.rowPerPage ? that.start + that.rowPerPage >= that.datasource.getLength() ? that.datasource.getLength() : that.start + that.rowPerPage : that.datasource.getLength();
				//correct min index if needed
				var min = that.start >= that.datasource.getLength() ? that.rowPerPage ? that.datasource.getLength() - that.rowPerPage : 0 : that.start;
				that.status.appendChild(document.createTextNode(that.statusText.replaceObject({start : (min + 1), stop : max, total : that.datasource.getLength()})));
			}
		}
	});
};

(function() {
	function uncache(url) {
		return url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
	}

	Grid.Datasource = function(parameters) {
		//data
		//asynchronous mode
		this.url;
		this.lazy;

		//synchronous mode
		this.data;

		//events
		this.ready;

		//bind parameters
		for(var parameter in parameters) {
			this[parameter] = parameters[parameter];
		}

		//check required parameters
		if(!this.url && !this.data) {
			throw new Error('One of following parameters is required : url or data');
		}

		//check consistency
		if(this.lazy && !this.url) {
			throw new Error('Lazy grid requires following parameter : url');
		}

		//internal variables
		this.length;
		this.filteredData;
		this.sortingOrders = [];
	};

	Grid.Datasource.prototype.init = function(callback) {
		var that = this;

		//retrieve amount (length) of data

		//datasources that must retrieve data
		if(this.url) {
			//datasources that can retrieve all data at once using an url
			if(!this.lazy) {
				var url = uncache(this.url);
				var that = this;
				var xhr = new XMLHttpRequest();
				xhr.addEventListener(
					'load',
					function(event) {
						if(event.target.status === 200) {
							that.data = event.target.response;
							that.length = that.data.length;
							if(callback) {
								callback.call();
							}
						}
						else {
							throw new Error('Unable to retrieve data : ' + xhr.status + ' ' + xhr.statusText);
						}
					}
				);
				xhr.open('GET', url, true);
				xhr.responseType = 'json';
				xhr.send();
			}
			//datasources that are lazy, length must be retrieved explicitly
			else {
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function() {
					if(xhr.readyState === 4) {
						if(xhr.status === 200) {
							that.length = JSON.parse(xhr.responseText).length;
							if(callback) {
								callback.call();
							}
						}
						else {
							throw new Error('Unable to retrieve data length : ' + xhr.status + ' ' + xhr.statusText);
						}
					}
				};
				xhr.open('GET', uncache(that.url) + '&length=true', true);
				xhr.send();
			}
		}
		else {
			//datasources that already have data
			this.length = this.data.length;
			if(callback) {
				callback.call();
			}
		}
	};

	Grid.Datasource.prototype.getLength = function() {
		return this.filteredData ? this.filteredData.length : this.length;
	};

	function sort(data) {
		var that = this;
		data.sort(function(a, b) {
			var index = 0;
			var field;
			var result;
			while(!result && index < that.sortingOrders.length) {
				field = that.sortingOrders[index].field;
				var a_data = a[field];
				var b_data = b[field];
				if(!a_data && !b_data) {
					result = 0;
				}
				else {
					if(!a_data) {
						result = -1;
					}
					else if(!b_data) {
						result = 1;
					}
					else {
						result = a_data.compareTo(b_data);
					}
				}
				index++;
			}
			return that.sortingOrders[index - 1].descendant ? - result : result;
		});
	}

	Grid.Datasource.prototype.getData = function(start, limit, callback) {
		//filtered data
		if(this.filteredData) {
			sort.call(this, this.filteredData);
			callback.call(undefined, this.filteredData.slice(start, limit ? start + limit : undefined));
		}
		else {
			//non lazy grids, data are already here
			if(this.data) {
				sort.call(this, this.data);
				callback.call(undefined, this.data.slice(start, limit ? start + limit : undefined));
			}
			//lazy grids
			else {
				var url = uncache(this.url);
				if(this.lazy) {
					url += ('&start=' + start);
					url += ('&limit=' + limit);
					if(!this.sortingOrders.isEmpty()) {
						url += ('&order=' + this.sortingOrders[0].field);
						url += ('&descendant=' + this.sortingOrders[0].descendant);
					}
				}
				var that = this;
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function() {
					if(xhr.readyState === 4) {
						if(xhr.status === 200) {
							var data = JSON.parse(xhr.responseText);
							callback.call(undefined, data);
						}
						else {
							throw new Error('Unable to retrieve data : ' + xhr.status + ' ' + xhr.statusText);
						}
					}
				};
				xhr.open('GET', url, true);
				xhr.send();
			}
		}
	};

	Grid.Datasource.prototype.filter = function(filter) {
		this.filteredData = this.data.filter(filter);
	};

	Grid.Datasource.prototype.unfilter = function() {
		this.filteredData = undefined;
	};

})();

Grid.DataType = {
	STRING : 'String',
	DATE : 'Date',
	NUMBER : 'Number'
};