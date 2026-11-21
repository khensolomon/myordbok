// The desktop binary; iOS and Android start from lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    myordbok_lib::run()
}
