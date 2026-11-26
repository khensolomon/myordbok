//! The plugin's commands, and its iOS side (ios/), for tauri's build.
const COMMANDS: &[&str] = &["open", "close"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).ios_path("ios").build();
}
