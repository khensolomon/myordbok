# MyOrdbok

[![MyOrdbok][logo]](https://www.myordbok.com)

မိုင်အိုလ်ဗို့ လာရောက်လည်ပတ်မှုအချက်အလက်များကို ပြီးခဲ့သည့် [2022/11/27][home] မှ ပြန်လည်တွက်ချက်အရ ဧည့်သည် **21,109** ဦးနှင့် လာရောက်လည်ပတ်မှု **2,453,600** ကြိမ်ရှိသည်။ စုစုပေါင်း လာရောက်သူ **60,347** ဦး၏ အလည်အပတ်ပေါင်း [889,993,843,088,042][about] ကြိမ်ရှိပါသည်။

... is online [Myanmar dictionary][home]

## Definition

- read temporary sessions: source words list, definition, type, usage but watch
- read target words list instantly
- deprecated MySQL(live data)

...

## Grammar

read source instantly, [Myanmar grammar][grammar]

## Fonts

read source instantly, [Myanmar fonts][fonts]. But restricted items are not available to download

### static data

- year of copyright

```shell
myordbok/
├── config/
│   ├── settings.py
│   └── ...
├── core/
│   ├── templates/
│   │   └── core/
│   |       ├── home.html
│   |       ├── about.html
│   │       └── base.html
│   └── ...
├── templates/
│   ├── rest_framework/
│   │   └── api.html
│   ├── base.html
│   └── ...
├── assets/
│   ├── src/
│   │   ├── js/
│   │   │   └── index.js
│   │   └── css/
│   │       └── styles.css
│   ├── package.json
│   └── webpack.config.js
├── requirements-dev.txt
├── requirements.txt
└── manage.py
```

```bash
npm install --save-dev webpack webpack-cli webpack-bundle-tracker @babel/core @babel/preset-env babel-loader css-loader style-loader
```

## webpack

- webpack.\*.js
  - [x] middleware
  - [x] production
  - [x] development
  - [ ] dev server

[home]: //www.myordbok.com
[grammar]: //www.myordbok.com/grammar
[fonts]: //www.myordbok.com/myanmar-fonts
[about]: //www.myordbok.com/about
[logo]: assets/img/MyOrdbok.png
