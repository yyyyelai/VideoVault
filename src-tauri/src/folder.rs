use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;
use crate::video::VideoInfo;
use chrono::{DateTime, Utc};

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
}

impl FolderManager {
    /// 创建新的文件夹管理器
    pub fn new() -> Self {
        Self {
            root_folders: HashMap::new(),
            directory_trees: HashMap::new(),
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

        let tree = self.build_tree_recursive(&root_folder.path, 0, root_folder.max_depth)?;
        self.directory_trees.insert(root_id.to_string(), tree.clone());
        
        Ok(tree)
    }

    /// 递归构建目录树
    fn build_tree_recursive(
        &self,
        path: &PathBuf,
        current_depth: i32,
        max_depth: i32,
    ) -> Result<DirectoryNode, Box<dyn std::error::Error>> {
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
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let entry_path = entry.path();
                    
                    if entry_path.is_dir() {
                        // 递归构建子目录
                        if let Ok(child_node) = self.build_tree_recursive(&entry_path, current_depth + 1, max_depth) {
                            children.push(child_node);
                        }
                    } else if entry_path.is_file() {
                        // 检查是否为视频文件
                        if let Some(extension) = entry_path.extension() {
                            let ext_str = extension.to_string_lossy().to_lowercase();
                            if ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"].contains(&ext_str.as_str()) {
                                // 创建视频信息
                                if let Ok(video_info) = crate::video::VideoProcessor::new().create_video_info(entry_path.clone()) {
                                    videos.push(video_info);
                                    video_count += 1;
                                    
                                    // 检查是否有对应的封面文件
                                    if let Some(_cover_path) = crate::cover::CoverManager::new().find_cover_for_video(&entry_path) {
                                        cover_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
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
        println!("已清除根文件夹 {} 的目录树缓存", root_id);
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
