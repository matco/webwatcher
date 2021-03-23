import os
import datetime
import time
import json
import csv
import logging
import hashlib
import string
import random
import io
#database
from sqlalchemy import create_engine, engine, select, delete, func, Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
#email
import smtplib
import ssl
from email.message import EmailMessage
#request
import requests
#flask
from flask import Flask, session, request, jsonify, make_response
from flask_restful import Resource, Api

#number of tries before deciding to consider a website down
CHECK_TRIES = 2
#default timeout for checking website in seconds
DEFAULT_TIMEOUT = 5

#model

db_user = os.getenv("DB_USER", "root")
db_pass = os.getenv("DB_PASS", "root")
db_name = os.getenv("DB_NAME", "webwatcher")
db_host = os.getenv("DB_HOST", "localhost")

# Extract host and port from db_host
host_args = db_host.split(":")
db_hostname, db_port = host_args[0], int(host_args[1]) if len(host_args) > 1 else 3306

engine = create_engine(
	engine.url.URL.create(
		drivername="mysql+pymysql",
		username=db_user,
		password=db_pass,
		host=db_hostname,
		port=db_port,
		database=db_name,
	),
	echo=True, future=True
)
Session = sessionmaker(engine)

Base = declarative_base()

class Setting(Base):
	__tablename__ = "setting"
	id = Column(String(100), primary_key=True)
	value = Column(String(255), nullable=False)

class Subscriber(Base):
	__tablename__ = "subscriber"
	pk = Column(Integer, primary_key=True)
	email = Column(String(255), nullable=False)

class Website(Base):
	__tablename__ = "website"
	pk = Column(Integer, primary_key=True)
	name = Column(String(100), nullable=False, unique=True)
	url = Column(String(255), nullable=False)
	text = Column(String(255), nullable=False)
	#following two columns are null when a website has not been checked yet
	online = Column(Boolean)
	update = Column(DateTime)
	uptime = Column(Integer, nullable=False, default=0)
	downtime = Column(Integer, nullable=False, default=0)
	disabled = Column(Boolean, nullable=False, default=0)

class Downtime(Base):
	__tablename__ = "downtime"
	pk = Column(Integer, primary_key=True)
	website_fk = Column(Integer, ForeignKey(Website.pk))
	rationale = Column(String(1000), nullable=False)
	start = Column(DateTime, nullable=False, default=datetime.datetime.now)
	stop = Column(DateTime)

class JSONCustomEncoder(json.JSONEncoder):
	def default(self, object):
		if object.__class__.__name__ == "Setting":
			return {"id" : object.id, "value" : object.value}
		if object.__class__.__name__ == "Subscriber":
			return {"pk" : object.pk, "email" : object.email}
		if object.__class__.__name__ == "Website":
			return {"pk" : object.pk, "name" : object.name, "url" : object.url, "text" : object.text, "online" : object.online, "update" : object.update, "uptime" : object.uptime, "downtime" : object.downtime, "disabled" : object.disabled}
		if object.__class__.__name__ == "Downtime":
			return {"pk" : object.pk, "website_fk" : object.website_fk, "rationale" : object.rationale, "start" : object.start, "stop" : object.stop}
		if object.__class__.__name__ == "datetime":
			return object.isoformat() + "Z"
		return json.JSONEncoder.default(self, object)

#warn about the problem
def warn(subject, content):
	with Session.begin() as db_session:
		#send e-mails
		smtp_host_setting = db_session.get(Setting, "smtp_host")
		smtp_port_setting = db_session.get(Setting, "smtp_port")
		if smtp_host_setting is None or not smtp_host_setting.value or smtp_port_setting is None or not smtp_port_setting.value:
			return
		#connect to SMTP
		with smtplib.SMTP(smtp_host_setting.value, int(smtp_port_setting.value)) as smtp:
			#authenticate on SMTP
			smtp_username_setting = db_session.get(Setting, "smtp_username")
			smtp_password_setting = db_session.get(Setting, "smtp_password")
			if smtp_username_setting is not None and smtp_username_setting.value and smtp_password_setting is not None and smtp_password_setting.value:
				smtp.login(smtp_username_setting.value, smtp_password_setting.value)
			sender_email_setting = db_session.get(Setting, "sender_email")
			for subscriber in db_session.execute(select(Subscriber)).scalars().all():
				sender_email = sender_email_setting.value if sender_email_setting is not None else subscriber.email
				message = EmailMessage()
				message["Subject"] = subject
				message["From"] = sender_email
				message["To"] = subscriber.email
				message.set_content(content)
				smtp.send_message(message)

