# MyOrdbok

[![MyOrdbok][logo]](https://www.myordbok.com)

မိုင်အိုလ်ဗို့ လာရောက်လည်ပတ်မှုအချက်အလက်များကို ပြီးခဲ့သည့် [2022/11/27][home]  မှ ပြန်လည်တွက်ချက်အရ ဧည့်သည် **21,109** ဦးနှင့် လာရောက်လည်ပတ်မှု **2,453,600** ကြိမ်ရှိသည်။ စုစုပေါင်း လာရောက်သူ **60,347** ဦး၏ အလည်အပတ်ပေါင်း [889,993,843,088,042][about] ကြိမ်ရှိပါသည်။

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
# Start development server
npm start

# Build assets
npm run build

# Check outdated package
npm outdated

# other
npm prune --production
npm uninstall (Get-ChildItem).Name
```

```sql
mysql > SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
```

## webpack

- webpack.*.js
  - [x] middleware
  - [x] production
  - [x] development
  - [ ] dev server

[home]: //www.myordbok.com
[grammar]: //www.myordbok.com/grammar
[fonts]: //www.myordbok.com/myanmar-fonts
[about]: //www.myordbok.com/about
[logo]: assets/img/MyOrdbok.png
