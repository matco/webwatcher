# Webwatcher
Webwatcher is a web application that monitors your websites and e-mail you as if one of them becomes unavailable.

## Local usage

### Requirements
You will need the following dependencies:
* Python 3 with PIP
* Node.js with NPM
* An SQL database

The application relies on the following environment variables to connect to the database:
* DB_HOST: the host (default `localhost`)
* DB_PORT: the port (default `3306`)
* DB_SOCKET: the socket, can be used instead of "DB_HOST" and "DB_PORT" (no default value)
* DB_USER: the user (default `root`)
* DB_PASSWORD: the password (default `root`)
* DB_NAME: the name of the database (default `webwatcher`)
Set these variables only if you would like to customize their values.

The database will be automatically initialized by the application itself.

### The back-end
First, install the dependencies:
```
pip install -r requirements.txt
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

## Deployment on Google App Engine
This application is ready to be deployed on Google App Engine. The best is to create a new Google Cloud Platform project dedicated to the application.

You will need the following dependencies:
* Google Cloud SDK (follow the instructions to login to your project)
* Node.js with NPM

### Create the database instance
In your project, use the menu `Databases > SQL` to create a Google SQL instance. Make sure to configure the instance properly:
* Use MySQL version 8.0
* Choose a strong password and note it
* In the `Connections` section, allow the access though a public IP (you can disable the access through a private IP)

If you choose carefully the instance settings, you can benefit from [Google Cloud Free Program](https://cloud.google.com/free/docs/gcp-free-tier/#compute). If interested, do the following choices:
* For the instance, use a "shared core 1vCPU, 0.6GB" located in us-west1, us-central1 or us-east1 and use "single zone" (free instance)
* For the storage, use an HDD smaller than 30GB (free storage)

Back to the main page of your instance, note the connection name of the instance (visible in the main page of the instance under `Connection name`).

Then, you must create the database itself. From the main page of your instance, select `Databases` in the left menu and create a database named `webwatcher` (or any other name that please you).

### Allow the Google App Engine service account to use the Cloud SQL API
A Google App Engine application relies on a Google Cloud Platform service account. You must ensure this account has the appropriate Cloud SQL role and permissions as described (https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#public-ip-default)[here].

Here is the simplified process:
* Use the menu `IAM & Admin > IAM`
* Identify the service account used by Google App Engine (its name should be `App Engine default service account`)
* Edit the user and add the role `Cloud SQL Client`

### Configure the application
Add your custom database connection settings (the name of the connection, the password and eventually the name of the database) in the file `environment.yaml`. You can also change how often websites are checked by editing the file `cron.yaml`.

Everything else is configured through the web interface.

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
