use tauri::{command, generate_context, generate_handler, Builder, WebviewWindow};

#[command]
fn set_float_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 300.0,
            height: 400.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn set_main_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 900.0,
            height: 600.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_decorations(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(generate_handler![set_float_mode, set_main_mode])
        .run(generate_context!())
        .expect("error while running tauri application");
}
