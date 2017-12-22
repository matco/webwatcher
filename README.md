# Webwatcher
Webwatcher is a tiny web app that monitors websites for you and send you an e-mail as soon as one of them becomes unavailable.
It is ready to be deployed on Google App Engine.

## Deployment
Install the Google Cloud SDK. Then, execute:
```
gcloud app deploy
```

## Configuration
You can change how often websites are checked by editing the file cron.yaml. Everything else is configured through the web interface.