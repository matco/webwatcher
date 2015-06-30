import datetime
import time
import json
import urllib2
import webapp2
import logging
import hashlib
import string
import random
from webapp2_extras import sessions
from google.appengine.api import urlfetch
from google.appengine.api import mail
from google.appengine.ext import db

#model
class NamedModel(db.Model):
	def __init__(self, *args, **kwargs):
		#add key name only when object is fresh
		if not "key" in kwargs and not "key_name" in kwargs:
			kwargs["key_name"] = kwargs[self.key_property]
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
	disabled = db.BooleanProperty()

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
			return {"name" : object.name, "url" : object.url, "texts" : object.texts, "online" : object.online, "update" : object.update, "uptime" : object.uptime, "downtime" : object.downtime, "disabled" : object.disabled}
		if object.__class__.__name__ == "Downtime":
			return {"id" : object.key().id(), "rationale" : object.rationale, "start" : object.start, "stop" : object.stop}
		if object.__class__.__name__ == "datetime":
			return object.isoformat() + "Z"
		return json.JSONEncoder.default(self, object)

#warn about the problem
def warn(subject, message):
	#send e-mails
	sender_email = Setting.get_by_key_name("sender_email").value
	for subscriber in Subscriber.all():
		mail.send_mail(sender_email, subscriber.email, subject, message)

#website checker
def check(website, avoid_cache, timeout):
	error = None
	url = website.url
	#add timestamp to url to avoid cache if asked
	if avoid_cache:
		url += "&" if "?" in url else "?"
		url += str(time.time())
	try:
		response = urlfetch.fetch(
			url=url,
			headers={"Cache-Control" : "max-age=60"},
			deadline=timeout,
			validate_certificate=False,
			follow_redirects=True
		)
		try:
			if response.status_code == 200:
				html = response.content.decode("utf8")
				#for text in website.texts:
				if not website.texts in html:
					error = "Text '{0}' is not present".format(website.texts)
			else:
				error = "Response status is {0}".format(response.status_code)
		except Exception as e:
			error = "Unable to read website response: {0}".format(e)
	except urlfetch.DownloadError as e:
		error = "Unable to retrieve website data: {0}".format(e.message)
	except urlfetch.DeadlineExceededError as e:
		error = "Deadline exceeded while trying to reach website: {0}".format(e.message)
	except Exception as e:
		error = "Unable to reach website for unknown reason: {0}".format(e)
	#update website last update
	now = datetime.datetime.now()
	previous_update = website.update or now
	website.update = now
	time_since_last_check = int((now - previous_update).total_seconds())
	#website is online
	if error is None:
		#if website was aready online at previous check, increase uptime
		if website.online:
			website.uptime += int((now - previous_update).total_seconds())
		#if website was previously offline
		elif website.online is False:
			#update last downtime
			downtime = Downtime.gql("WHERE website = :1 AND stop = NULL", website.name).get()
			#downtime = Downtime.all().filter("website=", website.name).filter("stop =", None).get()
			#TODO fix this as downtime should never be None
			if downtime is not None:
				downtime.stop = now
				downtime.put()
				#increase website downtime (pessimistic vision, website has returned online between 2 checks)
				website.downtime += time_since_last_check
			else:
				warn("Error while retrieving current downtime for " + website.name)
			#warn subscribers
			message = website.name + " is back online"
			warn(message, message)
		website.online = True
		website.put()
		#return message to be displayed
		return "{0} is fine".format(website.name);
	#website is offline
	else:
		#if website was online at previous check
		if website.online is None or website.online:
			#create a new downtime
			downtime = Downtime(parent=website, website=website.name, rationale=error)
			downtime.put()
			#warn subscribers only the first time website is detected as offline
			warn(website.name + " is offline", error)
		#increase downtime anyway (pessimistic vision)
		website.downtime += time_since_last_check
		website.online = False
		website.put()
		#return message to be displayed
		return "Problem with website {0} : {1}".format(website.name, error)

def hash_password(password):
	return hashlib.sha256(password).hexdigest()

#rest api
class CustomRequestHandler(webapp2.RequestHandler):

	def __init__(self, request, response):
		self.initialize(request, response)
		#set json header for all responses
		self.response.headers["Content-Type"] = "application/json"

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		try:
			webapp2.RequestHandler.dispatch(self, *args, **kwargs)
		finally:
			session_store.save_sessions(self.response)

class AuthenticatedRequestHandler(CustomRequestHandler):

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		if "authenticated" in self.session and self.session["authenticated"]:
			webapp2.RequestHandler.dispatch(self, *args, **kwargs)
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))

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
		response = {}
		#retrieve websites
		if name is None:
			websites = Website.gql("WHERE disabled != TRUE").fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
		else:
			websites = [Website.get_by_key_name(name)]
		#retrieve settings
		avoid_cache = Setting.get_by_key_name("avoid_cache")
		avoid_cache = avoid_cache is not None and avoid_cache.value == "True"
		timeout = int(Setting.get_by_key_name("website_timeout").value)
		#check retrieved websites
		for website in websites:
			response[website.name] = check(website, avoid_cache, timeout)
		#self.response.write(json.dumps(response))
		self.response.write(json.dumps(websites, cls=JSONCustomEncoder))

