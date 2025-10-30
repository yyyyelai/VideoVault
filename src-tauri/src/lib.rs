pub mod video;
mod cover;
mod volume;
mod folder;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use crate::folder::{FolderManager, RootFolder, DirectoryNode};
use crate::video::VideoInfo;
use crate::cover::CoverInfo;

// 全局状态结构
pub struct AppState {
    folder_manager: Mutex<FolderManager>,
    cover_manager: Mutex<crate::cover::CoverManager>,
}

impl AppState {
    fn new() -> Self {
        Self {
            folder_manager: Mutex::new(FolderManager::new()),
            cover_manager: Mutex::new(crate::cover::CoverManager::new()),
        }
    }
}

// Tauri命令：添加根文件夹
#[tauri::command]
fn add_root_folder(state: State<AppState>, path: String, name: Option<String>) -> Result<String, String> {
    println!("添加根文件夹: {} (名称: {:?})", path, name);
    
    let absolute_path = if path.starts_with('/') {
        PathBuf::from(path)
    } else {
        std::env::current_dir().unwrap().join(path)
    };
    
    if !absolute_path.exists() {
        return Err("路径不存在".to_string());
    }
    
    if !absolute_path.is_dir() {
        return Err("路径不是目录".to_string());
    }
    
    let mut folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    let result = folder_manager.add_root_folder(absolute_path, name);
    Ok(result)
}

// 根据卷标识与标准化路径生成幂等 rootId（UUID v5）
fn generate_deterministic_root_id(root_path: &PathBuf) -> Result<String, String> {
    let norm = root_path
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    let vol = crate::volume::get_or_create_volume_key(root_path)
        .map_err(|e| format!("无法获取卷标识: {}", e))?;
    let key = format!("{}::{}", vol, norm);
    let uuid = uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL, key.as_bytes());
    Ok(uuid.to_string())
}

// Tauri命令：添加根文件夹（幂等ID版本）
#[tauri::command]
fn add_root_folder_deterministic(state: State<AppState>, path: String, name: Option<String>) -> Result<String, String> {
    let absolute_path = if path.starts_with('/') { PathBuf::from(path) } else { std::env::current_dir().unwrap().join(path) };
    if !absolute_path.exists() { return Err("路径不存在".into()); }
    if !absolute_path.is_dir() { return Err("路径不是目录".into()); }

    let mut folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    let id = generate_deterministic_root_id(&absolute_path)?;
    let result = folder_manager.add_root_folder_with_id(id, absolute_path, name);
    Ok(result)
}

// Tauri命令：移除根文件夹
#[tauri::command]
fn remove_root_folder(state: State<AppState>, id: String) -> Result<bool, String> {
    println!("移除根文件夹: {}", id);
    let mut folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    Ok(folder_manager.remove_root_folder(&id))
}

// Tauri命令：获取所有根文件夹
#[tauri::command]
fn get_root_folders(state: State<AppState>) -> Result<Vec<RootFolder>, String> {
    println!("获取根文件夹列表");
    let folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    Ok(folder_manager.get_all_root_folders())
}

// Tauri命令：扫描目录
#[tauri::command]
fn scan_directory(state: State<AppState>, root_id: String) -> Result<DirectoryNode, String> {
    println!("开始扫描目录，root_id: {}", root_id);
    
    let mut folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    let mut cover_manager = state.cover_manager.lock().map_err(|_| "无法获取封面管理器锁".to_string())?;
    
    // 从根目录开始扫描
    if let Some(root_folder) = folder_manager.get_root_folder(&root_id) {
        
        // 先扫描封面文件
        if let Err(e) = cover_manager.scan_covers(&root_folder.path) {
            println!("扫描封面文件失败: {}", e);
        } else {
            println!("封面文件扫描完成");
        }
        
        // 构建目录树
        match folder_manager.build_directory_tree(&root_id) {
            Ok(directory_tree) => {
                Ok(directory_tree)
            }
            Err(e) => {
                println!("构建目录树失败: {}", e);
                Err(format!("构建目录树失败: {}", e))
            }
        }
    } else {
        println!("未找到根文件夹: {}", root_id);
        Err("未找到根文件夹".to_string())
    }
}

// Tauri命令：获取目录树
#[tauri::command]
fn get_directory_tree(state: State<AppState>, root_id: String) -> Result<Option<DirectoryNode>, String> {
    let folder_manager = state.folder_manager.lock().map_err(|_| "无法获取文件夹管理器锁".to_string())?;
    Ok(folder_manager.get_directory_tree(&root_id).cloned())
}

// Tauri命令：获取视频信息
#[tauri::command]
fn get_video_info(video_path: String) -> Result<VideoInfo, String> {
    println!("获取视频信息: {}", video_path);
    let video_processor = crate::video::VideoProcessor::new();
    let path = PathBuf::from(video_path);
    video_processor.create_video_info(path)
        .map_err(|e| e.to_string())
}

// Tauri命令：获取封面信息
#[tauri::command]
fn get_cover_info(state: State<AppState>, cover_path: String) -> Result<CoverInfo, String> {
    let cover_manager = state.cover_manager.lock().map_err(|_| "无法获取封面管理器锁".to_string())?;
    let path = PathBuf::from(cover_path);
    cover_manager.get_cover(&path)
        .cloned()
        .ok_or_else(|| "封面不存在".to_string())
}

// Tauri命令：播放视频
#[tauri::command]
fn open_video(path: String) -> Result<(), String> {
    use std::process::Command;
    
    let output = if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(&path)
            .output()
    } else if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", "start", &path])
            .output()
    } else {
        Command::new("xdg-open")
            .arg(&path)
            .output()
    };

    match output {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("无法打开视频文件: {}", e))
    }
}