#get error message
def get_exception_message(exception):
	if hasattr(exception, 'message'):
		return e.message
	return str(exception)

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
				if not website.text in html:
					error = "Text '{0}' is not present".format(website.text)
			else:
				error = "Response status is {0}".format(response.status_code)
		except Exception as e:
			error = "Unable to read website response: {0}".format(get_exception_message(e))
	except requests.exceptions.ConnectionError as e:
		error = "Unable to retrieve website data: {0}".format(get_exception_message(e))
	except requests.exceptions.TooManyRedirects as e:
		error = "Too many redirects while trying to reach website: {0}".format(get_exception_message(e))
	except requests.exceptions.Timeout as e:
		error = "Deadline exceeded while trying to reach website: {0}".format(get_exception_message(e))
	except Exception as e:
		error = "Unable to reach website for unknown reason: {0}".format(get_exception_message(e))
	#return error or None if there is no error
	#TODO improve this
	return error

def monitor(db_session, website, avoid_cache, timeout):
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
		#if this is first check or if website was already online at previous check, increase uptime
		if website.online is None or website.online:
			website.uptime += int((now - previous_update).total_seconds())
		#if website was previously offline
		else:
			#update last downtime
			downtime = db_session.execute(select(Downtime).filter(Downtime.website_fk == website.pk, Downtime.stop == None)).scalar_one_or_none()
			#TODO fix this as downtime should never be None
			if downtime is not None:
				downtime.stop = now
				db_session.add(downtime)
				#increase website downtime (pessimistic vision, website has returned online between 2 checks)
				website.downtime += time_since_last_check
			else:
				print("Error while retrieving current downtime for " + website.name)
			#warn subscribers
			message = website.name + " is back online"
			warn(message, message)
		website.online = True
		db_session.add(website)
		#return message to be displayed
		return "{0} is fine".format(website.name)
	#website is now offline
	else:
		#if this is first check website was online at previous check
		if website.online is None or website.online:
			#create a new downtime
			downtime = Downtime(website_fk=website.pk, start=previous_update, rationale=error)
			db_session.add(downtime)
			#warn subscribers only the first time website is detected as offline
			warn(website.name + " is offline", error)
		#increase downtime anyway (pessimistic vision)
		website.downtime += time_since_last_check
		website.online = False
		db_session.add(website)
		#return message to be displayed
		return "Problem with website {0} : {1}".format(website.name, error)

def hash_password(password):
	return hashlib.sha256(password.encode("utf-8")).hexdigest()

def check_database_initialized(db_session):
	try:
		return db_session.get(Setting, "password") is not None
	except:
		return False

#api
app = Flask(__name__)
app.secret_key = "".join(random.choice(string.ascii_letters + string.ascii_lowercase + string.punctuation) for x in range(20))
app.json_encoder = JSONCustomEncoder

api = Api(app)

@app.route("/status")
def status():
	with Session.begin() as db_session:
		if not check_database_initialized(db_session):
			return {"message" : "Application must be initialized"}, 403
		#return protection and authentication status
		protect_app_setting = db_session.get(Setting, "protect_app")
		return {
			"protected": protect_app_setting is not None and protect_app_setting.value == "True",
			"authenticated": "authenticated" in session
		}

@app.route("/initialize", methods=["POST"])
def initialize():
	#check if application has not already been initialized
	with Session.begin() as db_session:
		if check_database_initialized(db_session):
			return {"message" : "Application has already been initialized"}, 403

	Base.metadata.create_all(bind=engine)
	#insert password
	credentials = request.get_json()
	password = hash_password(credentials["password"])
	setting = Setting(id="password", value=password)
	with Session.begin() as db_session:
		db_session.add(setting)
	session["authenticated"] = True
	return {"message" : "Application initialize successfully"}

