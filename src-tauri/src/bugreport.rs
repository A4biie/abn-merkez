//! Oyun içinden bug bildirme (Merkez 0.11 bölüm 6).
//! Launcher'dan açılan oyun çalışırken bug kısayolu (varsayılan F8) dinlenir; oyun kapanınca bırakılır,
//! böylece tuş başka uygulamalardan çalınmaz. Basınca: ekranın görüntüsü alınır (önce, pencere açılmadan),
//! sonra küçük "Ne oldu?" penceresi ("hata") açılır. Pencere bilgileri bug_info / bug_shot ile alır ve
//! bildirimi kendisi gönderir (Supabase oturumu webview'de).
//! Ekran görüntüsü ve bilgisayar bilgisi Windows'un kendi araçlarıyla (PowerShell, gizli pencere) alınır.

use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub const HATA: &str = "hata";

#[derive(Default)]
pub struct BugState(pub Mutex<Inner>);

#[derive(Default)]
pub struct Inner {
    game_id: Option<String>,
    game_name: Option<String>,
    version: Option<String>,
    device: Option<String>,
    shot: Option<PathBuf>,
    /// Ayarlardaki kısayol ("F8", "Ctrl+F9" …).
    key: Option<String>,
    /// Şu an kayıtlı kısayol (oyun çalışırken).
    registered: Option<Shortcut>,
}

#[derive(serde::Serialize)]
pub struct BugInfo {
    game_id: Option<String>,
    game_name: Option<String>,
    version: Option<String>,
    device: String,
    has_shot: bool,
}

fn key_of(inner: &Inner) -> String {
    inner.key.clone().unwrap_or_else(|| "F8".into())
}

/// Ayarlardaki "Ctrl+F8" biçimini eklentinin anladığı "Control+F8" biçimine çevirir.
fn parse_key(key: &str) -> Option<Shortcut> {
    let k = key.replace("Ctrl", "Control").replace(' ', "");
    k.parse::<Shortcut>().ok()
}

#[cfg(windows)]
fn hidden(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn hidden(cmd: &mut Command) -> &mut Command {
    cmd
}

fn powershell(script: &str) -> Option<String> {
    let out = hidden(Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", script]))
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// "Windows 11 Pro · NVIDIA GeForce RTX 3060" (bir kez hesaplanır, birkaç yüz ms sürer).
fn device_info() -> String {
    let raw = powershell(
        "$o=(Get-CimInstance Win32_OperatingSystem).Caption; \
         $g=(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name); \
         Write-Output \"$o|$g\"",
    )
    .unwrap_or_default();
    raw.split('|')
        .map(|s| s.trim().trim_start_matches("Microsoft ").to_string())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" · ")
}

/// Ana ekranın görüntüsünü PNG olarak geçici klasöre kaydeder (yüksek DPI'da da tam boyut).
fn capture(path: &PathBuf) -> bool {
    let p = path.to_string_lossy().replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; \
         Add-Type -Name D -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware();'; \
         [W.D]::SetProcessDPIAware() | Out-Null; \
         $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; \
         $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; \
         $g=[System.Drawing.Graphics]::FromImage($bmp); \
         $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); \
         $bmp.Save('{p}',[System.Drawing.Imaging.ImageFormat]::Png); \
         $g.Dispose(); $bmp.Dispose()"
    );
    powershell(&script).is_some() && path.exists()
}

fn register(app: &AppHandle, inner: &mut Inner) {
    if let Some(old) = inner.registered.take() {
        let _ = app.global_shortcut().unregister(old);
    }
    if inner.game_id.is_none() {
        return;
    }
    if let Some(sc) = parse_key(&key_of(inner)) {
        if app.global_shortcut().register(sc).is_ok() {
            inner.registered = Some(sc);
        }
    }
}

/// games::game_play çağırır: oyun açıldı.
pub fn game_started(app: &AppHandle, id: String, name: Option<String>, version: String) {
    let state = app.state::<BugState>();
    let mut inner = state.0.lock().unwrap();
    inner.game_id = Some(id);
    inner.game_name = name;
    inner.version = Some(version);
    register(app, &mut inner);
    // Bilgisayar bilgisini önceden hazırla (F8'de beklemesin).
    if inner.device.is_none() {
        let h = app.clone();
        std::thread::spawn(move || {
            let d = device_info();
            h.state::<BugState>().0.lock().unwrap().device = Some(d);
        });
    }
}

/// Oyun kapandı: kısayol bırakılır.
pub fn game_stopped(app: &AppHandle) {
    let state = app.state::<BugState>();
    let mut inner = state.0.lock().unwrap();
    inner.game_id = None;
    register(app, &mut inner);
}

/// Kısayol basıldı mı? (lib.rs'teki genel kısayol işleyicisi sorar.)
pub fn is_bug_shortcut(app: &AppHandle, sc: &Shortcut) -> bool {
    app.state::<BugState>().0.lock().unwrap().registered.as_ref() == Some(sc)
}

pub fn on_shortcut(app: &AppHandle) {
    if app.get_webview_window(HATA).is_some() {
        if let Some(w) = app.get_webview_window(HATA) {
            let _ = w.set_focus();
        }
        return;
    }
    let h = app.clone();
    std::thread::spawn(move || {
        let path = std::env::temp_dir().join(format!("abn-bug-{}.png", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let ok = capture(&path);
        {
            let state = h.state::<BugState>();
            let mut inner = state.0.lock().unwrap();
            inner.shot = if ok { Some(path) } else { None };
            if inner.device.is_none() {
                inner.device = Some(device_info());
            }
        }
        let h2 = h.clone();
        let _ = h.run_on_main_thread(move || {
            let _ = WebviewWindowBuilder::new(&h2, HATA, WebviewUrl::App("index.html".into()))
                .title("Bug bildir")
                .inner_size(480.0, 470.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .center()
                .focused(true)
                .build();
        });
    });
}

#[tauri::command]
pub fn set_bug_key(app: AppHandle, key: String) -> Result<(), String> {
    if parse_key(&key).is_none() {
        return Err("Bu tuş kullanılamıyor.".into());
    }
    let state = app.state::<BugState>();
    let mut inner = state.0.lock().unwrap();
    inner.key = Some(key);
    register(&app, &mut inner);
    Ok(())
}

#[tauri::command]
pub fn bug_info(app: AppHandle) -> BugInfo {
    let inner = app.state::<BugState>();
    let inner = inner.0.lock().unwrap();
    BugInfo {
        game_id: inner.game_id.clone(),
        game_name: inner.game_name.clone(),
        version: inner.version.clone(),
        device: inner.device.clone().unwrap_or_default(),
        has_shot: inner.shot.is_some(),
    }
}

/// Ekran görüntüsünün baytları (JS'e ArrayBuffer olarak gider).
#[tauri::command]
pub fn bug_shot(app: AppHandle) -> Result<tauri::ipc::Response, String> {
    let path = app.state::<BugState>().0.lock().unwrap().shot.clone();
    let path = path.ok_or_else(|| "Ekran görüntüsü yok.".to_string())?;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Pencere kapandı (gönderildi ya da vazgeçildi): geçici dosya silinir.
#[tauri::command]
pub fn bug_close(app: AppHandle) {
    let path = app.state::<BugState>().0.lock().unwrap().shot.take();
    if let Some(p) = path {
        let _ = std::fs::remove_file(p);
    }
    if let Some(w) = app.get_webview_window(HATA) {
        let _ = w.close();
    }
}
