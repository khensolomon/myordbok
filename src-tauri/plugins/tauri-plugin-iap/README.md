# tauri-plugin-iap 0.9.1, with one change

The store's payments for the app (StoreKit 2 on iOS, Google Play Billing on
Android): [tauri-plugin-iap](https://github.com/Choochmeque/tauri-plugin-iap)
0.9.1 by Choochmeque, MIT (LICENSE), kept here as published on crates.io,
less its tests' tooling (the Gradle wrapper, generated schemas).

## The change

`ios/Sources/IapPlugin.swift`: the plugin's entry point is `public`.

```swift
@_cdecl("init_plugin_iap")
public func initPlugin() -> Plugin {
```

As published (`func initPlugin()`, internal), a release build of the Swift
package drops the function: nothing in the package calls it, and an internal
function is not kept for others. The app then fails to link,
`Undefined symbols: _init_plugin_iap`. Tauri's own plugins declare theirs
`public` (tauri-plugin-haptics, tauri-plugin-opener).

Once a release of the plugin declares it `public`, this folder can go: back
to `tauri-plugin-iap = "<that version>"` in `src-tauri/Cargo.toml`.
