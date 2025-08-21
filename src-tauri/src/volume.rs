use std::fs;
use std::path::{Path, PathBuf};

/// 返回（或在可写时创建）一个稳定的卷标识。
/// 优先读取根目录下的 `.videovault.volume-id`，不存在且可写时创建一个 UUID。
/// 若不可写或创建失败，则回退到系统级标识。
pub fn get_or_create_volume_key(root: &Path) -> Result<String, String> {
    let id_file = root.join(".videovault.volume-id");

    if let Ok(data) = fs::read_to_string(&id_file) {
        let id = data.trim();
        if !id.is_empty() {
            return Ok(format!("custom:{}", id));
        }
    }

    // 尝试创建自定义卷 ID（如果目录可写）
    if is_dir_writable(root) {
        let uuid = uuid::Uuid::new_v4().to_string();
        if let Err(e) = fs::write(&id_file, &uuid) {
            // 写入失败则继续回退
            eprintln!("写入卷ID文件失败: {}", e);
        } else {
            return Ok(format!("custom:{}", uuid));
        }
    }

    // 回退：使用平台相关的系统标识
    get_system_volume_key(root)
}

fn is_dir_writable(dir: &Path) -> bool {
    let probe = dir.join(".vv.__probe__");
    match fs::write(&probe, b"probe") {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn get_system_volume_key(root: &Path) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::path::Component;
        use std::process::Command;

        // 解析盘符（若有）
        let mut drive_letter: Option<char> = None;
        for comp in root.components() {
            if let Component::Prefix(prefix) = comp {
                if let std::path::Prefix::Disk(letter) = prefix.kind() {
                    drive_letter = Some((b'A' + letter as u8 - 1) as char);
                }
                break;
            }
        }

        let drive = drive_letter.map(|c| format!("{}:", c)).unwrap_or_else(|| "C:".to_string());

        // 调用 `vol X:` 获取卷序列号（兼容稳定版 Rust，无需不稳定 API）
        let output = Command::new("cmd")
            .args(["/C", "vol", &drive])
            .output()
            .map_err(|e| e.to_string())?;

        let serial = if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 典型输出包含 "Volume Serial Number is XXXX-XXXX"
            stdout
                .lines()
                .find_map(|line| {
                    let lower = line.to_lowercase();
                    if lower.contains("serial") {
                        // 提取最后一个以字母数字和 '-' 组成的分段
                        let tokens: Vec<&str> = line.split_whitespace().collect();
                        tokens
                            .iter()
                            .rev()
                            .find(|tok| tok.chars().all(|ch| ch.is_ascii_hexdigit() || ch == '-'))
                            .map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| "UNKNOWN".to_string())
        } else {
            "UNKNOWN".to_string()
        };

        let drive_str = drive_letter.map(|c| c.to_string()).unwrap_or_else(|| "C".into());
        return Ok(format!("win:{}:{}", drive_str, serial));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let md = fs::metadata(root).map_err(|e| e.to_string())?;
        let dev = md.dev();
        let ino = md.ino();
        return Ok(format!("unix:{}:{}", dev, ino));
    }
}

/// 将绝对路径转换为相对于根目录的相对路径。
pub fn to_relative_path(root: &Path, absolute: &Path) -> Result<PathBuf, String> {
    let rel = absolute.strip_prefix(root).map_err(|e| e.to_string())?;
    Ok(rel.to_path_buf())
}


