'use strict';

function Timeframe(startDate, stopDate) {
	this.startDate = startDate;
	this.stopDate = stopDate;
}
Timeframe.prototype.getDays = function() {
	return Date.getDifferenceInDays(this.startDate, this.stopDate);
};
Timeframe.prototype.addMargins = function(percentage) {
	var margin = Math.floor(this.getDays() * percentage / 100);
	this.startDate.addDays(-margin);
	this.stopDate.addDays(margin);
	return this;
};
Timeframe.prototype.shift = function(days) {
	this.startDate.addDays(days);
	this.stopDate.addDays(days);
};
Timeframe.prototype.clone = function() {
	return new Timeframe(this.startDate.clone(), this.stopDate.clone());
};
Timeframe.prototype.surround = function(date) {
	return this.startDate <= date && this.stopDate >= date;
};
Timeframe.prototype.overlap = function(timeframe) {
	return this.surround(timeframe.startDate) || this.surround(timeframe.stopDate) || timeframe.surround(this.startDate) || timeframe.surround(this.stopDate);
};
Timeframe.prototype.toString = function() {
	return this.startDate + ' - ' + this.stopDate;
};
Timeframe.prototype.equals = function(timeframe) {
	return this.startDate.getTime() == timeframe.startDate.getTime() && this.stopDate.getTime() == timeframe.stopDate.getTime();
};