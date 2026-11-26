//! The MyOrdbok app: the web app's own files (dist/tauri, from
//! `node scripts/build.js --target tauri --api …`) in a web view, with the
//! plugins the pages call through `window.__TAURI__`:
//!
//! - http: requests to the API, made natively (app/platform/tauri/http.js);
//! - opener: links that leave the app, in the system browser
//!   (app/platform/tauri/boot.js);
//! - haptics: a light tap felt on the tabs and the buttons that keep
//!   something (app/platform/tauri/boot.js); nothing on a computer.
//! - iap: the store's payments (App Store, Google Play) for supporting
//!   MyOrdbok, and what the store account bought before
//!   (app/core/support.js); nothing is unlocked by them.
//!
//! On iOS the web view's own swipe from the edge goes back through the
//! pages, as in Safari: the pages keep their history with pushState
//! (app/core/router.js), which the web view follows. As in an iOS app, the
//! first page of a tab has nothing to go back to: the pages turn the swipe
//! off there and on again elsewhere (`back_swipe`, from
//! app/platform/tauri/boot.js). Android's back gesture and button go back
//! by themselves (wry's WryActivity).

/// The web view's back swipe, on or off (iOS; elsewhere nothing to do).
#[tauri::command]
fn back_swipe(webview: tauri::Webview, on: bool) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    webview
        .with_webview(move |inner| {
            let view = inner.inner().cast::<objc2::runtime::AnyObject>();
            unsafe {
                let _: () = objc2::msg_send![&*view, setAllowsBackForwardNavigationGestures: on];
            }
        })
        .map_err(|err| err.to_string())?;
    #[cfg(not(target_os = "ios"))]
    let _ = (webview, on);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_iap::init())
        .plugin(tauri_plugin_web_sheet::init())
        .invoke_handler(tauri::generate_handler![back_swipe])
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
