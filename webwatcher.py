import json
import urllib2
import webapp2
import datetime
from google.appengine.api import urlfetch
from google.appengine.api import mail
from google.appengine.ext import db

#read configuration file
CONFIG_FILE = 'config.json';
file = open(CONFIG_FILE, 'r')
config = json.load(file)
file.close()

class State(db.Model):
	website = db.StringProperty(required=True)
	online = db.BooleanProperty()
	update = db.DateProperty()

class Downtime(db.Model):
	website = db.StringProperty(required=True)
	rationale = db.StringProperty(required=True)
	start = db.DateProperty(required=True)
	stop = db.DateProperty()

for website in config["websites"]:
	state_query = State.gql("WHERE website = :1", website["name"])
	print state_query.count()
	if state_query.count() == 0:
		s = State(website=website["name"])
		db.put(s)

#warn about the problem
def warn(website, error):
	now = datetime.datetime.now().date()
	#update website status
	state_query = State.gql("WHERE website = :1", website["name"])
	s = state_query.get()
	s.update = now
	s.online = False
	db.put(s)
	#check if website was already down at previous check
	downtime_query = Downtime.gql("WHERE website = :1 AND stop = NULL", website["name"])
	if downtime_query.count() == 0:
		#store downtime
		now = datetime.datetime.now().date()
		d = Downtime(website=website["name"], rationale=error, start=now)
		db.put(d)

		#send e-mails
		for email in config["emails"]:
			mail.send_mail(config["sender_email"], email, 'Problem with ' + website["name"], error)

	#return message to be displayed
	message = 'Problem with website ' + website["name"] + ' : ' + error
	return message

#website checker
def check(website):
	try:
		response = urlfetch.fetch(website["url"], deadline=config["timeout"], validate_certificate=False)
		try:
			if response.status_code != 200:
				return warn(website, 'Response status is {0}'.format(response.status))
			html = response.content.decode("utf8")
			for text in website["texts"]:
				if not text in html:
					return warn(website, 'Text "' + text + '" is not present')
			#manage website status
			now = datetime.datetime.now().date()
			state_query = State.gql("WHERE website = :1", website["name"])
			s = state_query.get()
			#if update was previously offline
			if not s.online:
				downtime_query = Downtime.gql("WHERE website = :1 AND stop = NULL", website["name"])
				d = downtime_query.get()
				d.stop = datetime.datetime.now().date()
				db.put(d)
			#update website status
			s.update = now
			s.online = True
			db.put(s)
			#return message to be displayed
			return website["name"] + ' is fine';
		except Exception as e:
			return warn(website, 'Unable to read website response : {0}'.format(e))
	except Exception as e:
		return warn(website, 'Unable to reach website : {0}'.format(e))

#appengine needs webpages
class Check(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = 'text/plain'
		self.response.write('Checking websites\n')
		for website in config["websites"]:
			self.response.write(check(website) + '\n')

class Status(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = 'text/plain'
		self.response.write('Websites status\n')
		for website in config["websites"]:
			self.response.write(website["name"])
			self.response.write("\t")
			state_query = State.gql("WHERE website = :1 ", website["name"])
			s = state_query.get()
			if s.online == None:
				self.response.write("not checked yet")
			elif s.online:
				self.response.write("ok")
			else:
				self.response.write("not ok")
			self.response.write("\n")

application = webapp2.WSGIApplication([
	('/check', Check),
	('/status', Status),
], debug=True)