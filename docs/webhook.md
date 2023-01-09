# webhook

`update-myordbok.sh`

```sh
#!/bin/bash

# 1. Fetch the latest origin from [master/main/branch-name]
git pull -f origin master

# 2. Install dependencies
npm install

# Build step that compiles code, bundles assets, etc.
npm run build

# 3. restart the application, with pm2 reload is ok
pm2 reload MyOrdbok
# or restart
# pm2 restrt MyOrdbok
# if you are configuration 1st time
# pm2 save
```

`hooks.json`

```json
[
  ...
  {
    "id": "update-myordbok",
    "execute-command": "/home/khensolomon/webhook/update-myordbok.sh",
    "command-working-directory": "/var/www/myordbok",
    "response-message":"Updated MyOrdbok...",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hash-sha1",
            "secret": "mysupersecret",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/master",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```
