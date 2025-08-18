use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::video::VideoInfo;
use chrono::{DateTime, Utc};
use rayon::prelude::*;

/// 并行扫描配置
#[derive(Debug, Clone)]
pub struct ParallelScanConfig {
    /// 最大线程数（0表示使用CPU核心数）
    pub max_threads: usize,
    /// 每个目录最大文件数限制
    pub max_files_per_dir: usize,
    /// 最大扫描深度
    pub max_depth: i32,
    /// 是否启用并行扫描
    pub enabled: bool,
}

impl Default for ParallelScanConfig {
    fn default() -> Self {
        Self {
            max_threads: num_cpus::get(),
            max_files_per_dir: 10000,
            max_depth: 100,
            enabled: true,
        }
    }
}

/// 根文件夹配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootFolder {
    /// 文件夹ID
    pub id: String,
    /// 文件夹路径
    pub path: PathBuf,
    /// 文件夹名称
    pub name: String,
    /// 是否启用
    pub enabled: bool,
    /// 扫描深度限制（-1表示无限制）
    pub max_depth: i32,
    /// 最后扫描时间
    pub last_scan: Option<DateTime<Utc>>,
}

/// 目录树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryNode {
    /// 节点名称
    pub name: String,
    /// 节点路径
    pub path: String,
    /// 是否为目录
    pub is_directory: bool,
    /// 子节点（文件夹和视频文件）
    pub children: Vec<DirectoryNode>,
    /// 当前目录下的视频文件（不包含子目录的视频）
    pub videos: Vec<VideoInfo>,
    /// 当前目录下的封面文件数量
    pub cover_count: usize,
    /// 当前目录下的视频文件数量
    pub video_count: usize,
    /// 当前目录的代表性封面路径（来自第一个子节点或视频）
    pub cover_path: Option<PathBuf>,
}

/// 文件夹管理器
pub struct FolderManager {
    /// 根文件夹列表
    root_folders: HashMap<String, RootFolder>,
    /// 目录树缓存
    directory_trees: HashMap<String, DirectoryNode>,
    /// 并行扫描配置
    parallel_config: ParallelScanConfig,
}

impl FolderManager {
    /// 创建新的文件夹管理器
    pub fn new() -> Self {
        Self {
            root_folders: HashMap::new(),
            directory_trees: HashMap::new(),
            parallel_config: ParallelScanConfig::default(),
        }
    }

    /// 创建空的目录节点
    fn create_empty_directory_node(&self, path: &PathBuf) -> DirectoryNode {
        DirectoryNode {
            path: path.to_string_lossy().to_string(),
            name: path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            is_directory: true,
            children: Vec::new(),
            videos: Vec::new(),
            cover_count: 0,
            video_count: 0,
            cover_path: None,
        }
    }

    /// 创建目录节点
    fn create_directory_node(
        &self,
        path: &PathBuf,
        children: Vec<DirectoryNode>,
        videos: Vec<VideoInfo>,
        cover_count: usize,
        video_count: usize,
        cover_path: Option<PathBuf>,
    ) -> DirectoryNode {
        DirectoryNode {
            path: path.to_string_lossy().to_string(),
            name: path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            is_directory: true,
            children,
            videos,
            cover_count,
            video_count,
            cover_path,
        }
    }

    /// 添加根文件夹
    pub fn add_root_folder(&mut self, path: PathBuf, name: Option<String>) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let folder_name = name.unwrap_or_else(|| {
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });

        let root_folder = RootFolder {
            id: id.clone(),
            path,
            name: folder_name,
            enabled: true,
            max_depth: -1,
            last_scan: None,
        };

