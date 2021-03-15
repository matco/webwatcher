import datetime
import time
import json
import csv
import logging
import hashlib
import string
import random
import io
#sendin email
import smtplib
import ssl
from email.message import EmailMessage
#request
import requests
#google cloud
from google.cloud import ndb
#flask
from flask import Flask, session, request, jsonify, make_response
from flask_restful import Resource, Api

#number of tries before deciding to consider a website down
CHECK_TRIES = 2
#default timeout for checking website in seconds
DEFAULT_TIMEOUT = 5

#model
class Setting(ndb.Model):
	key_property = "id"
	id = ndb.StringProperty(required=True)
	value = ndb.StringProperty(required=True)

class Subscriber(ndb.Model):
	key_property = "email"
	email = ndb.StringProperty(required=True)

class Website(ndb.Model):
	key_property = "name"
	name = ndb.StringProperty(required=True)
	url = ndb.StringProperty(required=True)
	texts = ndb.StringProperty(required=True)
	online = ndb.BooleanProperty()
	update = ndb.DateTimeProperty()
	uptime = ndb.IntegerProperty(default=0)
	downtime = ndb.IntegerProperty(default=0)
	disabled = ndb.BooleanProperty()

class Downtime(ndb.Model):
	website = ndb.KeyProperty(kind=Website)
	rationale = ndb.StringProperty(required=True)
	start = ndb.DateTimeProperty(required=True, auto_now_add=True)
	stop = ndb.DateTimeProperty()

class JSONCustomEncoder(json.JSONEncoder):
	def default(self, object):
		if object.__class__.__name__ == "Setting":
			return {"id" : object.id, "value" : object.value}
		if object.__class__.__name__ == "Subscriber":
			return {"id" : object.key.id(), "email" : object.email}
		if object.__class__.__name__ == "Website":
			return {"id" : object.key.id(), "name" : object.name, "url" : object.url, "texts" : object.texts, "online" : object.online, "update" : object.update, "uptime" : object.uptime, "downtime" : object.downtime, "disabled" : object.disabled}
		if object.__class__.__name__ == "Downtime":
			return {"id" : object.key.id(), "rationale" : object.rationale, "start" : object.start, "stop" : object.stop}
		if object.__class__.__name__ == "datetime":
			return object.isoformat() + "Z"
		return json.JSONEncoder.default(self, object)

#warn about the problem
def warn(subject, content):
	#send e-mails
	smtp_host_setting = Setting.query(Setting.id == "smtp_host").get()
	smtp_port_setting = Setting.query(Setting.id == "smtp_port").get()
	if smtp_host_setting is None or not smtp_host_setting.value or smtp_port_setting is None or not smtp_port_setting.value:
		return
	#connect to SMTP
	with smtplib.SMTP(smtp_host_setting.value, int(smtp_port_setting.value)) as smtp:
		#authenticate on SMTP
		smtp_username_setting = Setting.query(Setting.id == "smtp_username").get()
		smtp_password_setting = Setting.query(Setting.id == "smtp_password").get()
		if smtp_username_setting is not None and smtp_username_setting.value and smtp_password_setting is not None and smtp_password_setting.value:
			smtp.login(smtp_username_setting.value, smtp_password_setting.value)
		sender_email_setting = Setting.query(Setting.id == "sender_email").get()
		for subscriber in Subscriber.query():
			sender_email = sender_email_setting.value if sender_email_setting is not None else subscriber.email
			message = EmailMessage()
			message["Subject"] = subject
			message["From"] = sender_email
			message["To"] = subscriber.email
			message.set_content(content)
			smtp.send_message(message)

#website checker
def check(website, avoid_cache, timeout):
	error = None
	url = website.url
	#add timestamp to url to avoid cache if asked
	if avoid_cache:
		url += "&" if "?" in url else "?"
		url += str(time.time())
	#do check
	try:
		response = requests.get(url,
			headers={"Cache-Control" : "max-age=60"},
			timeout=timeout
		)
		try:
			if response.status_code == 200:
				html = response.text
				#for text in website.texts:
				if not website.texts in html:
					error = "Text '{0}' is not present".format(website.texts)
			else:
				error = "Response status is {0}".format(response.status_code)
		except Exception as e:
			error = "Unable to read website response: {0}".format(e)
	except requests.ConnectionError as e:
		error = "Unable to retrieve website data: {0}".format(e.message)
	except requests.Timeout as e:
		error = "Deadline exceeded while trying to reach website: {0}".format(e.message)
	except Exception as e:
		error = "Unable to reach website for unknown reason: {0}".format(e)
	#return error or None if there is no error
	#TODO improve this
	return error