// Tauri命令：执行系统命令
#[tauri::command]
fn execute_command(command: String, args: Vec<String>) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new(&command)
        .args(&args)
        .output();

    match output {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("执行命令失败: {}", e))
    }
}

// Tauri命令：查找视频的封面
#[tauri::command]
fn find_cover_for_video(state: State<AppState>, video_path: String) -> Result<Option<String>, String> {
    
    let path = PathBuf::from(&video_path);
    let cover_manager = state.cover_manager.lock().map_err(|_| "无法获取封面管理器锁".to_string())?;
    
    // 使用动态查找方法，不依赖缓存
    match cover_manager.get_video_cover_path(&path) {
        Some(cover_path) => {
            Ok(Some(cover_path.to_string_lossy().to_string()))
        }
        None => {
            println!("❌ 未找到封面");
            Ok(None)
        }
    }
}

// Tauri命令：获取绝对路径
#[tauri::command]
fn get_absolute_path(relative_path: String) -> Result<String, String> {
    use std::env;
    
    // 获取当前工作目录
    let current_dir = env::current_dir()
        .map_err(|e| format!("无法获取当前目录: {}", e))?;
    
    // 构建绝对路径
    let absolute_path = current_dir.join(&relative_path);
    
    // 转换为字符串
    absolute_path
        .to_str()
        .ok_or("路径包含无效字符".to_string())
        .map(|s| s.to_string())
}

// Tauri命令：获取卷标识（稳定）
#[tauri::command]
fn get_volume_key(state: State<AppState>, root_id: String) -> Result<String, String> {
    let folder_manager = state
        .folder_manager
        .lock()
        .map_err(|_| "无法获取文件夹管理器锁".to_string())?;

    let root = folder_manager
        .get_root_folder(&root_id)
        .ok_or("根文件夹不存在".to_string())?;

    crate::volume::get_or_create_volume_key(&root.path)
}

// Tauri命令：获取相对路径
#[tauri::command]
fn to_relative_path(state: State<AppState>, root_id: String, absolute_path: String) -> Result<String, String> {
    let folder_manager = state
        .folder_manager
        .lock()
        .map_err(|_| "无法获取文件夹管理器锁".to_string())?;

    let root = folder_manager
        .get_root_folder(&root_id)
        .ok_or("根文件夹不存在".to_string())?;

    let abs = PathBuf::from(absolute_path);
    let rel = crate::volume::to_relative_path(&root.path, &abs)?;
    rel.to_str()
        .ok_or("路径包含无效字符".to_string())
        .map(|s| s.to_string())
}

// Tauri命令：读取图片文件并返回base64数据
#[tauri::command]
fn read_image_as_base64(image_path: String) -> Result<String, String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose};
    
    let path = std::path::Path::new(&image_path);
    
    // 检查文件是否存在
    if !path.exists() {
        return Err(format!("图片文件不存在: {}", image_path));
    }
    
    // 读取文件内容
    let file_content = fs::read(path)
        .map_err(|e| format!("读取图片文件失败: {}", e))?;
    
    // 获取文件扩展名
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("unknown");
    
    // 确定MIME类型
    let mime_type = match extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        _ => "image/jpeg", // 默认
    };
    
    // 转换为base64
    let base64_data = general_purpose::STANDARD.encode(&file_content);
    
    // 返回data URL格式
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

// Tauri命令：检查文件是否存在
#[tauri::command]
fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::PathBuf;
    
    // 将路径转换为 PathBuf 以便规范化
    let file_path = PathBuf::from(&path);
    
    // 尝试规范化路径（解析 .. 和 . 等符号）
    let canonical_path = match file_path.canonicalize() {
        Ok(p) => p,
        Err(e) => {
            // 如果规范化失败（比如文件不存在），直接检查原始路径
            println!("[check_file_exists] 路径规范化失败: {}, 错误: {}", path, e);
            return Ok(false);
        }
    };
    
    // 检查是否为文件
    let is_file = canonical_path.is_file();
    
    println!("[check_file_exists] 路径: {} -> 规范化: {} -> 是文件: {}", 
             path, canonical_path.display(), is_file);
    
    Ok(is_file)
}

#[tauri::command]
async fn rescan_directory(state: tauri::State<'_, AppState>, root_id: String) -> Result<(), String> {
    let mut folder_manager = state.folder_manager.lock()
        .map_err(|_| "无法获取文件夹管理器锁")?;
    
    // 获取根文件夹信息
    let root_folder = folder_manager.get_root_folder(&root_id)
        .ok_or("根文件夹不存在")?;
    
    println!("重新扫描根文件夹: {} ({})", root_folder.name, root_folder.path.display());
    
    // 清除旧的目录树缓存
    folder_manager.clear_directory_tree(&root_id);
    
    Ok(())
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .output()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::path::PathBuf;
        
        // 规范化路径：将字符串转换为 PathBuf，然后转换回字符串
        // 这样可以确保路径使用 Windows 格式（反斜杠）
        let path_buf = PathBuf::from(&path);
        let normalized_path = path_buf
            .canonicalize()
            .unwrap_or_else(|_| path_buf)
            .to_string_lossy()
            .replace('/', "\\"); // 确保使用反斜杠
        
        Command::new("explorer")
            .arg(&normalized_path)
            .output()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .output()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_root_folder,
            add_root_folder_deterministic,
            remove_root_folder,
            get_root_folders,
            scan_directory,
            get_directory_tree,
            get_video_info,
            get_cover_info,
            open_video,
            execute_command,
            find_cover_for_video,
            get_absolute_path,
            get_volume_key,
            to_relative_path,
            read_image_as_base64,
            check_file_exists,
            rescan_directory,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
