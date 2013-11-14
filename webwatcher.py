import json
import urllib2
import webapp2
from google.appengine.api import urlfetch
from google.appengine.api import mail

#read configuration file
CONFIG_FILE = 'config.json';
file = open(CONFIG_FILE, 'r')
config = json.load(file)
file.close()

#warn about the problem
def warn(website, error):
	for email in config["emails"]:
		mail.send_mail(config["sender_email"], email, 'Problem with ' + website["name"], error)
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
			return website["name"] + ' is fine';
		except Exception as e:
			return warn(website, 'Unable to read website response : {0}'.format(e))
		#finally:
			#connection.close()
	except Exception as e:
		return warn(website, 'Unable to reach website : {0}'.format(e))

#appengine needs a webpage
class Check(webapp2.RequestHandler):

	def get(self):
		self.response.headers['Content-Type'] = 'text/plain'
		self.response.write('Checking websites\n')
		for website in config["websites"]:
			self.response.write(check(website) + '\n')

application = webapp2.WSGIApplication([
	('/', Check),
], debug=True)