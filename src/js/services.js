import {Restify} from './restify.js';

const Subscribers = new Restify('/api/subscribers');
const Websites = new Restify('/api/websites');

export {Subscribers, Websites};
