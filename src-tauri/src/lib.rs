//! The MyOrdbok app: the web app's own files (dist/tauri, from
//! `node scripts/build.js --target tauri --api …`) in a web view, with two
//! plugins the pages call through `window.__TAURI__`:
//!
//! - http: requests to the API, made natively (app/platform/tauri/http.js);
//! - opener: links that leave the app, in the system browser
//!   (app/platform/tauri/boot.js);
//! - haptics: a light tap felt on the tabs and the buttons that keep
//!   something (app/platform/tauri/boot.js); nothing on a computer.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_haptics::init())
        .run(tauri::generate_context!())
        .expect("MyOrdbok could not start");
}
