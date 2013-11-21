import datetime
import json
import urllib2
import webapp2
from webapp2_extras import sessions
from google.appengine.api import urlfetch
from google.appengine.api import mail
from google.appengine.ext import db
from google.appengine.ext.webapp import template

#read configuration file
CONFIG_FILE = 'config.json';
file = open(CONFIG_FILE, 'r')
config = json.load(file)
file.close()

class NamedModel(db.Model):
	def __init__(self, *args, **kwargs):
		#add key name only when object is fresh
		if not "key" in kwargs and not "key_name" in kwargs:
			kwargs['key_name'] = kwargs[self.key_property]
		super(NamedModel, self).__init__(*args, **kwargs)

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
			mail.send_mail(config["sender_email"], subscriber.email, 'Problem with ' + website.name, error)

	#return message to be displayed
	message = 'Problem with website ' + website.name + ' : ' + error
	return message

#website checker
def check(website):
	try:
		response = urlfetch.fetch(website.url, deadline=config["timeout"], validate_certificate=False)
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
class Authenticate(webapp2.RequestHandler):

	def __init__(self, request, response):
		self.initialize(request, response)
		#set json header for all responses
		self.response.headers['Content-Type'] = "application/json"

	def dispatch(self):
		self.session_store = sessions.get_store(request=self.request)
		self.session = self.session_store.get_session()
		try:
			webapp2.RequestHandler.dispatch(self)
		finally:
			self.session_store.save_sessions(self.response)

	def get(self):
		if "authenticated" in self.session:
			self.response.write(json.dumps({"message" : "You are already authenticated"}))
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "You are not authenticated yet"}))

	def post(self):
		credentials = json.loads(self.request.POST.get("credentials").decode("utf8"))
		if credentials["password"] == config["password"]:
			self.session["authenticated"] = True
			self.response.write(json.dumps({"message" : "Authentication success"}))
		else:
			self.error(401)
			self.response.write(json.dumps({"message" : "Wrong password"}))

	def delete(self):
		del self.session["authenticated"]
		self.response.write(json.dumps({"message" : "Logout successfull"}))

class Check(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = "text/plain"
		self.response.write('Checking websites\n')
		for website in Website.all():
			self.response.write(check(website) + '\n')

class REST(webapp2.RequestHandler):

	def __init__(self, request, response):
		self.initialize(request, response)
		#set json header for all responses
		self.response.headers['Content-Type'] = "application/json"

	def dispatch(self):
		self.session_store = sessions.get_store(request=self.request)
		self.session = self.session_store.get_session()
		try:
			if 'authenticated' in self.session:
				webapp2.RequestHandler.dispatch(self)
			else:
				self.error(401)
				self.response.write(json.dumps({"message" : "You must be authorized to perform this action"}))
		finally:
			self.session_store.save_sessions(self.response)

	def get(self):
		objects = self.db_model.all().fetch(limit=None, read_policy=db.STRONG_CONSISTENCY)
		self.response.write(json.dumps(objects, cls=JSONCustomEncoder))

	def post(self):
		parameters = json.loads(self.request.POST.get("object").decode("utf8"))
		key = parameters[self.db_model.key_property]

		existing_object = self.db_model.get_by_key_name(key)
		if existing_object is not None:
			response = json.dumps({"message" : "There is already a {0} with key {1}".format(self.db_model_name, key)})
			self.error(400)
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
	('/api/authenticate', Authenticate),
	('/api/check', Check),
	('/api/website', WebsiteResource),
	('/api/website/(.+)', WebsiteResource),
	('/api/subscriber', SubscriberResource),
	('/api/subscriber/(.+)', SubscriberResource),
], debug=True, config=webapp_config)