def monitor(website, avoid_cache, timeout):
	error = check(website, avoid_cache, timeout)
	#if website was previously online and there is now an error, check again to avoid false positive
	i = 0
	while(website.online and error is not None and i < CHECK_TRIES):
		i += 1
		time.sleep(1)
		error = check(website, avoid_cache, timeout)
	#update website last update
	now = datetime.datetime.now()
	previous_update = website.update or now
	website.update = now
	time_since_last_check = int((now - previous_update).total_seconds())
	#website is now online
	if error is None:
		#if website was already online at previous check, increase uptime
		if website.online:
			website.uptime += int((now - previous_update).total_seconds())
		#if website was previously offline
		else:
			#update last downtime
			downtime = Downtime.query(Downtime.website == website.key, Downtime.stop == None).get()
			#TODO fix this as downtime should never be None
			if downtime is not None:
				downtime.stop = now
				downtime.put()
				#increase website downtime (pessimistic vision, website has returned online between 2 checks)
				website.downtime += time_since_last_check
			else:
				print("Error while retrieving current downtime for " + website.name)
			#warn subscribers
			message = website.name + " is back online"
			warn(message, message)
		website.online = True
		website.put()
		#return message to be displayed
		return "{0} is fine".format(website.name)
	#website is now offline
	else:
		#if website was online at previous check
		if website.online is None or website.online:
			#create a new downtime
			downtime = Downtime(website=website.key, start=previous_update, rationale=error)
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
	return hashlib.sha256(password.encode("utf-8")).hexdigest()

#api
app = Flask(__name__)
app.secret_key = "".join(random.choice(string.ascii_letters + string.ascii_lowercase + string.punctuation) for x in range(20))
app.json_encoder = JSONCustomEncoder

api = Api(app)

@app.route("/status")
def status():
	with ndb.Client().context():
		#check if application has been initialized
		if Setting.query(Setting.id == "password").count() == 0:
			return {"message" : "Application must be initialized"}, 403
		#return protection and authentication status
		protect_app_setting = Setting.query(Setting.id == "protect_app").get()
		return {
			"protected": protect_app_setting is not None and protect_app_setting.value == "True",
			"authenticated": "authenticated" in session
		}

@app.route("/authenticate", methods=["POST", "DELETE"])
def authenticate():
	if request.method == "POST":
		credentials = json.loads(request.form.get("credentials"))
		with ndb.Client().context():
			if hash_password(credentials["password"]) == Setting.query(Setting.id == "password").get().value:
				session["authenticated"] = True
				return {"message" : "Authentication success"}
			else:
				return {"message" : "Wrong password"}, 401
	if request.method == "DELETE":
		session.pop("authenticated", None)
		return {"message" : "Logout successful"}

class Configuration(Resource):
	def get(self, id=None):
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			if id is None:
				objects = Setting.query().fetch()
				configuration = {}
				for object in objects:
					if object.id != "password":
						configuration[object.id] = object.value
				return configuration
			else:
				setting = Setting.query(Setting.id == id).get()
				if setting is None:
					return {"message" : "No setting with id {0}".format(id)}, 404
				else:
					return {"id" : id, "value" : setting.value}

	def post(self, id=None):
		if id is None:
			if not "authenticated" in session:
				return {"message" : "You must be authenticated to perform this action"}, 401

			configuration = json.loads(request.form.get("configuration"))
			with ndb.Client().context():
				for id, value in configuration.items():
					value = str(value)
					setting = Setting.query(Setting.id == id).get()
					if setting is None:
						setting = Setting(id=id, value=value)
					else:
						setting.value = value
					setting.put()
				return {"message" : "Configuration updated successfully"}
		else:
			with ndb.Client().context():
				setting = Setting.query(Setting.id == id).get()
				value = request.form.get("value")
				#encrypt password
				if id == "password":
					value = hash_password(value)
				#changing a setting required authentication except for password the first time
				if "authenticated" in session or id == "password" and setting is None:
					if setting is None:
						setting = Setting(id=id, value=value)
					else:
						setting.value = value
					setting.put()
					#authenticate user if the password has just been set
					if id == "password":
						session["authenticated"] = True
					return {"message" : "Setting {0} set to {1}".format(id, value)}
				else:
					return {"message" : "You must be authenticated to perform this action"}, 401

	def delete(self, id):
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			setting = Setting.query(Setting.id == id).get()
			if setting is None:
				return {"message" : "No setting with id {0}".format(id)}, 404
			else:
				setting.key.delete()
				return {"message" : "Setting id {0} deleted successfully".format(id)}

api.add_resource(Configuration, "/configuration", "/configuration/<string:id>",)

@app.route("/check", defaults={"id": None})
@app.route("/check/<int:id>")
def website_check(id):
	#retrieve websites
	with ndb.Client().context():
		if id is None:
			websites = Website.query(Website.disabled != True).fetch()
		else:
			websites = [ndb.Key(Website, id).get()]
		#retrieve settings
		avoid_cache_setting = Setting.query(Setting.id == "avoid_cache").get()
		avoid_cache = avoid_cache_setting is not None and avoid_cache_setting.value
		timeout_setting = Setting.query(Setting.id == "website_timeout").get()
		timeout = int(timeout_setting.value) if timeout_setting is not None else DEFAULT_TIMEOUT
		#check retrieved websites
		for website in websites:
			monitor(website, avoid_cache, timeout)
		return jsonify(websites)

