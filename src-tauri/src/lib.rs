/// The desktop shell is a window around the same bundle the phone installs.
/// No trading logic lives here, and no Tauri command can reach the engine —
/// the web layer talks to the API directly so both platforms behave identically.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Pangea");
}