class Recalculate(AuthenticatedRequestHandler):

	def get(self, name=None):
		websites = {}
		#retrieve all downtimes
		for downtime in Downtime.all():
			if downtime.stop is not None:
				if downtime.website not in websites:
					websites[downtime.website] = 0
				websites[downtime.website] += int((downtime.stop - downtime.start).total_seconds())
		#update all websites
		for website in Website.all():
			if website.name in websites:
				website.downtime = websites[website.name]
			else:
				website.downtime = 0
			website.put()

		self.response.write(json.dumps({"message" : "Website downtimes calculated successfully"}))

class REST(CustomRequestHandler):

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		try:
			if not self.require_authentication[self.request.method] or "authenticated" in self.session:
				webapp2.RequestHandler.dispatch(self, *args, **kwargs)
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))
		finally:
			session_store.save_sessions(self.response)

	def get(self, key = None):
		if key is not None:
			object = self.db_model.get_by_key_name(key)
			self.response.write(json.dumps(object, cls=JSONCustomEncoder))
		else:
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

	def post(self, key):
		object = self.db_model.get_by_key_name(key)
		if object is None:
			self.error(400)
			response = json.dumps({"message" : "There is no {0} with key {1}".format(self.db_model_name, key)})
			self.response.write(response)
		else:
			parameters = json.loads(self.request.POST.get("object").decode("utf8"))
			print dir(object)
			#warning "private" fields may be updated
			for attribue, value in parameters.iteritems():
				setattr(object, attribue, value)
			object.put();
			response = json.dumps({"message" : "{0} {1} updated successfully".format(self.db_model_name, key)})
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

class WebsitesResource(REST):
	db_model = Website
	db_model_name = "Website"
	require_authentication = {"GET" : False, "PUT" : True, "POST" : True, "DELETE" : True}

	#override delete method to delete downtimes when deleting a website
	def delete(self, key):
		object = self.db_model.get_by_key_name(key)
		#delete associated downtimes
		if object is not None:
			downtimes = Downtime.gql("WHERE website = :1 ORDER BY start DESC", object.name).fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
			for downtime in downtimes:
				downtime.delete()
		#delete website itself
		super(WebsitesResource, self).delete(key)

class SubscribersResource(REST):
	db_model = Subscriber
	db_model_name = "Subscriber"
	require_authentication = {"GET" : True, "PUT" : True, "DELETE" : True}

class WebsiteAction(AuthenticatedRequestHandler):

	def get(self, website_name):
		website = Website.get_by_key_name(website_name)
		if website is not None:
			website.disabled = self.website_action == "disable"
			website.put()
			self.response.write(json.dumps({"message" : "Website {0} disabled successfully".format(website.name)}))
		else:
			self.error(404)
			self.response.write(json.dumps({"message" : "No website with name {0}".format(website_name)}))

class WebsiteDisable(WebsiteAction):
	website_action = "disable"

class WebsiteEnable(WebsiteAction):
	website_action = "enable"

class WebsiteDowntimes(CustomRequestHandler):

	def get(self, website_name):
		website = Website.get_by_key_name(website_name)
		if website is not None:
			downtimes = Downtime.gql("WHERE website = :1 ORDER BY start DESC", website.name).fetch(limit=None)
			#downtimes = Downtime.all().filter("website=", website.name).order("-start").fetch(limit=None)
			self.response.write(json.dumps(downtimes, cls=JSONCustomEncoder))
		else:
			self.error(404)
			self.response.write(json.dumps({"message" : "No website with name {0}".format(website_name)}))

	def delete(self, website_name, downtime_id):
		website = Website.get_by_key_name(website_name)
		if website is not None:
			downtime = Downtime.get_by_id(int(downtime_id), website)
			if downtime is not None:
				downtime.delete()
				self.response.write(json.dumps({"message" : "Downtime id {0} deleted successfully".format(downtime_id)}))
			else:
				self.error(404)
				self.response.write(json.dumps({"message" : "No downtime with id {0}".format(downtime_id)}))
		else:
			self.error(404)
			self.response.write(json.dumps({"message" : "No website with name {0}".format(website_name)}))

secret_key = "".join(random.choice(string.ascii_letters + string.ascii_lowercase + string.punctuation) for x in range(20))
webapp_config = {}
webapp_config["webapp2_extras.sessions"] = {"secret_key" : secret_key}

website_regexp = "([A-Za-z0-9]+)"
downtime_regexp = "([A-Za-z0-9]+)"

application = webapp2.WSGIApplication([
	("/api/status", Status),
	("/api/authenticate", Authenticate),
	("/api/configuration", Configuration),
	("/api/configuration/(.+)", Configuration),
	("/api/recalculate", Recalculate),
	("/api/check", Check),
	("/api/check/" + website_regexp, Check),
	("/api/websites", WebsitesResource),
	("/api/websites/" + website_regexp, WebsitesResource),
	("/api/websites/" + website_regexp + "/disable", WebsiteDisable),
	("/api/websites/" + website_regexp + "/enable", WebsiteEnable),
	("/api/websites/" + website_regexp + "/downtimes", WebsiteDowntimes),
	("/api/websites/" + website_regexp + "/downtimes/" + downtime_regexp, WebsiteDowntimes),
	("/api/subscribers", SubscribersResource),
	("/api/subscribers/(.+)", SubscribersResource),
], debug=True, config=webapp_config)