@app.route("/authenticate", methods=["POST", "DELETE"])
def authenticate():
	if request.method == "POST":
		credentials = request.get_json()
		with Session.begin() as db_session:
			setting_password = db_session.get(Setting, "password")
			if hash_password(credentials["password"]) == setting_password.value:
				session["authenticated"] = True
				return {"message" : "Authentication success"}
			else:
				return {"message" : "Wrong password"}, 401
	if request.method == "DELETE":
		session.pop("authenticated", None)
		return {"message" : "Logout successful"}

class Configuration(Resource):
	def get(self):
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		dto = {}
		with Session.begin() as db_session:
			settings = db_session.execute(select(Setting)).scalars().all()
			for setting in settings:
				if setting.id != "password":
					dto[setting.id] = setting.value
		return dto

	def put(self):
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		dto = request.get_json()
		with Session.begin() as db_session:
			for id, value in dto.items():
				value = str(value)
				#encrypt password
				if id == "password":
					value = hash_password(value)
				setting = db_session.get(Setting, id)
				if setting is None:
					setting = Setting(id=id, value=value)
					db_session.add(setting)
				else:
					setting.value = value
		return {"message" : "Settings updated successfully"}

api.add_resource(Configuration, "/configuration")

@app.route("/check", defaults={"pk": None})
@app.route("/check/<int:pk>")
def website_check(pk):
	#retrieve websites
	with Session.begin() as db_session:
		if pk is None:
			websites = db_session.execute(select(Website).filter(Website.disabled == False)).scalars().all()
		else:
			websites = [db_session.get(Website, pk)]
		#retrieve settings
		avoid_cache_setting = db_session.get(Setting, "avoid_cache")
		avoid_cache = avoid_cache_setting is not None and avoid_cache_setting.value
		timeout_setting = db_session.get(Setting, "website_timeout")
		timeout = int(timeout_setting.value) if timeout_setting is not None else DEFAULT_TIMEOUT
		#check retrieved websites
		for website in websites:
			monitor(db_session, website, avoid_cache, timeout)
		return jsonify(websites)

@app.route("/recalculate")
def recalculate():
	#check rights
	if not "authenticated" in session:
		return {"message" : "You must be authenticated to perform this action"}, 401

	website_downtimes = {}
	with Session.begin() as db_session:
		#retrieve all downtimes
		for downtime in db_session.execute(select(Downtime)).scalars().all():
			if downtime.stop is not None:
				if downtime.website_fk not in website_downtimes:
					website_downtimes[downtime.website_fk] = 0
				website_downtimes[downtime.website_fk] += int((downtime.stop - downtime.start).total_seconds())
		#update all websites
		for website in db_session.execute(select(Website)).scalars().all():
			if website.pk in website_downtimes:
				website.downtime = website_downtimes[website.pk]
			else:
				website.downtime = 0
			db_session.add(website)

		return {"message" : "Website downtimes calculated successfully"}

class REST(Resource):
	def get(self, pk = None):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with Session.begin() as db_session:
			if pk is not None:
				object = db_session.get(self.db_model, pk)
				if object is None:
					return {"message" : "No {0} with pk {1}".format(self.db_model_name, pk)}, 404
				return jsonify(object)

			else:
				objects = db_session.execute(select(self.db_model)).scalars().all()
				return jsonify(objects)

	def post(self):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		dto = request.get_json()

		with Session.begin() as db_session:
			object = self.db_model(**dto)
			db_session.add(object)
			return jsonify(object)

	def put(self, pk):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with Session.begin() as db_session:
			object = db_session.get(self.db_model, pk)
			if object is None:
				return {"message" : "No {0} with pk {1}".format(self.db_model_name, pk)}, 404
			dto = request.get_json()
			#warning "private" fields may be updated
			for attribute, value in dto.items():
				if attribute != "key":
					setattr(object, attribute, value)
			db_session.add(object)
			return {"message" : "{0} with pk {1} updated successfully".format(self.db_model_name, pk)}

	def delete(self, pk):
		#check rights
		if self.require_authentication(request.method) and not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with Session.begin() as db_session:
			object = db_session.get(self.db_model, pk)
			if object is None:
				return {"message" : "No {0} with pk {1}".format(self.db_model_name, pk)}, 404
			db_session.delete(object)
			return {"message" : "{0} with pk {1} deleted successfully".format(self.db_model_name, pk)}

