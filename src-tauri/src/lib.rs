//! ABN Launcher (Tauri 2). Arayüz, Expo'nun web çıktısı (dist/) olarak yüklenir; hangi pencerede
//! ne gösterileceğine pencere etiketi karar verir (lib/desktop.ts → windowLabel):
//!   splash  → public/splash.html (TV açılışı, güncelleme denetimi)
//!   main    → launcher (ana sayfa, oyunlar, indirmeler, ayarlar)
//!   merkez  → ABN Merkez (1440×900)
//!   fikir   → hızlı fikir (Ctrl+Shift+Space)
//!   hata    → oyun içinden bug bildirme (F8, bugreport.rs)

mod bugreport;
mod games;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, WindowEvent};

const MAIN: &str = "main";
const SPLASH: &str = "splash";
const MERKEZ: &str = "merkez";
const FIKIR: &str = "fikir";
/// ABN bildirim kartlarının penceresi (kendi tasarımımız; Windows'un standart bildirimi kullanılmaz).
const BILDIRIM: &str = "bildirim";
/// Bildirim penceresinin genişliği (mantıksal px): 360 px kart + iki yanda 16 px boşluk.
const BILDIRIM_W: f64 = 392.0;
const TRAY: &str = "abn";
/// Açılış penceresi bir sebeple kendini kapatamazsa ana pencere en geç bu süre sonunda açılır.
const SPLASH_TIMEOUT: Duration = Duration::from_secs(90);

/// Uygulama genelindeki küçük durum.
#[derive(Default)]
struct Flags {
    /// Kapat butonu launcher'ı tepsiye indirir (Ayarlar → "Kapatınca tepsiye indir").
    close_to_tray: AtomicBool,
    /// Tepsi menüsündeki "Sessiz mod": Windows bildirimleri gösterilmez.
    quiet: AtomicBool,
    /// Gerçekten çıkılıyor (tepsiden "Çıkış"): kapatma isteği engellenmez.
    quitting: AtomicBool,
}

// ── Pencereler ──

/// Windows açılışında (--autostart) ya da gizli başlatıldığında hiçbir pencere açılmaz; launcher tepside bekler.
fn started_quietly() -> bool {
    std::env::args().any(|a| a == "--autostart" || a == "--hidden")
}

fn show_main(app: &AppHandle, animate: bool) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
        if animate {
            let _ = main.emit("launcher://app-in", ());
        }
    }
}

fn main_visible(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

/// splash.html kapanış animasyonunun (lwOff, 0.55 sn) 450. ms'sinde çağırır:
/// ana pencere açılır, açılış penceresi animasyon bitince kapanır.
#[tauri::command]
fn splash_finished(app: AppHandle) {
    show_main(&app, true);
    if let Some(splash) = app.get_webview_window(SPLASH) {
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            let _ = splash.close();
        });
    }
}

/// ABN Merkez penceresini açar ya da öne getirir. `path` verilirse o sayfaya gider (ör. "/akis").
fn open_merkez_window(app: &AppHandle, path: Option<String>) -> tauri::Result<()> {
    let path = path.filter(|p| p.starts_with('/'));
    if let Some(w) = app.get_webview_window(MERKEZ) {
        w.show()?;
        w.unminimize()?;
        w.set_focus()?;
        if let Some(p) = path {
            w.emit("merkez://navigate", p)?;
        }
        return Ok(());
    }
    // Başlangıç sayfası pencereye script ile verilir (dist/ tek sayfa; alt yollar dosya olarak yok).
    let start = serde_json::to_string(&path.unwrap_or_default()).unwrap_or_else(|_| "\"\"".into());
    WebviewWindowBuilder::new(app, MERKEZ, WebviewUrl::App("index.html".into()))
        .title("ABN Merkez")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1000.0, 680.0)
        .center()
        .initialization_script(&format!("window.__ABN_START__ = {start};"))
        .build()?;
    let _ = app.emit("merkez://state", serde_json::json!({ "open": true }));
    Ok(())
}

/// Async olmak zorunda: Windows'ta senkron komut içinde pencere oluşturmak ana iş parçacığını kilitler
/// (pencere bembeyaz kalır, hiçbir buton çalışmaz). Launcher 1.0.0'daki hata buydu.
#[tauri::command]
async fn open_merkez(app: AppHandle, path: Option<String>) -> Result<(), String> {
    open_merkez_window(&app, path).map_err(|e| e.to_string())
}

#[tauri::command]
fn merkez_is_open(app: AppHandle) -> bool {
    app.get_webview_window(MERKEZ).is_some()
}

