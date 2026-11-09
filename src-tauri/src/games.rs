//! ABN oyunlarının kurulumu: zip parça parça iner (duraklatılıp kaldığı yerden sürer), sha256 ile
//! doğrulanır, kurulum klasörüne çıkarılır, kurulu sürüm <kurulum klasörü>/.abn/installed.json'a yazılır.
//! İlerleme arayüze "game://progress" olayıyla gelir (lib/launcher/games.ts).

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// games.json'daki bir oyun (sadece kurulum için gereken alanlar).
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct Game {
    pub id: String,
    pub ad: String,
    pub surum: String,
    pub zip: String,
    #[serde(default)]
    pub boyut: u64,
    #[serde(default)]
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileEntry {
    path: String,
    size: u64,
    crc32: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Record {
    version: String,
    dir: String,
    #[serde(default)]
    files: Vec<FileEntry>,
}

#[derive(Serialize, Clone)]
pub struct Installed {
    version: String,
    dir: String,
}

#[derive(Serialize, Clone, Default)]
struct Progress {
    id: String,
    phase: &'static str,
    received: u64,
    total: u64,
    speed: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

const RUN: u8 = 0;
const PAUSE: u8 = 1;
const CANCEL: u8 = 2;

/// Süren indirmeler: oyun kimliği → durdurma işareti.
#[derive(Default)]
pub struct Downloads(Mutex<HashMap<String, Arc<AtomicU8>>>);

fn meta_dir(install_dir: &Path) -> PathBuf {
    install_dir.join(".abn")
}

fn registry_path(install_dir: &Path) -> PathBuf {
    meta_dir(install_dir).join("installed.json")
}

fn read_registry(install_dir: &Path) -> HashMap<String, Record> {
    fs::read_to_string(registry_path(install_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_registry(install_dir: &Path, reg: &HashMap<String, Record>) -> Result<(), String> {
    fs::create_dir_all(meta_dir(install_dir)).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(reg).map_err(|e| e.to_string())?;
    fs::write(registry_path(install_dir), json).map_err(|e| e.to_string())
}

/// Oyun kimliği klasör adı olarak kullanılır; dışarı çıkan ya da garip karakterli kimlik kabul edilmez.
fn safe_id(id: &str) -> Result<&str, String> {
    if !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        Ok(id)
    } else {
        Err("Geçersiz oyun kimliği.".into())
    }
}

fn emit(app: &AppHandle, p: Progress) {
    let _ = app.emit("game://progress", p);
}

fn fail(app: &AppHandle, id: &str, msg: impl Into<String>) {
    emit(app, Progress { id: id.into(), phase: "hata", error: Some(msg.into()), ..Default::default() });
}

#[tauri::command]
pub fn games_installed(install_dir: String) -> HashMap<String, Installed> {
    read_registry(Path::new(&install_dir))
        .into_iter()
        .map(|(id, r)| (id, Installed { version: r.version, dir: r.dir }))
        .collect()
}

/// İndirmeyi başlatır ya da kaldığı yerden sürdürür. Hemen döner; ilerleme olayla gelir.
#[tauri::command]
pub fn game_install(app: AppHandle, game: Game, install_dir: String) -> Result<(), String> {
    safe_id(&game.id)?;
    if game.zip.is_empty() {
        return Err("Bu oyunun indirme adresi yok.".into());
    }
    let flag = Arc::new(AtomicU8::new(RUN));
    {
        let downloads = app.state::<Downloads>();
        let mut map = downloads.0.lock().unwrap();
        if let Some(old) = map.get(&game.id) {
            if old.load(Ordering::Relaxed) == RUN {
                return Ok(()); // zaten iniyor
            }
        }
        map.insert(game.id.clone(), flag.clone());
    }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let id = game.id.clone();
        if let Err(e) = run_install(&handle, &game, Path::new(&install_dir), &flag).await {
            fail(&handle, &id, e);
        }
        let downloads = handle.state::<Downloads>();
        let mut map = downloads.0.lock().unwrap();
        if map.get(&id).map(|f| Arc::ptr_eq(f, &flag)).unwrap_or(false) {
            map.remove(&id);
        }
    });
    Ok(())
}

async fn run_install(app: &AppHandle, game: &Game, install_dir: &Path, flag: &AtomicU8) -> Result<(), String> {
    let dl_dir = meta_dir(install_dir).join("indirilenler");
    fs::create_dir_all(&dl_dir).map_err(|e| format!("Kurulum klasörüne yazılamadı: {e}"))?;
    let part = dl_dir.join(format!("{}-{}.zip.part", game.id, game.surum));

    // ── 1 · indir (Range ile kaldığı yerden) ──
    let mut have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    let client = reqwest::Client::builder()
        .user_agent("ABN Launcher")
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.get(&game.zip);
    if have > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={have}-"));
    }
    let res = req.send().await.map_err(|_| "Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!("İndirme başlatılamadı (HTTP {}).", status.as_u16()));
    }
    // Sunucu kaldığı yerden vermediyse (200) baştan başla.
    let resumed = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if !resumed {
        have = 0;
    }
    let total = if resumed {
        have + res.content_length().unwrap_or(0)
    } else {
        res.content_length().unwrap_or(game.boyut)
    };
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(resumed)
        .truncate(!resumed)
        .open(&part)
        .map_err(|e| e.to_string())?;

    let mut stream = res.bytes_stream();
    let mut received = have;
    let mut last = Instant::now();
    let mut last_bytes = received;
    let mut speed = 0.0;
    while let Some(chunk) = stream.next().await {
        match flag.load(Ordering::Relaxed) {
            PAUSE => {
                emit(app, Progress { id: game.id.clone(), phase: "duraklatildi", received, total, ..Default::default() });
                return Ok(());
            }
            CANCEL => {
                drop(file);
                let _ = fs::remove_file(&part);
                return Ok(());
            }
            _ => {}
        }
        let chunk = chunk.map_err(|_| "Bağlantı koptu. Kaldığı yerden devam ettirebilirsin.".to_string())?;
        file.write_all(&chunk).map_err(|e| format!("Diske yazılamadı: {e}"))?;
        received += chunk.len() as u64;
        let dt = last.elapsed().as_secs_f64();
        if dt >= 0.25 {
            let now = (received - last_bytes) as f64 / dt;
            speed = if speed == 0.0 { now } else { speed * 0.6 + now * 0.4 };
            last = Instant::now();
            last_bytes = received;
            emit(app, Progress { id: game.id.clone(), phase: "indiriliyor", received, total, speed, ..Default::default() });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    // ── 2 · doğrula ──
    emit(app, Progress { id: game.id.clone(), phase: "dogrulaniyor", received, total, ..Default::default() });
    if !game.sha256.is_empty() {
        let p = part.clone();
        let sum = tauri::async_runtime::spawn_blocking(move || sha256_file(&p))
            .await
            .map_err(|e| e.to_string())??;
        if !sum.eq_ignore_ascii_case(game.sha256.trim()) {
            let _ = fs::remove_file(&part);
            return Err("İndirilen dosya doğrulanamadı. Tekrar indirmeyi dene.".into());
        }
    }

    // ── 3 · çıkar ──
    emit(app, Progress { id: game.id.clone(), phase: "cikariliyor", received: total, total, ..Default::default() });
    let target = install_dir.join(&game.id);
    let (zip_path, dest) = (part.clone(), target.clone());
    let files = tauri::async_runtime::spawn_blocking(move || extract(&zip_path, &dest))
        .await
        .map_err(|e| e.to_string())??;
    let _ = fs::remove_file(&part);

    // ── 4 · kaydet ──
    let mut reg = read_registry(install_dir);
    let dir = target.to_string_lossy().to_string();
    reg.insert(game.id.clone(), Record { version: game.surum.clone(), dir: dir.clone(), files });
    write_registry(install_dir, &reg)?;
    emit(
        app,
        Progress { id: game.id.clone(), phase: "bitti", received: total, total, version: Some(game.surum.clone()), dir: Some(dir), ..Default::default() },
    );
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Zip'i önce geçici klasöre açar, sonra eski kurulumun yerine koyar (yarım güncelleme kalmasın).
fn extract(zip_path: &Path, dest: &Path) -> Result<Vec<FileEntry>, String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|_| "Zip dosyası açılamadı.".to_string())?;
    let tmp = dest.with_extension("yeni");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        // Zip içinden klasör dışına çıkan yollar (../) atlanır.
        let Some(rel) = entry.enclosed_name().map(|p| p.to_path_buf()) else { continue };
        let out = tmp.join(&rel);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut w = File::create(&out).map_err(|e| format!("Dosya yazılamadı: {e}"))?;
        std::io::copy(&mut entry, &mut w).map_err(|e| format!("Dosya yazılamadı: {e}"))?;
        files.push(FileEntry { path: rel.to_string_lossy().replace('\\', "/"), size: entry.size(), crc32: entry.crc32() });
    }
    if dest.exists() {
        fs::remove_dir_all(dest).map_err(|e| format!("Eski sürüm kaldırılamadı (oyun açık olabilir): {e}"))?;
    }
    fs::rename(&tmp, dest).map_err(|e| e.to_string())?;
    Ok(files)
}

#[tauri::command]
pub fn game_pause(app: AppHandle, id: String) {
    if let Some(f) = app.state::<Downloads>().0.lock().unwrap().get(&id) {
        f.store(PAUSE, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn game_cancel(app: AppHandle, id: String, install_dir: String) -> Result<(), String> {
    safe_id(&id)?;
    let active = app.state::<Downloads>().0.lock().unwrap().remove(&id);
    match active {
        Some(f) => f.store(CANCEL, Ordering::Relaxed),
        None => {
            // Duraklatılmış indirmenin yarım dosyasını sil.
            let dir = meta_dir(Path::new(&install_dir)).join("indirilenler");
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.flatten() {
                    if e.file_name().to_string_lossy().starts_with(&format!("{id}-")) {
                        let _ = fs::remove_file(e.path());
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn game_uninstall(id: String, install_dir: String) -> Result<(), String> {
    safe_id(&id)?;
    let base = Path::new(&install_dir);
    let mut reg = read_registry(base);
    let dir = base.join(&id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("Kaldırılamadı (oyun açık olabilir): {e}"))?;
    }
    reg.remove(&id);
    write_registry(base, &reg)
}

/// Kurulumda kaydedilen dosya listesine göre denetler: her dosya var mı, boyutu ve CRC32'si tutuyor mu.
#[tauri::command]
pub async fn game_verify(id: String, install_dir: String) -> Result<bool, String> {
    safe_id(&id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let reg = read_registry(Path::new(&install_dir));
        let Some(rec) = reg.get(&id) else { return Ok(false) };
        let dir = PathBuf::from(&rec.dir);
        for f in &rec.files {
            let p = dir.join(&f.path);
            let Ok(meta) = fs::metadata(&p) else { return Ok(false) };
            if meta.len() != f.size {
                return Ok(false);
            }
            let mut file = File::open(&p).map_err(|e| e.to_string())?;
            let mut h = crc32fast::Hasher::new();
            let mut buf = vec![0u8; 1 << 20];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                h.update(&buf[..n]);
            }
            if h.finalize() != f.crc32 {
                return Ok(false);
            }
        }
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Oyunu başlatır; launcher tepsiye iner, oyun kapanınca geri gelir.
#[tauri::command]
pub fn game_play(app: AppHandle, id: String, exe: String, install_dir: String) -> Result<(), String> {
    safe_id(&id)?;
    let reg = read_registry(Path::new(&install_dir));
    let dir = reg
        .get(&id)
        .map(|r| PathBuf::from(&r.dir))
        .ok_or_else(|| "Oyun kurulu görünmüyor.".to_string())?;
    let rel = Path::new(&exe);
    if exe.is_empty() || rel.is_absolute() || exe.contains("..") {
        return Err("Oyunun çalıştırılacak dosyası tanımlı değil.".into());
    }
    let path = dir.join(rel);
    if !path.exists() {
        return Err("Oyunun dosyası bulunamadı. Doğrula ya da yeniden indir.".into());
    }
    let mut child = std::process::Command::new(&path)
        .current_dir(&dir)
        .spawn()
        .map_err(|e| format!("Oyun başlatılamadı: {e}"))?;
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        let _ = child.wait();
        let _ = handle.emit("game://exited", serde_json::json!({ "id": id }));
        if let Some(main) = handle.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
    });
    Ok(())
}