@app.route("/recalculate")
def recalculate():
	#check rights
	if not "authenticated" in session:
		return {"message" : "You must be authenticated to perform this action"}, 401

	websites = {}
	with ndb.Client().context():
		#retrieve all downtimes
		for downtime in Downtime.query():
			if downtime.stop is not None:
				if downtime.website not in websites:
					websites[downtime.website] = 0
				websites[downtime.website] += int((downtime.stop - downtime.start).total_seconds())
		#update all websites
		for website in Website.query():
			if website.name in websites:
				website.downtime = websites[website.name]
			else:
				website.downtime = 0
			website.put()

		return {"message" : "Website downtimes calculated successfully"}

class REST(Resource):
	def get(self, id = None):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			if id is not None:
				object = ndb.Key(self.db_model, id).get()
				return jsonify(object)
			else:
				objects = self.db_model.query().fetch()
				return jsonify(objects)

	def post(self):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		parameters = request.get_json()

		with ndb.Client().context():
			object = self.db_model(**parameters)
			object.put()
			return jsonify(object)

	def put(self, id):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			object = ndb.Key(self.db_model, id).get()
			if object is None:
				return {"message" : "There is no {0} with id {1}".format(self.db_model_name, id)}, 400

			parameters = request.get_json()
			#warning "private" fields may be updated
			for attribute, value in parameters.items():
				if attribute != "key":
					setattr(object, attribute, value)
			object.put()
			return {"message" : "{0} {1} updated successfully".format(self.db_model_name, id)}

	def delete(self, id):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			object = ndb.Key(self.db_model, id).get()
			if object is None:
				return {"message" : "There is no {0} with id {1}".format(self.db_model_name, id)}, 400

			object.key.delete()
			return {"message" : "{0} with id {1} deleted successfully".format(self.db_model_name, id)}

class WebsitesResource(REST):
	def __init__(self):
		self.db_model_name = "Website"
		self.db_model = Website
		self.authentication_requirements = {"GET" : False, "PUT" : True, "POST" : True, "DELETE" : True}

	def require_authentication(self, method):
		with ndb.Client().context():
			protect_app = Setting.query(Setting.id == "protect_app").get()
			if protect_app is not None and protect_app.value == "True":
				return True
			return self.authentication_requirements[method]

	#override delete method to delete downtimes when deleting a website
	def delete(self, id):
		with ndb.Client().context():
			website = ndb.Key(Website, id).get()
			#delete associated downtimes
			if website is not None:
				downtimes = Downtime.query(Downtime.website == website.key).fetch()
				for downtime in downtimes:
					downtime.key.delete()
			#delete website itself
			website.key.delete()

api.add_resource(WebsitesResource, "/websites", "/websites/<int:id>")

class SubscribersResource(REST):
	def __init__(self):
		self.db_model_name = "Subscriber"
		self.db_model = Subscriber
		self.authentication_requirements = {"GET" : True, "POST" : True, "DELETE" : True}

	def require_authentication(self, method):
		return self.authentication_requirements[method]

api.add_resource(SubscribersResource, "/subscribers", "/subscribers/<int:id>")

@app.route("/websites/<int:id>/action/<string:action>")
def website_action(id, action):
	#check rights
	if not "authenticated" in session:
		return {"message" : "You must be authenticated to perform this action"}, 401

	with ndb.Client().context():
		website = ndb.Key(Website, id).get()
		if website is None:
			return {"message" : "No website with id {0}".format(id)}, 404

		website.disabled = action == "disable"
		website.put()
		return {"message" : "Website with id {0} updated successfully".format(id)}

class WebsiteDowntimes(Resource):
	def get(self, website_id):
		#check rights
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			website = ndb.Key(Website, website_id).get()
			if website is None:
				return {"message" : "No website with id {0}".format(id)}, 404

			downtimes = Downtime.query(Downtime.website == website.key).fetch()#.order(-Downtime.start).fetch()
			if request.headers["Accept"] == "application/json":
				return jsonify(downtimes)
			else:
				output = io.StringIO()
				fieldnames = ["id", "start", "stop", "rationale"]
				writer = csv.DictWriter(output, fieldnames=fieldnames)
				writer.writeheader()
				for downtime in downtimes:
					writer.writerow({"id" : downtime.key.id(), "start" : downtime.start, "stop" : downtime.stop, "rationale" : downtime.rationale})
				response = make_response(output.getvalue())
				response.headers["Content-Type"] = "text/csv"
				response.headers["Content-Disposition"] = "attachment; filename=downtimes.csv"
				return response

	def delete(self, website_id, id):
		#check rights
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with ndb.Client().context():
			website = ndb.Key(Website, website_id).get()
			if website is None:
				return {"message" : "No website with id {0}".format(website_id)}, 404
			downtime = ndb.Key(Downtime, id).get()
			if downtime is None:
				return {"message" : "No downtime with id {0}".format(id)}, 404

			downtime.key.delete()
			return {"message" : "Downtime with id {0} deleted successfully".format(id)}

api.add_resource(WebsiteDowntimes, "/websites/<int:website_id>/downtimes", "/websites/<int:website_id>/downtimes/<int:id>")

#local only for debug purpose
if __name__ == "__main__":
	print("Launching application locally")
	app.run(host="0.0.0.0", port=1338, debug=True)
