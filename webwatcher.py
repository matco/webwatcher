import datetime
import time
import json
import urllib2
import webapp2
import logging
import hashlib
from webapp2_extras import sessions
from google.appengine.api import urlfetch
from google.appengine.api import mail
from google.appengine.ext import db
from google.appengine.ext.webapp import template

class NamedModel(db.Model):
	def __init__(self, *args, **kwargs):
		#add key name only when object is fresh
		if not "key" in kwargs and not "key_name" in kwargs:
			kwargs['key_name'] = kwargs[self.key_property]
		super(NamedModel, self).__init__(*args, **kwargs)

class Setting(NamedModel):
	key_property = "id"
	id = db.StringProperty(required=True)
	value = db.StringProperty(required=True)

class Subscriber(NamedModel):
	key_property = "email"
	email = db.EmailProperty(required=True)

class Website(NamedModel):
	key_property = "name"
	name = db.StringProperty(required=True)
	url = db.StringProperty(required=True)
	texts = db.StringProperty(required=True)
	online = db.BooleanProperty()
	update = db.DateTimeProperty()
	uptime = db.IntegerProperty(default=0)
	downtime = db.IntegerProperty(default=0)

class Downtime(db.Model):
	website = db.StringProperty(required=True)
	rationale = db.StringProperty(required=True)
	start = db.DateTimeProperty(required=True, auto_now_add=True)
	stop = db.DateTimeProperty()

class JSONCustomEncoder(json.JSONEncoder):
	def default(self, object):
		if object.__class__.__name__ == "Setting":
			return {"id" : object.id, "value" : object.value}
		if object.__class__.__name__ == "Subscriber":
			return {"email" : object.email}
		if object.__class__.__name__ == "Website":
			return {"name" : object.name, "url" : object.url, "texts" : object.texts, "online" : object.online, "update" : object.update, "uptime" : object.uptime, "downtime" : object.downtime}
		if object.__class__.__name__ == "Downtime":
			return {"rationale" : object.rationale, "start" : object.start, "stop" : object.stop}
		if object.__class__.__name__ == "datetime":
			return object.isoformat() + "Z"
		return json.JSONEncoder.default(self, object)

#warn about the problem
def warn(website, error):
	#send e-mails
	sender_email = Setting.get_by_key_name("sender_email").value
	for subscriber in Subscriber.all():
		mail.send_mail(sender_email, subscriber.email, 'Problem with ' + website.name, error)

#website checker
def check(website):
	#TODO improve this by retrieving all settings
	try:
		error = None
		url = website.url
		#add timestamp to url to avoid cache if asked
		avoid_cache = Setting.get_by_key_name("avoid_cache")
		if avoid_cache is not None and avoid_cache.value == "True":
			url += "&" if "?" in url else "?"
			url += str(time.time())
		response = urlfetch.fetch(url, headers={'Cache-Control' : 'max-age=60'}, deadline=int(Setting.get_by_key_name("website_timeout").value), validate_certificate=False)
		try:
			if response.status_code == 200:
				html = response.content.decode("utf8")
				#for text in website.texts:
				if not website.texts in html:
					error = "Text '{0}' is not present".format(website.texts)
			else:
				error = "Response status is {0}".format(response.status_code)
		except Exception as e:
			error = "Unable to read website response : {0}".format(e)
	except Exception as e:
		error = "Unable to reach website : {0}".format(e)
	#update website last update
	now = datetime.datetime.now()
	previous_update = website.update or now
	website.update = now
	#website is online
	if error is None:
		#if website was aready online at previous check, increase uptime
		if website.online:
			website.uptime += int((now - previous_update).total_seconds())
		#if website was previously offline, update last downtime and increase downtime (pessimistic vision, website has returned online between 2 check)
		elif website.online is False:
			downtime = Downtime.gql("WHERE website = :1 AND stop = NULL", website.name).get()
			downtime.stop = now
			db.put(downtime)
			website.downtime += int((now - previous_update).total_seconds())
		website.online = True
		website.put()
		#return message to be displayed
		return "{0} is fine".format(website.name);
	#website is offline
	else:
		#if website was online at previous check, warn subscribers and create a new downtime
		if website.online is None or website.online:
			#warn subscribers only the first time website is detected as offline
			warn(website, error)
			downtime = Downtime(website=website.name, rationale=error)
			downtime.put()
		#increase downtime anyway (pessimistic vision)
		website.downtime += int((now - previous_update).total_seconds())
		website.online = False
		website.put()
		#return message to be displayed
		return "Problem with website {0} : {1}".format(website.name, error)

def hash_password(password):
	return hashlib.sha256(password).hexdigest()

#appengine needs webpages
class CustomRequestHandler(webapp2.RequestHandler):
	def __init__(self, request, response):
		self.initialize(request, response)
		#set json header for all responses
		self.response.headers['Content-Type'] = "application/json"

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		try:
			webapp2.RequestHandler.dispatch(self, *args, **kwargs)
		finally:
			session_store.save_sessions(self.response)

class Status(CustomRequestHandler):

	def get(self):
		setting = Setting.get_by_key_name("password")
		if setting is None:
			self.error(403)
			self.response.write(json.dumps({"message" : "Application must be configured"}))
		elif "authenticated" not in self.session:
			self.error(401)
			self.response.write(json.dumps({"message" : "You are not authenticated yet"}))
		else:
			self.response.write(json.dumps({"message" : "You are already authenticated"}))

