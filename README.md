# Webwatcher
Webwatcher is a web application that monitors your websites and e-mail you when one of them becomes unavailable.

## How it works?
Webwatcher is a standard web application. It has two parts:
* The backend, a REST API written in Python that relies on a MySQL database
* The frontend is a website written using HTML, CSS and vanilla JavaScript

Webwatcher has been conceived to be easily deployed on Google App Engine (see "Deployment on Google App Engine" section below).

The web interface displays the status of the websites you are monitoring and allows you to set the followings:
* The websites you want to check
* The people who will be e-mailed in case of a failure
* The global settings (SMTP server, option to avoid cache)

Webwatcher does not check the websites automatically. The websites are checked only when a request is made to the special URL `/api/check`. To automate this check, you need to set up a cron that will call this URL periodically. For example, you can use the following entry in the crontab of the server to check the websites every 5 minutes:
```
*/5 * * * * curl http://localhost:8080/api/check
```

### Requirements
You will need the following dependencies:
* Python 3 with PIP and venv
* Node.js with NPM
* An SQL database

### Database
The application relies on the following environment variables to connect to the database:
* `DB_HOST`: the host (default `localhost`)
* `DB_PORT`: the port (default `3306`)
* `DB_SOCKET`: the socket, can be used instead of `DB_HOST` and `DB_PORT` (no default value)
* `DB_USER`: the user (default `root`)
* `DB_PASSWORD`: the password (default `root`)
* `DB_NAME`: the name of the database (default `webwatcher`)
Set these variables only if you would like to customize their values.

The database will be automatically initialized by the application itself.

### Sessions
The website uses client side "sessions" (using cookies). The cookies are encrypted using a key. By default, a random key is generated each time the application starts. This does not work for the Google App Engine environment, where multiple instances of the application can run at the same time. The environment variable `COOKIE_SECRET` allows choosing the key that will be used to encrypt the cookie.

## Local usage

The first step is to install the requirements described in the [Requirements](#requirements) section.

### The back-end
First, install the dependencies:
```
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
```

Then, launch the back-end:
```
python3 main.py
```

### The front-end
First, install the dependencies;
```
npm install
```

Then, start the front-end:
```
npm start
```

Finally, open your browser on `http://localhost:8080`.

## Server usage

The first step is to install the requirements described in the [Requirements](#requirements) section.

You will also need a production-ready WSGI server such as `Gunicorn` and a front server such as `Nginx` (acting as reverse proxy for the back-end and a classic HTTP server for the front-end). Install them with the following command:
```
sudo apt install nginx python3-gunicorn
```

### Set up the project
On the server, checkout the code of the project in a folder, for example in `/opt/webwatcher`. Then, in this folder, execute the following commands to install the project dependencies and generate the front-end bundle:
```
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
npm install
npm run build
```

### Set up a systemd service
Copy the file `resources/webwatcher.service` to the remote path `~/.config/systemd/user/webwatcher.service`. Then, run the following commands to reload systemd and start the service:
```
systemctl --user daemon-reload
systemctl --user start webwatcher
```

### Set up Nginx
Copy the Nginx configuration file `resources/webwatcher` in `/etc/nginx/sites-available/webwatcher` and enable this configuration with a symbolic link:
```
sudo ln -s /etc/nginx/sites-available/webwatcher /etc/nginx/sites-enabled/webwatcher
```

Then, reload Nginx:
```
sudo nginx -s reload
```

### Check websites automatically
Do not forget to set up the cron that will check the websites regularly. You can add the following entry in your `crontab` to check the websites status every 5 minutes:
```
*/5 * * * * /usr/bin/curl http://localhost:8000/api/check
```

## Deployment on Google App Engine
This application is ready to be deployed on Google App Engine. The best is to create a new Google Cloud Platform project dedicated to the application.

You will need the following dependencies:
* Google Cloud SDK (follow the instructions to log in to your project)
* Node.js with NPM

### Create the database instance
In your project, use the menu `Databases > SQL` to create a Google SQL instance. Make sure to configure the instance properly:
* Use MySQL version 8.0
* Choose a strong password and note it
* In `Customize your instance > Connections`, allow the access though a public IP (you can disable the access through a private IP)

Wait for the instance to be created. Back to the main page of your instance, get the connection name of the instance (visible in the block `Connect to this instance` under `Connection name`). It should be something like `project-id:us-west1:webwatcher`. The name of the connection must then be prefixed with `/cloudsql/` to get the final name of the connection (`/cloudsql/project-id:us-west1:webwatcher` with the previous example).

Then, you must create the database itself. From the main page of your instance, select `Databases` in the left menu and create a database named `webwatcher` (or any other name that pleases you). Keep default "Character set" and "Collation".

### Allow the Google App Engine service account to use the Cloud SQL API
A Google App Engine application relies on a Google Cloud Platform service account. You must ensure this account has the appropriate Cloud SQL role and permissions as described [here](https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#public-ip-default).

Here is the simplified process:
* Use the menu `IAM & Admin > IAM`
* Identify the service account used by Google App Engine (its name should be `App Engine default service account`)
* Edit the user and add the role `Cloud SQL Client`

### Configure the application
Next step is to configure the application:
* In the file `environment.yaml`, add your custom database connection settings (the name of the connection, the password, and possibly the name of the database if you used a custom name) and generate a strong key for the cookies
* In the file `cron.yaml`, you can change how often websites are checked

### Build the front-end
First, install the dependencies;
```
npm install
```

Then, build the front-end:
```
npm run build
```

### Deploy
Finally, deploy the application with the Google Cloud CLI:
```
gcloud app deploy
```

## Tips

### Access your Cloud SQL database from anywhere
In your project, use the menu `Databases > SQL` and select your Google SQL instance. Then, select `Connections` and add your IP in the section `Authorized networks`.
