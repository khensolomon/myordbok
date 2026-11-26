//! A web page in a sheet over the app, for signing in without leaving it.
//!
//! On iOS the sheet is Apple's ASWebAuthenticationSession (ios/Sources): the
//! system's own sign-in sheet, which shares Safari's sign-ins and asks the
//! reader first. Elsewhere the commands answer an error, and the page opens
//! the address in the browser instead (app/platform/tauri/boot.js).
//!
//!   open  { url, callbackScheme }  resolves when the sheet closes: with the
//!         address it ended on (a callbackScheme address), or closed: "cancelled"
//!   close                          closes the sheet, should one be open
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_web_sheet);

/// The iOS side, once registered (none on Android).
#[cfg(mobile)]
struct Sheet<R: Runtime>(Option<tauri::plugin::PluginHandle<R>>);

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenArgs {
    url: String,
    callback_scheme: String,
}

/// How the sheet closed: "callback" (with the address) or "cancelled".
#[derive(Deserialize, Serialize)]
pub struct Closed {
    closed: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
}

#[tauri::command]
async fn open<R: Runtime>(app: tauri::AppHandle<R>, url: String, callback_scheme: String) -> Result<Closed, String> {
    #[cfg(mobile)]
    {
        use tauri::Manager;
        if let Some(handle) = app.state::<Sheet<R>>().0.as_ref() {
            return handle
                .run_mobile_plugin_async::<Closed>("open", OpenArgs { url, callback_scheme })
                .await
                .map_err(|e| e.to_string());
        }
    }
    let _ = (app, url, callback_scheme);
    Err("No sign-in sheet on this platform".into())
}

#[tauri::command]
async fn close<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(mobile)]
    {
        use tauri::Manager;
        if let Some(handle) = app.state::<Sheet<R>>().0.as_ref() {
            return handle
                .run_mobile_plugin_async::<serde_json::Value>("close", ())
                .await
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
    }
    let _ = app;
    Ok(())
}

/// The plugin, as `.plugin(tauri_plugin_web_sheet::init())`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("web-sheet")
        .invoke_handler(tauri::generate_handler![open, close])
        .setup(|_app, _api| {
            #[cfg(mobile)]
            {
                use tauri::Manager;
                #[cfg(target_os = "ios")]
                let handle = Some(_api.register_ios_plugin(init_plugin_web_sheet)?);
                #[cfg(not(target_os = "ios"))]
                let handle = None;
                _app.manage(Sheet::<R>(handle));
            }
            Ok(())
        })
        .build()
}
