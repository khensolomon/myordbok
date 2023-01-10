#!/bin/bash

# git update-index --chmod=+x webhook.sh
git pull -f origin master

npm install
npm run build

pm2 reload MyOrdbok
pm2 save
