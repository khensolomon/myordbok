#!/bin/bash

# 1. Fetch the latest origin from [master/main/branch-name]
git pull -f origin master

npm install
npm run build

pm2 reload MyOrdbok
pm2 save
