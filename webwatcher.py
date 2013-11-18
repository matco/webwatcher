import json
import urllib2
import webapp2
import datetime
from google.appengine.api import urlfetch
from google.appengine.api import mail
from google.appengine.ext import db
from google.appengine.ext.webapp import template

#read configuration file
CONFIG_FILE = 'config.json';
file = open(CONFIG_FILE, 'r')
config = json.load(file)
file.close()

class Website(db.Model):
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

class WebsiteEncoder(json.JSONEncoder):
	def default(self, object):
		print object.__class__.__name__
		if object.__class__.__name__ == "Website":
			return {"name" : object.name, "url" : object.url, "status" : object.online, "update" : object.update}
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
		for email in config["emails"]:
			mail.send_mail(config["sender_email"], email, 'Problem with ' + website.name, error)

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
class Check(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = "text/plain"
		self.response.write('Checking websites\n')
		for website in Website.all():
			self.response.write(check(website) + '\n')

class Status(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = "application/json"
		self.response.write(json.dumps(Website.all().fetch(None), cls=WebsiteEncoder))

	def post(self):
		parameters = json.loads(self.request.POST.get('website').decode("utf8"))

		website_query = Website.gql("WHERE name = :1", parameters["name"])
		if website_query.count() > 0:
			response = json.dumps({"message" : "There is already a website with name {0}".format(parameters["name"])})
			self.error(400)
			self.response.write(response)
		else:
			website = Website(name=parameters["name"], url=parameters["url"], texts=parameters["texts"])
			website.put();
			response = json.dumps({"message" : "Website {0} added successfully".format(parameters["name"])})
			self.response.write(response)

	def delete(self, website_name):
		print self.request.path
		website_query = Website.gql("WHERE name = :1", website_name)
		if website_query.count() == 0:
			response = json.dumps({"message" : "There is not website with name {0}".format(website_name)})
			self.error(400)
			self.response.write(response)
		else:
			website = website_query.get()
			website.delete()
			response = json.dumps({"message" : "Website {0} deleted successfully".format(website_name)})
			self.response.write(response)


application = webapp2.WSGIApplication([
	('/api/check', Check),
	('/api/status', Status),
	('/api/status/(\w+)', Status),
], debug=True)