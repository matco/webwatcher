import datetime
import json
import urllib2
import webapp2
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
	email = db.StringProperty(required=True)

class Website(NamedModel):
	key_property = "name"
	name = db.StringProperty(required=True)
	url = db.StringProperty(required=True)
	texts = db.StringProperty(required=True)
	online = db.BooleanProperty()
	update = db.DateTimeProperty()

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
			return {"name" : object.name, "url" : object.url, "online" : object.online, "update" : object.update}
		if object.__class__.__name__ == "datetime":
			return object.isoformat()
		return json.JSONEncoder.default(self, object)

#warn about the problem
def warn(website, error):
	now = datetime.datetime.now()
	#update website status
	website_query = Website.gql("WHERE name = :1", website.name)
	w = website_query.get()
	w.update = now
	w.online = False
	w.put()
	#check if website was already down at previous check
	downtime_query = Downtime.gql("WHERE website = :1 AND stop = NULL", website.name)
	if downtime_query.count() == 0:
		#store downtime
		now = datetime.datetime.now()
		d = Downtime(website=website.name, rationale=error)
		d.put()

		#send e-mails
		for subscriber in Subscriber.all():
			mail.send_mail(Setting.get_by_key_name("sender_email").value, subscriber.email, 'Problem with ' + website.name, error)

	#return message to be displayed
	message = 'Problem with website ' + website.name + ' : ' + error
	return message

#website checker
def check(website):
	try:
		response = urlfetch.fetch(website.url, deadline=Setting.get_by_key_name("website_timeout").value, validate_certificate=False)
		try:
			if response.status_code != 200:
				return warn(website, 'Response status is {0}'.format(response.status))
			html = response.content.decode("utf8")
			for text in website.texts:
				if not text in html:
					return warn(website, 'Text "' + text + '" is not present')
			#manage website status
			now = datetime.datetime.now()
			website_query = Website.gql("WHERE name = :1", website.name)
			w = website_query.get()
			#if update was previously offline
			if not w.online:
				downtime_query = Downtime.gql("WHERE website = :1 AND stop = NULL", website.name)
				d = downtime_query.get()
				d.stop = now
				db.put(d)
			#update website status
			w.update = now
			w.online = True
			w.put()
			#return message to be displayed
			return "{0} is fine".format(website.name);
		except Exception as e:
			return warn(website, "Unable to read website response : {0}".format(e))
	except Exception as e:
		return warn(website, "Unable to reach website : {0}".format(e))

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
		if credentials["password"] == Setting.get_by_key_name("password").value:
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
					setting = Setting.get_by_key_name(id)
				if setting is None:
					setting = Setting(id=id, value=value)
				else:
					print "current setting " + setting.id + " - " + setting.value
					setting.value = value;
				setting.put()
				self.response.write(json.dumps({"message" : "Configuration updated successfully"}))
				if id == "password":
					self.session["authenticated"] = True
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))
		else:
			setting = Setting.get_by_key_name(id)
			value = self.request.POST.get("value").decode("utf8")
			#special handling for password setting
			if "authenticated" in self.session or id == "password" and setting is None:
				if setting is None:
					setting = Setting(id=id, value=value)
				else:
					setting.value = value;
				setting.put()
				self.response.write(json.dumps({"message" : "Setting {0} set to {0}".format(id, value)}))
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

	def get(self):
		self.response.headers['Content-Type'] = "text/plain"
		self.response.write('Checking websites\n')
		for website in Website.all():
			self.response.write(check(website) + '\n')

class REST(CustomRequestHandler):

	def dispatch(self, *args, **kwargs):
		session_store = sessions.get_store(request=self.request)
		self.session = session_store.get_session()
		try:
			if 'authenticated' in self.session:
				webapp2.RequestHandler.dispatch(self, *args, **kwargs)
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authenticated to perform this action"}))
		finally:
			session_store.save_sessions(self.response)

	def get(self):
		objects = self.db_model.all().fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
		self.response.write(json.dumps(objects, cls=JSONCustomEncoder))

	def post(self):
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

class SubscriberResource(REST):
	db_model = Subscriber
	db_model_name = "Subscriber"

webapp_config = {}
webapp_config["webapp2_extras.sessions"] = {"secret_key" : "webwatcher?!"}

application = webapp2.WSGIApplication([
	('/api/status', Status),
	('/api/authenticate', Authenticate),
	('/api/check', Check),
	('/api/configuration', Configuration),
	('/api/configuration/(.*)', Configuration),
	('/api/website', WebsiteResource),
	('/api/website/(.+)', WebsiteResource),
	('/api/subscriber', SubscriberResource),
	('/api/subscriber/(.+)', SubscriberResource),
], debug=True, config=webapp_config)