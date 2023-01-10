#!/bin/bash

# Copy to
# cp webhook.sh /var/www/webhook/update-myordbok.sh

# Make it executable
# chmod +x /var/www/webhook/update-myordbok.sh
# And then modify /etc/webhook.conf

# git update-index --chmod=+x webhook.sh

# Update repo
git pull -f origin master

# Install dependencies
npm install
# Build assets
npm run build

# Reload PM2
pm2 reload MyOrdbok
# Save PM2
pm2 save
