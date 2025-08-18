use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoverFormat {
    JPG,
    PNG,
    BMP,
    WebP,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverInfo {
    pub path: PathBuf,
    pub name: String,
    pub size: u64,
    pub format: CoverFormat,
    pub dimensions: Option<(u32, u32)>,
    pub associated_video: Option<PathBuf>,
}

pub struct CoverManager {
    /// 封面缓存
    covers: HashMap<PathBuf, CoverInfo>,
    /// 视频到封面的映射
    video_to_cover: HashMap<PathBuf, PathBuf>,
}

impl CoverManager {
    pub fn new() -> Self {
        Self {
            covers: HashMap::new(),
            video_to_cover: HashMap::new(),
        }
    }

    /// 检测图片格式
    pub fn detect_format(&self, path: &Path) -> Option<CoverFormat> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| match ext.to_lowercase().as_str() {
                "jpg" | "jpeg" => Some(CoverFormat::JPG),
                "png" => Some(CoverFormat::PNG),
                "bmp" => Some(CoverFormat::BMP),
                "webp" => Some(CoverFormat::WebP),
                _ => None,
            })
            .flatten()
    }

    /// 检查是否为封面文件
    pub fn is_cover_file(&self, path: &Path) -> bool {
        self.detect_format(path).is_some()
    }

    /// 创建封面信息
    pub fn create_cover_info(&self, path: PathBuf) -> Result<CoverInfo, Box<dyn std::error::Error>> {
        let metadata = fs::metadata(&path)?;
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("未知文件")
            .to_string();
        
        let format = self.detect_format(&path)
            .ok_or("不支持的图片格式")?;

        // TODO: 使用图片库提取尺寸信息
        let dimensions = None;

        Ok(CoverInfo {
            path,
            name,
            size: metadata.len(),
            format,
            dimensions,
            associated_video: None,
        })
    }

    /// 查找关联的视频文件
    pub fn find_associated_video(&self, cover_path: &Path) -> Option<PathBuf> {
        let cover_name = cover_path.file_stem()?;
        let cover_dir = cover_path.parent()?;
        
        // 查找同名的视频文件
        let video_extensions = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"];
        
        for ext in &video_extensions {
            let video_name = format!("{}.{}", cover_name.to_str()?, ext);
            let video_path = cover_dir.join(&video_name);
            if video_path.exists() {
                return Some(video_path);
            }
        }
        
        None
    }

    /// 扫描目录中的封面文件
    pub fn scan_covers(&mut self, dir_path: &PathBuf) -> Result<Vec<CoverInfo>, Box<dyn std::error::Error>> {
        let mut covers = Vec::new();
        
        if let Ok(entries) = fs::read_dir(dir_path) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    if path.is_file() && self.is_cover_file(&path) {
                        if let Ok(cover_info) = self.create_cover_info(path.clone()) {
                            // 查找关联的视频文件
                            let mut cover_info = cover_info;
                            cover_info.associated_video = self.find_associated_video(&path);
                            
                            // 更新缓存
                            self.covers.insert(path.clone(), cover_info.clone());
                            
                            // 如果找到关联视频，更新映射
                            if let Some(ref video_path) = cover_info.associated_video {
                                self.video_to_cover.insert(video_path.clone(), path);
                            }
                            
                            covers.push(cover_info);
                        }
                    }
                }
            }
        }
        
        Ok(covers)
    }

    /// 获取封面信息
    pub fn get_cover(&self, path: &PathBuf) -> Option<&CoverInfo> {
        self.covers.get(path)
    }

    /// 获取所有封面
    pub fn get_all_covers(&self) -> Vec<&CoverInfo> {
        self.covers.values().collect()
    }

    /// 根据视频路径查找封面
    pub fn find_cover_for_video(&self, video_path: &PathBuf) -> Option<&CoverInfo> {
        self.video_to_cover.get(video_path)
            .and_then(|cover_path| self.covers.get(cover_path))
    }

    /// 检查封面文件是否存在
    pub fn cover_exists(&self, cover_path: &PathBuf) -> bool {
        cover_path.exists() && self.is_cover_file(cover_path)
    }

    /// 获取视频的封面路径
    pub fn get_video_cover_path(&self, video_path: &PathBuf) -> Option<PathBuf> {
        
        // 首先检查缓存
        if let Some(cover_path) = self.video_to_cover.get(video_path) {
            if self.cover_exists(cover_path) {
                return Some(cover_path.clone());
            } else {
            }
        }
        
        // 如果缓存中没有，尝试查找
        let video_name = video_path.file_stem()?;
        let video_dir = video_path.parent()?;
                
        let cover_extensions = ["jpg", "jpeg", "png", "bmp", "webp"];
        
        for ext in &cover_extensions {
            let cover_name = format!("{}.{}", video_name.to_str()?, ext);
            let cover_path = video_dir.join(&cover_name);
            
            if self.cover_exists(&cover_path) {
                return Some(cover_path);
            }
        }
        
        None
    }

    /// 清除缓存
    pub fn clear_cache(&mut self) {
        self.covers.clear();
        self.video_to_cover.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_detect_format() {
        let manager = CoverManager::new();
        
        assert!(matches!(
            manager.detect_format(&PathBuf::from("cover.jpg")),
            Some(CoverFormat::JPG)
        ));
        assert!(matches!(
            manager.detect_format(&PathBuf::from("poster.png")),
            Some(CoverFormat::PNG)
        ));
        assert!(matches!(
            manager.detect_format(&PathBuf::from("thumb.bmp")),
            Some(CoverFormat::BMP)
        ));
    }

    #[test]
    fn test_is_cover_file() {
        let manager = CoverManager::new();
        
        assert!(manager.is_cover_file(&PathBuf::from("cover.jpg")));
        assert!(manager.is_cover_file(&PathBuf::from("poster.png")));
        assert!(manager.is_cover_file(&PathBuf::from("thumb.bmp")));
        assert!(!manager.is_cover_file(&PathBuf::from("video.mp4")));
        assert!(!manager.is_cover_file(&PathBuf::from("document.pdf")));
    }
}