        self.root_folders.insert(id.clone(), root_folder);
        id
    }

    /// 移除根文件夹
    pub fn remove_root_folder(&mut self, id: &str) -> bool {
        self.root_folders.remove(id).is_some()
    }

    /// 获取根文件夹
    pub fn get_root_folder(&self, id: &str) -> Option<&RootFolder> {
        self.root_folders.get(id)
    }

    /// 获取所有根文件夹
    pub fn get_all_root_folders(&self) -> Vec<RootFolder> {
        self.root_folders.values().cloned().collect()
    }

    /// 启用/禁用根文件夹
    pub fn set_folder_enabled(&mut self, id: &str, enabled: bool) -> bool {
        if let Some(folder) = self.root_folders.get_mut(id) {
            folder.enabled = enabled;
            true
        } else {
            false
        }
    }

    /// 设置扫描深度限制
    pub fn set_max_depth(&mut self, id: &str, max_depth: i32) -> bool {
        if let Some(folder) = self.root_folders.get_mut(id) {
            folder.max_depth = max_depth;
            true
        } else {
            false
        }
    }

    /// 构建目录树
    pub fn build_directory_tree(&mut self, root_id: &str) -> Result<DirectoryNode, Box<dyn std::error::Error>> {
        let root_folder = self.get_root_folder(root_id)
            .ok_or("根文件夹不存在")?;

        if !root_folder.enabled {
            return Err("根文件夹已禁用".into());
        }

        let tree = if self.parallel_config.enabled {
            // 日志：并行扫描信息
            println!(
                "[FolderManager] 并行扫描已启用，rayon 线程池大小: {}，根目录: {}",
                rayon::current_num_threads(),
                root_folder.path.display()
            );
            self.build_tree_recursive_parallel(&root_folder.path, 0, root_folder.max_depth)?
        } else {
            self.build_tree_recursive(&root_folder.path, 0, root_folder.max_depth)?
        };
        
        self.directory_trees.insert(root_id.to_string(), tree.clone());
        
        Ok(tree)
    }

    /// 并行构建目录树
    pub fn build_tree_recursive_parallel(
        &self,
        path: &PathBuf,
        current_depth: i32,
        max_depth: i32,
    ) -> Result<DirectoryNode, Box<dyn std::error::Error>> {
        // 安全检查：防止无限递归
        if current_depth > self.parallel_config.max_depth {
            return Ok(self.create_empty_directory_node(path));
        }
        
        // 如果达到最大深度，只返回当前目录信息
        if max_depth >= 0 && current_depth >= max_depth {
            return Ok(self.create_empty_directory_node(path));
        }

        // 收集目录条目
        let entries = self.scan_directory_entries(path)?;
        
        // 分离文件和目录
        let (files, subdirs): (Vec<_>, Vec<_>) = entries
            .into_iter()
            .partition(|entry| {
                if let Ok(metadata) = entry.metadata() {
                    metadata.is_file()
                } else {
                    false
                }
            });

        // 并行处理视频文件
        let videos = self.process_video_files_parallel(&files);
        let video_count = videos.len();

        // 并行扫描子目录
        let children = self.scan_subdirectories_parallel(&subdirs, current_depth + 1, max_depth);

        // 计算总的视频和封面数量
        let total_video_count = video_count + children.iter().map(|c| c.video_count).sum::<usize>();
        let total_cover_count = children.iter().map(|c| c.cover_count).sum::<usize>();

        // 确定当前目录的封面路径
        let cover_path = if !videos.is_empty() {
            crate::cover::CoverManager::new().find_cover_for_video(&videos[0].path)
                .map(|cover_info| cover_info.path.clone())
        } else if !children.is_empty() {
            self.find_first_cover_in_children(&children)
        } else {
            None
        };

        Ok(self.create_directory_node(
            path,
            children,
            videos,
            total_cover_count,
            total_video_count,
            cover_path,
        ))
    }

    /// 扫描目录条目
    fn scan_directory_entries(&self, path: &PathBuf) -> Result<Vec<std::fs::DirEntry>, Box<dyn std::error::Error>> {
        let mut entries = Vec::new();
        
        match std::fs::read_dir(path) {
            Ok(read_dir) => {
                for entry in read_dir {
                    match entry {
                        Ok(entry) => {
                            if entries.len() >= self.parallel_config.max_files_per_dir {
                                break;
                            }
                            entries.push(entry);
                        }
                        Err(_) => {
                            // 忽略无法读取的条目
                            continue;
                        }
                    }
                }
            }
            Err(_) => {
                // 如果标准方法失败，尝试使用系统命令
                entries = self.scan_directory_entries_fallback(path)?;
            }
        }
        
        Ok(entries)
    }

    /// 备用目录扫描方法（使用系统命令）
    fn scan_directory_entries_fallback(&self, path: &PathBuf) -> Result<Vec<std::fs::DirEntry>, Box<dyn std::error::Error>> {
        use std::process::Command;
        
        let output = Command::new("ls")
            .arg("-la")
            .arg(path.to_string_lossy().as_ref())
            .output()?;
            
        if !output.status.success() {
            return Ok(Vec::new());
        }
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let mut entries = Vec::new();
        
        for line in output_str.lines().skip(1) {
            if entries.len() >= self.parallel_config.max_files_per_dir {
                break;
            }
            
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 9 {
                let filename = parts[8..].join(" ");
                if filename != "." && filename != ".." {
                    let file_path = path.join(&filename);
                    // 尝试读取目录来创建 DirEntry
                    if let Ok(read_dir) = std::fs::read_dir(path) {
                        for entry in read_dir {
                            if let Ok(entry) = entry {
                                if entry.path() == file_path {
                                    entries.push(entry);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(entries)
    }

    /// 并行处理视频文件
    fn process_video_files_parallel(&self, files: &[std::fs::DirEntry]) -> Vec<VideoInfo> {
        let video_extensions = ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"];
        
        files
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();
                    if video_extensions.contains(&ext_str.as_str()) {
                        crate::video::VideoProcessor::new()
                            .create_video_info(path)
                            .ok()
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect()
    }

    /// 并行扫描子目录
    fn scan_subdirectories_parallel(
        &self,
        subdirs: &[std::fs::DirEntry],
        current_depth: i32,
        max_depth: i32,
    ) -> Vec<DirectoryNode> {
        let results: Arc<Mutex<Vec<DirectoryNode>>> = Arc::new(Mutex::new(Vec::new()));
        
        // 使用 rayon 的线程池来并行处理子目录
        rayon::scope(|s| {
            for subdir in subdirs {
                let results = Arc::clone(&results);
                let subdir_path = subdir.path();
                let depth_for_log = current_depth;
                
                s.spawn(move |_| {
                    // 仅在顶层子目录打印，避免日志过多
                    if depth_for_log == 1 {
                        let thread = std::thread::current();
                        println!(
                            "[FolderManager] 扫描子目录(depth=1): {} 在线程: {:?} (name={})",
                            subdir_path.display(),
                            thread.id(),
                            thread.name().unwrap_or("unnamed")
                        );
                    }
                    if let Ok(child_node) = self.build_tree_recursive_parallel(&subdir_path, current_depth, max_depth) {
                        if let Ok(mut results) = results.lock() {
                            results.push(child_node);
                        }
                    }
                });
            }
        });
        
        // 安全地提取结果
        match Arc::try_unwrap(results) {
            Ok(mutex) => {
                match mutex.into_inner() {
                    Ok(vec) => vec,
                    Err(_) => Vec::new(),
                }
            }
            Err(arc) => {
                match arc.lock() {
                    Ok(mutex) => mutex.clone(),
                    Err(_) => Vec::new(),
                }
            }
        }
    }

    /// 递归构建目录树
    fn build_tree_recursive(
        &self,
        path: &PathBuf,
        current_depth: i32,
        max_depth: i32,
    ) -> Result<DirectoryNode, Box<dyn std::error::Error>> {
        // 安全检查：防止无限递归
        if current_depth > 100 {
            return Ok(DirectoryNode {
                path: path.to_string_lossy().to_string(),
                name: path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                is_directory: true,
                children: Vec::new(),
                videos: Vec::new(),
                cover_count: 0,
                video_count: 0,
                cover_path: None,
            });
        }
        
        // 如果达到最大深度，只返回当前目录信息
        if max_depth >= 0 && current_depth >= max_depth {
            return Ok(DirectoryNode {
                path: path.to_string_lossy().to_string(),
                name: path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                is_directory: true,
                children: Vec::new(),
                videos: Vec::new(),
                cover_count: 0,
                video_count: 0,
                cover_path: None,
            });
        }

        let mut children = Vec::new();
        let mut videos = Vec::new();
        let mut cover_count = 0;
        let mut video_count = 0;

        // 读取目录内容
        let entries_result = std::fs::read_dir(path);
        match entries_result {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(entry) => {
                            let entry_path = entry.path();
                            
                            if entry_path.is_dir() {
                                // 递归构建子目录
                                match self.build_tree_recursive(&entry_path, current_depth + 1, max_depth) {
                                    Ok(child_node) => {
                                        children.push(child_node);
                                    }
                                    Err(e) => {
                                        // 即使子目录失败，也创建一个空的目录节点，避免完全跳过
                                        let empty_node = DirectoryNode {
                                            path: entry_path.to_string_lossy().to_string(),
                                            name: entry_path.file_name()
                                                .and_then(|n| n.to_str())
                                                .unwrap_or("Unknown")
                                                .to_string(),
                                            is_directory: true,
                                            children: Vec::new(),
                                            videos: Vec::new(),
                                            cover_count: 0,
                                            video_count: 0,
                                            cover_path: None,
                                        };
                                        children.push(empty_node);
                                    }
                                }
                            } else if entry_path.is_file() {
                                // 检查是否为视频文件
                                if let Some(extension) = entry_path.extension() {
                                    let ext_str = extension.to_string_lossy().to_lowercase();
                                    if ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"].contains(&ext_str.as_str()) {
                                        // 创建视频信息
                                        match crate::video::VideoProcessor::new().create_video_info(entry_path.clone()) {
                                            Ok(video_info) => {
                                                videos.push(video_info);
                                                video_count += 1;
                                                
                                                // 检查是否有对应的封面文件
                                                if let Some(_cover_path) = crate::cover::CoverManager::new().find_cover_for_video(&entry_path) {
                                                    cover_count += 1;
                                                }
                                            }
                                            Err(e) => {
                                                // 静默处理错误
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            // 尝试使用系统命令读取目录
                            use std::process::Command;
                            
                            if let Ok(output) = Command::new("ls")
                                .arg("-la")
                                .arg(path.to_string_lossy().as_ref())
                                .output() {
                                if output.status.success() {
                                    let output_str = String::from_utf8_lossy(&output.stdout);
                                    
                                    // 解析系统命令输出，提取文件和目录信息
                                    let mut fallback_videos = Vec::new();
                                    let mut fallback_children = Vec::new();
                                    
                                    let mut line_count = 0;
                                    let max_lines = 10000; // 限制最大行数，防止内存溢出
                                    let max_videos = 1000; // 限制最大视频数量
                                    let max_children = 1000; // 限制最大子目录数量
                                    
                                    for line in output_str.lines().skip(1) { // 跳过第一行 "total ..."
                                        line_count += 1;
                                        if line_count > max_lines {
                                            break;
                                        }
                                        
                                        if line.starts_with('-') {
                                            // 这是一个文件
                                            // 使用更智能的文件名提取方法
                                            let parts: Vec<&str> = line.split_whitespace().collect();
                                            if parts.len() >= 9 { // ls -la 输出至少有9列
                                                let filename = parts[8..].join(" "); // 第9列开始是文件名
                                                
                                                if filename.contains('.') {
                                                    let ext = filename.split('.').last().unwrap_or("").to_lowercase();
                                                    if ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"].contains(&ext.as_str()) {
                                                        if fallback_videos.len() >= max_videos {
                                                            continue;
                                                        }
                                                        let file_path = path.join(&filename);
                                                        if let Ok(video_info) = crate::video::VideoProcessor::new().create_video_info(file_path) {
                                                            fallback_videos.push(video_info);
                                                            video_count += 1;
                                                        }
                                                    }
                                                }
                                            }
                                        } else if line.starts_with('d') {
                                            // 这是一个目录
                                            let parts: Vec<&str> = line.split_whitespace().collect();
                                            if parts.len() >= 9 {
                                                let dirname = parts[8..].join(" ");
                                                if dirname != "." && dirname != ".." {
                                                    if fallback_children.len() >= max_children {
                                                        continue;
                                                    }
                                                    let dir_path = path.join(&dirname);
                                                    // 递归构建子目录
                                                    if let Ok(child_node) = self.build_tree_recursive(&dir_path, current_depth + 1, max_depth) {
                                                        fallback_children.push(child_node);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    // 使用备用方案的结果
                                    children.extend(fallback_children);
                                    videos.extend(fallback_videos);
                                } else {
                                    let error_str = String::from_utf8_lossy(&output.stderr);
                                    // 静默处理错误
                                }
                            } else {
                                // 静默处理错误
                            }
                        }
                    }
                }
            }
            Err(e) => {
                // 尝试使用系统命令读取目录
                use std::process::Command;
                
                if let Ok(output) = Command::new("ls")
                    .arg("-la")
                    .arg(path.to_string_lossy().as_ref())
                    .output() {
                    if output.status.success() {
                        let output_str = String::from_utf8_lossy(&output.stdout);
                        // 静默处理成功
                    } else {
                        let error_str = String::from_utf8_lossy(&output.stderr);
                        // 静默处理错误
                    }
                } else {
                    // 静默处理错误
                }
                
                // 即使目录读取失败，也返回一个空的目录节点
                return Ok(DirectoryNode {
                    path: path.to_string_lossy().to_string(),
                    name: path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    is_directory: true,
                    children: Vec::new(),
                    videos: Vec::new(),
                    cover_count: 0,
                    video_count: 0,
                    cover_path: None,
                });
            }
        }

        // 计算总的视频和封面数量（包括子目录）
        let total_video_count = video_count + children.iter().map(|c| c.video_count).sum::<usize>();
        let total_cover_count = cover_count + children.iter().map(|c| c.cover_count).sum::<usize>();

        // 确定当前目录的封面路径
        let cover_path = if !videos.is_empty() {
            // 如果当前目录有视频，使用第一个视频的封面
            crate::cover::CoverManager::new().find_cover_for_video(&videos[0].path)
                .map(|cover_info| cover_info.path.clone())
        } else if !children.is_empty() {
            // 否则递归查找子目录中的第一个封面
            self.find_first_cover_in_children(&children)
        } else {
            None
        };

        Ok(DirectoryNode {
            path: path.to_string_lossy().to_string(),
            name: path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            is_directory: true,
            children,
            videos,
            cover_count: total_cover_count,
            video_count: total_video_count,
            cover_path,
        })
    }

    /// 在子目录中查找第一个封面
    fn find_first_cover_in_children(&self, children: &[DirectoryNode]) -> Option<PathBuf> {
        // 按顺序遍历子目录，找到第一个有封面的
        for child in children {
            if let Some(cover_path) = &child.cover_path {
                return Some(cover_path.clone());
            }
            
            // 如果当前子目录没有封面，递归查找其子目录
            if !child.children.is_empty() {
                if let Some(cover_path) = self.find_first_cover_in_children(&child.children) {
                    return Some(cover_path);
                }
            }
        }
        None
    }

    /// 获取目录树
    pub fn get_directory_tree(&self, root_id: &str) -> Option<&DirectoryNode> {
        self.directory_trees.get(root_id)
    }

    /// 清除目录树缓存
    pub fn clear_directory_tree(&mut self, root_id: &str) {
        self.directory_trees.remove(root_id);
        // 已清除根文件夹的目录树缓存
    }

    /// 清除目录树缓存
    pub fn clear_cache(&mut self) {
        self.directory_trees.clear();
    }

    /// 更新最后扫描时间
    pub fn update_scan_time(&mut self, root_id: &str) -> bool {
        if let Some(folder) = self.root_folders.get_mut(root_id) {
            folder.last_scan = Some(Utc::now());
            true
        } else {
            false
        }
    }

    /// 获取并行扫描配置
    pub fn get_parallel_config(&self) -> &ParallelScanConfig {
        &self.parallel_config
    }

    /// 更新并行扫描配置
    pub fn update_parallel_config(&mut self, config: ParallelScanConfig) {
        self.parallel_config = config;
    }

    /// 设置最大线程数
    pub fn set_max_threads(&mut self, max_threads: usize) {
        self.parallel_config.max_threads = if max_threads == 0 {
            num_cpus::get()
        } else {
            max_threads
        };
    }

    /// 设置每个目录最大文件数限制
    pub fn set_max_files_per_dir(&mut self, max_files: usize) {
        self.parallel_config.max_files_per_dir = max_files;
    }

    /// 设置最大扫描深度
    pub fn set_max_scan_depth(&mut self, max_depth: i32) {
        self.parallel_config.max_depth = max_depth;
    }

    /// 启用/禁用并行扫描
    pub fn set_parallel_scan_enabled(&mut self, enabled: bool) {
        self.parallel_config.enabled = enabled;
    }

    /// 强制使用并行扫描构建目录树
    pub fn build_directory_tree_parallel(&mut self, root_id: &str) -> Result<DirectoryNode, Box<dyn std::error::Error>> {
        let root_folder = self.get_root_folder(root_id)
            .ok_or("根文件夹不存在")?;

        if !root_folder.enabled {
            return Err("根文件夹已禁用".into());
        }

        let tree = self.build_tree_recursive_parallel(&root_folder.path, 0, root_folder.max_depth)?;
        self.directory_trees.insert(root_id.to_string(), tree.clone());
        
        Ok(tree)
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_add_root_folder() {
        let mut manager = FolderManager::new();
        let temp_dir = std::env::temp_dir();
        
        let id = manager.add_root_folder(temp_dir.clone(), Some("Test Folder".to_string()));
        let folder = manager.get_root_folder(&id);
        assert!(folder.is_some());
        assert_eq!(folder.unwrap().name, "Test Folder");
    }

    #[test]
    fn test_remove_root_folder() {
        let mut manager = FolderManager::new();
        let temp_dir = std::env::temp_dir();
        
        let id = manager.add_root_folder(temp_dir, None);
        assert!(manager.remove_root_folder(&id));
        assert!(manager.get_root_folder(&id).is_none());
    }
}
