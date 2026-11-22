//! The MyOrdbok app: the web app's own files (dist/tauri, from
//! `node scripts/build.js --target tauri --api …`) in a web view, with two
//! plugins the pages call through `window.__TAURI__`:
//!
//! - http: requests to the API, made natively (app/platform/tauri/http.js);
//! - opener: links that leave the app, in the system browser
//!   (app/platform/tauri/boot.js);
//! - haptics: a light tap felt on the tabs and the buttons that keep
//!   something (app/platform/tauri/boot.js); nothing on a computer.
//!
//! On iOS the web view's own swipe from the edge goes back and forward
//! through the pages, as in Safari: the pages keep their history with
//! pushState (app/core/router.js), which the web view follows. Android's
//! back gesture and button do the same by themselves (wry's WryActivity).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_haptics::init())
        .setup(|_app| {
            #[cfg(target_os = "ios")]
            {
                use tauri::Manager;
                let window = _app
                    .get_webview_window("main")
                    .ok_or("the main window is missing: back swipe not turned on")?;
                window.with_webview(|webview| {
                    // A WKWebView (wry); its property, set on the main thread.
                    let view = webview.inner().cast::<objc2::runtime::AnyObject>();
                    unsafe {
                        let _: () = objc2::msg_send![&*view, setAllowsBackForwardNavigationGestures: true];
                    }
                })?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MyOrdbok could not start");
}
