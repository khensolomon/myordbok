#!/bin/bash

# 1.1 Create symbolic link, and update nginx config
# ln -s /var/www/myordbok-src/current /var/www/myordbok

# 1.2 Transfer .env to production
# scp ~/OneDrive/env/dev/myordbok/web/.env user@host:/var/www/myordbok/
node run environment


# 2.1 Install dependencies
cd /var/www/myordbok
npm install

# 2.2 Build ecosystem.json for pm2
node run ecosystem
# npm run ecosystem

# 2.2 Build assets
npm run build

# 2.3 Start PM2
pm2 start ecosystem.json
# pm2 startOrRestart ecosystem.json
# pm2 reload myordbok

# 2.4 Save PM2
pm2 save