/// Ctrl+Shift+Space: her yerden açılan küçük "hızlı fikir" penceresi.
fn open_quick_idea(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(FIKIR) {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.emit("fikir://focus", ());
        return;
    }
    let _ = WebviewWindowBuilder::new(app, FIKIR, WebviewUrl::App("index.html".into()))
        .title("Hızlı fikir")
        .inner_size(560.0, 176.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .focused(true)
        .build();
}

#[tauri::command]
fn set_close_to_tray(app: AppHandle, enabled: bool) {
    app.state::<Flags>().close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn quiet_mode(app: AppHandle) -> bool {
    app.state::<Flags>().quiet.load(Ordering::Relaxed)
}

fn quit(app: &AppHandle) {
    app.state::<Flags>().quitting.store(true, Ordering::Relaxed);
    app.exit(0);
}

// ── Bildirim penceresi ──
//
// Çerçevesiz, şeffaf, her zaman üstte, görev çubuğunda yok, odak çalmaz. Uygulama açılırken bir kez
// oluşturulur ve hep yaşar: Realtime dinlemesi bu pencerede çalışır, launcher ve Merkez kapalıyken de.
// "Gizli" durumda ekran dışına alınır (Windows'ta göster/gizle pencereyi öne alıp odağı çalabiliyor).

fn create_notification_window(app: &AppHandle) -> tauri::Result<()> {
    if app.get_webview_window(BILDIRIM).is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(app, BILDIRIM, WebviewUrl::App("index.html".into()))
        .title("ABN bildirimleri")
        .inner_size(BILDIRIM_W, 10.0)
        .position(-20000.0, -20000.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(true)
        .build()?;
    Ok(())
}

/// Bildirim penceresini içeriğin yüksekliğine göre boyutlar ve ekranın sağ alt (ya da sağ üst) köşesine,
/// görev çubuğunun üstüne yerleştirir. height 0 ise pencere ekran dışına çekilir (gizli).
#[tauri::command]
fn notif_layout(app: AppHandle, height: f64, corner: String) {
    let Some(w) = app.get_webview_window(BILDIRIM) else { return };
    if height <= 0.0 {
        let _ = w.set_position(PhysicalPosition::new(-20000, -20000));
        return;
    }
    let Some(mon) = w.primary_monitor().ok().flatten() else { return };
    let scale = mon.scale_factor();
    let area = mon.work_area();
    let pw = (BILDIRIM_W * scale).round() as i32;
    let ph = (height * scale).round() as i32;
    let x = area.position.x + area.size.width as i32 - pw;
    let y = if corner == "sag-ust" {
        area.position.y
    } else {
        area.position.y + area.size.height as i32 - ph
    };
    let _ = w.set_size(PhysicalSize::new(pw as u32, ph as u32));
    let _ = w.set_position(PhysicalPosition::new(x, y));
}

/// Kart "Yanıtla"ya basılınca pencere odak alır (yazı alanı için).
#[tauri::command]
fn notif_focus(app: AppHandle) {
    if let Some(w) = app.get_webview_window(BILDIRIM) {
        let _ = w.set_focus();
    }
}

// ── Tepsi ──

fn tray_image(unread: bool) -> Option<tauri::image::Image<'static>> {
    let bytes: &'static [u8] = if unread {
        include_bytes!("../icons/tray-dot.png")
    } else {
        include_bytes!("../icons/tray.png")
    };
    tauri::image::Image::from_bytes(bytes).ok()
}

/// Okunmamış bildirim varsa tepsi simgesi noktalı olur.
#[tauri::command]
fn set_tray_unread(app: AppHandle, unread: bool) {
    if let Some(tray) = app.tray_by_id(TRAY) {
        let _ = tray.set_icon(tray_image(unread));
        let _ = tray.set_tooltip(Some(if unread {
            "ABN Launcher · okunmamış bildirim var"
        } else {
            "ABN Launcher"
        }));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let launcher = MenuItem::with_id(app, "launcher", "Launcher'ı aç", true, None::<&str>)?;
    let merkez = MenuItem::with_id(app, "merkez", "Merkez'i aç", true, None::<&str>)?;
    let fikir = MenuItem::with_id(app, "fikir", "Hızlı fikir", true, Some("CmdOrCtrl+Shift+Space"))?;
    let sessiz = CheckMenuItem::with_id(app, "sessiz", "Sessiz mod", true, false, None::<&str>)?;
    let cikis = MenuItem::with_id(app, "cikis", "Çıkış", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&launcher, &merkez, &fikir, &sep1, &sessiz, &sep2, &cikis])?;

    let sessiz_item = sessiz.clone();
    let mut builder = TrayIconBuilder::with_id(TRAY)
        .tooltip("ABN Launcher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "launcher" => show_main(app, false),
            "merkez" => {
                let _ = open_merkez_window(app, None);
            }
            "fikir" => open_quick_idea(app),
            "sessiz" => {
                let on = sessiz_item.is_checked().unwrap_or(false);
                app.state::<Flags>().quiet.store(on, Ordering::Relaxed);
                let _ = app.emit("launcher://quiet", on);
            }
            "cikis" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle(), false);
            }
        });
    if let Some(icon) = tray_image(false) {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

// ── Windows bildirimleri ──

/// Yorum, kalp, duyuru, görev ataması ve @anma için Windows bildirimi. Tıklayınca Merkez o sayfada açılır.
/// Sessiz saatleri arayüz denetler (profildeki saatler); tepsideki "Sessiz mod" burada denetlenir.
#[tauri::command]
fn notify(app: AppHandle, title: String, body: String, path: Option<String>) {
    if app.state::<Flags>().quiet.load(Ordering::Relaxed) {
        return;
    }
    #[cfg(windows)]
    {
        use tauri_winrt_notification::{Duration as ToastDuration, Toast};
        let id = app.config().identifier.clone();
        let handle = app.clone();
        let _ = Toast::new(&id)
            .title(&title)
            .text1(&body)
            .duration(ToastDuration::Short)
            .on_activated(move |_| {
                let _ = open_merkez_window(&handle, path.clone());
                Ok(())
            })
            .show();
    }
    #[cfg(not(windows))]
    {
        let _ = (title, body, path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // İkinci kez açılırsa (ya da abn:// bağlantısıyla) yeni kopya açılmaz; mevcut launcher öne gelir.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app, false);
        }));
    }

    builder
        .manage(Flags {
            close_to_tray: AtomicBool::new(true),
            ..Default::default()
        })
        .manage(games::Downloads::default())
        .manage(bugreport::BugState::default())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            #[cfg(desktop)]
            {
                handle.plugin(tauri_plugin_updater::Builder::new().build())?;

                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
                let idea = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                handle.plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            if shortcut == &idea {
                                open_quick_idea(app);
                            } else if bugreport::is_bug_shortcut(app, shortcut) {
                                bugreport::on_shortcut(app);
                            }
                        })
                        .build(),
                )?;
                // Kısayol başka bir uygulamada kullanılıyorsa launcher yine açılsın.
                let _ = handle
                    .global_shortcut()
                    .register(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space));

                // abn:// bağlantıları (sihirli bağlantıyla giriş). Kurulumda kayıt yapılır; geliştirirken de kaydet.
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = handle.deep_link().register_all();
            }

            build_tray(&handle)?;
            create_notification_window(&handle)?;

            let splash = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == SPLASH)
                .cloned();

            if started_quietly() {
                // tepside bekle
            } else if let Some(cfg) = splash {
                WebviewWindowBuilder::from_config(&handle, &cfg)?.build()?;
                let h = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(SPLASH_TIMEOUT);
                    if !main_visible(&h) {
                        show_main(&h, false);
                        if let Some(s) = h.get_webview_window(SPLASH) {
                            let _ = s.close();
                        }
                    }
                });
            } else {
                show_main(&handle, false);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();
            match (window.label(), event) {
                // Kapat: ayara göre tepsiye iner ya da uygulama kapanır.
                (MAIN, WindowEvent::CloseRequested { api, .. }) => {
                    let flags = app.state::<Flags>();
                    if flags.close_to_tray.load(Ordering::Relaxed) && !flags.quitting.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        quit(app);
                    }
                }
                // Açılış penceresi elle kapatılırsa (Alt+F4) ana pencere açılsın.
                (SPLASH, WindowEvent::Destroyed) => {
                    if !main_visible(app) {
                        show_main(app, false);
                    }
                }
                (MERKEZ, WindowEvent::Destroyed) => {
                    let _ = app.emit("merkez://state", serde_json::json!({ "open": false }));
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            splash_finished,
            notif_layout,
            notif_focus,
            open_merkez,
            merkez_is_open,
            set_close_to_tray,
            set_tray_unread,
            quiet_mode,
            notify,
            games::games_installed,
            games::game_install,
            games::game_pause,
            games::game_cancel,
            games::game_uninstall,
            games::game_verify,
            games::game_play,
            bugreport::set_bug_key,
            bugreport::bug_info,
            bugreport::bug_shot,
            bugreport::bug_close,
        ])
        .run(tauri::generate_context!())
        .expect("ABN Launcher başlatılamadı");
}
