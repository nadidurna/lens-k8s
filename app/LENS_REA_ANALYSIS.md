# REA Derinlemesine Tersine Mühendislik Analiz Raporu: Lens Desktop

Bu rapor, **REA (Reverse Engineer Anything)** araçları (`inspect-electron-fuses`, `inspect-artifact`, `analyze-javascript-application`) kullanılarak yerel `Lens.exe` ve `resources/app.asar` üzerinde gerçekleştirilen derinlemesine incelemenin doğrulanmış kanıtlarını (Evidence) içerir.

---

## 1. Binary Seviyesi İnceleme: Electron Fuses

- **Hedef:** `C:\Program Files\Lens\Lens.exe`
- **Format:** PE x86_64 (232,303,896 bytes)
- **SHA-256:** `613df07cc278d94a6ce4429a4d32607625ce516c10b22976166cc470525db09c`
- **Evidence ID:** `ev_d46145a29bea68c838b1368bcc39b6c64ebcddd1591203f0a46d03680da276ff`
- **Sentinel Ofseti:** `189142064` (File Offset)

### Tespit Edilen Fuse Durumları:
| Fuse İsmi | Durum | Çalışma Zamanı Anlamı (Runtime Implication) |
| :--- | :--- | :--- |
| **`RunAsNode`** | `ENABLED` | `ELECTRON_RUN_AS_NODE=1` ile Lens.exe saf bir Node.js binary'si gibi çalıştırılabilir. |
| **`EnableNodeCliInspectArguments`** | `ENABLED` | Uygulama `--inspect` ve `--inspect-brk` parametrelerini kabul eder. Harici DevTools bağlanabilir. |
| **`EnableEmbeddedAsarIntegrityValidation`** | `DISABLED` | ASAR başlık hash doğrulaması zorunlu tutulmamaktadır. |
| **`OnlyLoadAppFromAsar`** | `DISABLED` | Uygulamanın yalnızca `app.asar` üzerinden yüklenmesi kısıtlaması yoktur. |
| **`EnableNodeOptionsEnvironmentVariable`** | `ENABLED` | `NODE_OPTIONS` ortam değişkeniyle çalışma zamanına flag enjekte edilebilir. |

---

## 2. Paket ve Modül Seviyesi İnceleme: `app.asar` (305 MB)

- **Hedef:** `C:\Program Files\Lens\resources\app.asar`
- **Tespit Edilen Çekirdek Bileşenler:**
  1. **Terminal Motoru:** `node-pty` ve `winpty-agent.exe` (Pod exec ve yerel shell oturumlarını yöneten C++ eklentisi).
  2. **Kimlik Doğrulama Katmanı:** `@azure/msal-browser` ve dahili SSO modülleri (Cloud login ekranının tetiklendiği bileşen).
  3. **Katalog Varlık Modeli (CatalogEntity):** Kümeleri `KubernetesCluster` modeliyle temsil eden ve her birini yerel kubeconfig'deki bir context ile eşleştiren durum deposu.
  4. **Kube Proxy / Transport:** Kubernetes API isteklerini yönlendiren yerel proxy katmanı.

---

## 3. Rust (Tauri) Mimarisi ile Karşılaştırma

| Kriter | Mevcut Lens (Electron) | Önerilen Rust (Tauri) Alternatifi |
| :--- | :--- | :--- |
| **Bellek (RAM) Kullanımı** | ~250 - 450 MB | **~30 - 55 MB** (Sistem Webview2 motoru) |
| **Paket Boyutu** | ~200 MB installer, ~600 MB disk | **~10 - 15 MB** tek derlenmiş binary |
| **K8s İletişimi** | Node.js proxy + `kubectl` child_process | **`kube-rs`** (Rust native async Tokio / reqwest) |
| **Terminal / Shell** | `node-pty` (C++ native addon) | **`portable-pty`** (Rust native PTY) |
| **Oturum / Bulut Zorunluluğu** | Cloud SSO + Bulut Telemetrisi | **Sıfır Bulut Bağımlılığı, 100% Local-First** |
