FROM nginx:alpine

# 1. Clean up default config
# Remove everything in conf.d to ensure a clean slate
# RUN rm /etc/nginx/conf.d/default.conf
RUN rm /etc/nginx/conf.d/*

# 2. Copy 'default.conf' and rename it to 'default.conf.template' inside the container
COPY default.conf /etc/nginx/templates/default.conf.template