class WebsitesResource(REST):
	def __init__(self):
		self.db_model_name = "Website"
		self.db_model = Website
		self.authentication_requirements = {"GET" : False, "PUT" : True, "POST" : True, "DELETE" : True}

	def require_authentication(self, method):
		with Session.begin() as db_session:
			protect_app = db_session.execute(select(Setting).filter(Setting.id == "protect_app")).scalar_one_or_none()
			if protect_app is not None and protect_app.value == "True":
				return True
			return self.authentication_requirements[method]

	#override delete method to delete downtimes when deleting a website
	def delete(self, pk):
		with Session.begin() as db_session:
			website = db_session.get(self.db_model, pk)
			#delete associated downtimes
			if website is not None:
				db_session.execute(delete(Downtime).filter(Downtime.website_fk == website.pk))
			#delete website itself
			db_session.delete(website)

api.add_resource(WebsitesResource, "/websites", "/websites/<int:pk>")

class SubscribersResource(REST):
	def __init__(self):
		self.db_model_name = "Subscriber"
		self.db_model = Subscriber
		self.authentication_requirements = {"GET" : True, "POST" : True, "DELETE" : True}

	def require_authentication(self, method):
		return self.authentication_requirements[method]

api.add_resource(SubscribersResource, "/subscribers", "/subscribers/<int:pk>")

@app.route("/websites/<int:pk>/action/<string:action>")
def website_action(pk, action):
	#check rights
	if not "authenticated" in session:
		return {"message" : "You must be authenticated to perform this action"}, 401

	with Session.begin() as db_session:
		website = db_session.get(Website, pk)
		if website is None:
			return {"message" : "No website with pk {0}".format(pk)}, 404
		website.disabled = action == "disable"
		db_session.add(website)
		return {"message" : "Website with pk {0} updated successfully".format(pk)}


class WebsiteDowntimes(Resource):
	def get(self, website_pk):
		#check rights
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with Session.begin() as db_session:
			website = db_session.get(Website, website_pk)
			if website is None:
				return {"message" : "No website with pk {0}".format(website_pk)}, 404
			downtimes = db_session.execute(select(Downtime).where(Downtime.website_fk == website.pk)).scalars().all()
			if request.headers["Accept"] == "application/json":
				return jsonify(downtimes)
			else:
				output = io.StringIO()
				fieldnames = ["pk", "start", "stop", "rationale"]
				writer = csv.DictWriter(output, fieldnames=fieldnames)
				writer.writeheader()
				for downtime in downtimes:
					writer.writerow({"pk" : downtime.pk, "start" : downtime.start, "stop" : downtime.stop, "rationale" : downtime.rationale})
				response = make_response(output.getvalue())
				response.headers["Content-Type"] = "text/csv"
				response.headers["Content-Disposition"] = "attachment; filename=downtimes.csv"
				return response


	def delete(self, website_pk, pk):
		#check rights
		if not "authenticated" in session:
			return {"message" : "You must be authenticated to perform this action"}, 401

		with Session.begin() as db_session:
			website = db_session.get(Website, website_pk)
			if website is None:
				return {"message" : "No website with pk {0}".format(website_pk)}, 404

			downtime = db_session.get(Downtime, pk)
			if downtime is None:
				return {"message" : "No downtime with pk {0}".format(pk)}, 404
			db_session.delete(downtime)
			return {"message" : "Downtime with pk {0} deleted successfully".format(pk)}

api.add_resource(WebsiteDowntimes, "/websites/<int:website_pk>/downtimes", "/websites/<int:website_pk>/downtimes/<int:pk>")

#local only for debug purpose
if __name__ == "__main__":
	print("Launching application locally")
	app.run(host="0.0.0.0", port=1338, debug=True)
