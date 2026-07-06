// Ocultar la consola de Windows en builds de release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tortugas_desktop_lib::run();
}
