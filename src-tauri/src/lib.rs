use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let file_new = MenuItemBuilder::with_id("file_new", "New")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let file_open = MenuItemBuilder::with_id("file_open", "Open…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let file_save = MenuItemBuilder::with_id("file_save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let file_save_as = MenuItemBuilder::with_id("file_save_as", "Save As…")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let file_quit = PredefinedMenuItem::quit(app, Some("Quit Vec"))?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&file_new)
                .item(&file_open)
                .separator()
                .item(&file_save)
                .item(&file_save_as)
                .separator()
                .item(&file_quit)
                .build()?;

            let edit_undo = PredefinedMenuItem::undo(app, None)?;
            let edit_redo = PredefinedMenuItem::redo(app, None)?;
            let edit_cut = PredefinedMenuItem::cut(app, None)?;
            let edit_copy = PredefinedMenuItem::copy(app, None)?;
            let edit_paste = PredefinedMenuItem::paste(app, None)?;
            let edit_select_all = PredefinedMenuItem::select_all(app, None)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&edit_undo)
                .item(&edit_redo)
                .separator()
                .item(&edit_cut)
                .item(&edit_copy)
                .item(&edit_paste)
                .separator()
                .item(&edit_select_all)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            let handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().as_ref();
                match id {
                    "file_new" | "file_open" | "file_save" | "file_save_as" => {
                        let _ = handle.emit("vec://menu", id);
                    }
                    _ => {}
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Vec");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vec");
}