class Authenticate(CustomRequestHandler):

	def post(self):
		credentials = json.loads(self.request.POST.get("credentials").decode("utf8"))
		if hash_password(credentials["password"]) == Setting.get_by_key_name("password").value:
			self.session["authenticated"] = True
			self.response.write(json.dumps({"message" : "Authentication success"}))
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "Wrong password"}))

	def delete(self):
		del self.session["authenticated"]
		self.response.write(json.dumps({"message" : "Logout successfull"}))

class Configuration(CustomRequestHandler):

	def get(self, id=None):
		if self.session["authenticated"]:
			if id is None:
				objects = Setting.all().fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
				configuration = {}
				for object in objects:
					if object.id != "password":
						configuration[object.id] = object.value;
				self.response.write(json.dumps(configuration))
			else:
				setting = Setting.get_by_key_name(id)
				if setting is None:
					self.error(404)
					self.response.write(json.dumps({"message" : "No setting with id {0}".format(id)}))
				else:
					self.response.write(json.dumps({"id" : id, "value" : setting.value}))
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))

	def post(self, id=None):
		if id is None:
			if "authenticated" in self.session:
				configuration = json.loads(self.request.POST.get("configuration").decode("utf8"))
				for id, value in configuration.iteritems():
					value = str(value)
					setting = Setting.get_by_key_name(id)
					if setting is None:
						setting = Setting(id=id, value=value)
					else:
						setting.value = value;
					setting.put()
				self.response.write(json.dumps({"message" : "Configuration updated successfully"}))
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))
		else:
			setting = Setting.get_by_key_name(id)
			value = self.request.POST.get("value").decode("utf8")
			#encrypt password
			if id == "password":
				value = hash_password(value)
			#changing a setting required authentication exept for password the first time
			if "authenticated" in self.session or id == "password" and setting is None:
				if setting is None:
					setting = Setting(id=id, value=value)
				else:
					setting.value = value;
				setting.put()
				self.response.write(json.dumps({"message" : "Setting {0} set to {0}".format(id, value)}))
				#authenticate user
				if id == "password":
					self.session["authenticated"] = True
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))

	def delete(self, id):
		if self.session["authenticated"]:
			setting = Setting.get_by_key_name(id)
			if setting is None:
				self.error(404)
				self.response.write(json.dumps({"message" : "No setting with id {0}".format(id)}))
			else:
				setting.delete()
				self.response.write(json.dumps({"message" : "Setting id {0} deleted successfully".format(id)}))
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))

class Check(webapp2.RequestHandler):

	def get(self, name=None):
		self.response.headers['Content-Type'] = "application/json"
		response = {}
		if name is None:
			websites = Website.all()
		else:
			websites = [Website.get_by_key_name(name)]
		for website in websites:
			response[website.name] = check(website)
		self.response.write(json.dumps(response))

class Details(CustomRequestHandler):

	def get(self, name):
		self.response.headers['Content-Type'] = "application/json"
		response = {}
		website = Website.get_by_key_name(name)
		if website is not None:
			response["name"] = website.name
			response["url"] = website.url
			response["update"] = website.update
			response["downtime"] = website.downtime
			response["uptime"] = website.uptime
			response["downtimes"] = Downtime.gql("WHERE website = :1 ORDER BY start DESC", website.name).fetch(10)
			self.response.write(json.dumps(response, cls=JSONCustomEncoder))
		else:
			self.error(404)
			self.response.write(json.dumps({"message" : "No website with name {0}".format(name)}))

class REST(CustomRequestHandler):

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		try:
			if not self.require_authentication[self.request.method] or 'authenticated' in self.session:
				webapp2.RequestHandler.dispatch(self, *args, **kwargs)
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))
		finally:
			session_store.save_sessions(self.response)

	def get(self):
		objects = self.db_model.all().fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
		self.response.write(json.dumps(objects, cls=JSONCustomEncoder))

	def put(self):
		parameters = json.loads(self.request.POST.get("object").decode("utf8"))
		key = parameters[self.db_model.key_property]

		existing_object = self.db_model.get_by_key_name(key)
		if existing_object is not None:
			self.error(400)
			response = json.dumps({"message" : "There is already a {0} with key {1}".format(self.db_model_name, key)})
			self.response.write(response)
		else:
			object = self.db_model(**parameters)
			object.put();
			response = json.dumps({"message" : "{0} {1} added successfully".format(self.db_model_name, key)})
			self.response.write(response)

	def delete(self, key):
		object = self.db_model.get_by_key_name(key)
		if object is None:
			response = json.dumps({"message" : "There is no {0} with key {1}".format(self.db_model_name, key)})
			self.error(400)
			self.response.write(response)
		else:
			object.delete()
			response = json.dumps({"message" : "{0} {1} deleted successfully".format(self.db_model_name, key)})
			self.response.write(response)

class WebsiteResource(REST):
	db_model = Website
	db_model_name = "Website"
	require_authentication = {"GET" : False, "PUT" : True, "DELETE" : True}

class SubscriberResource(REST):
	db_model = Subscriber
	db_model_name = "Subscriber"
	require_authentication = {"GET" : True, "PUT" : True, "DELETE" : True}

webapp_config = {}
webapp_config["webapp2_extras.sessions"] = {"secret_key" : "webwatcher?!"}

application = webapp2.WSGIApplication([
	('/api/status', Status),
	('/api/authenticate', Authenticate),
	('/api/configuration', Configuration),
	('/api/configuration/(.*)', Configuration),
	('/api/check', Check),
	('/api/check/(.*)', Check),
	('/api/details/(.*)', Details),
	('/api/website', WebsiteResource),
	('/api/website/(.+)', WebsiteResource),
	('/api/subscriber', SubscriberResource),
	('/api/subscriber/(.+)', SubscriberResource),
], debug=True, config=webapp_config)