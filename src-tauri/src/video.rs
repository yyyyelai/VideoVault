use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use std::fs::File;
use std::io::Read;

/// 视频文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    /// 文件路径
    pub path: PathBuf,
    /// 文件名
    pub name: String,
    /// 文件大小（字节）
    pub size: u64,
    /// 视频时长
    pub duration: Option<Duration>,
    /// 视频分辨率
    pub resolution: Option<(u32, u32)>,
    /// 视频编码格式
    pub codec: Option<String>,
    /// 音频编码格式
    pub audio_codec: Option<String>,
    /// 文件创建时间
    pub created_time: Option<std::time::SystemTime>,
    /// 文件修改时间
    pub modified_time: Option<std::time::SystemTime>,
}

/// 视频文件处理器
pub struct VideoProcessor;

impl VideoProcessor {
    /// 创建新的视频处理器实例
    pub fn new() -> Self {
        Self
    }

    /// 检查文件是否为视频文件
    pub fn is_video_file(&self, path: &PathBuf) -> bool {
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy().to_lowercase();
            let is_video = matches!(
                ext.as_str(),
                "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "3gp"
            );
            if is_video {
                println!("文件 {} 是视频文件 (扩展名: {})", path.display(), ext);
            }
            is_video
        } else {
            println!("文件 {} 没有扩展名", path.display());
            false
        }
    }

    /// 智能解析视频文件头获取元数据
    fn get_video_metadata(&self, path: &PathBuf) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        let mut file = match File::open(path) {
            Ok(file) => file,
            Err(e) => {
                println!("无法打开文件 {}: {}", path.display(), e);
                return None;
            }
        };

        let mut buffer = [0u8; 2048]; // 读取前 2KB 来检查文件头
        let bytes_read = match file.read(&mut buffer) {
            Ok(n) => n,
            Err(e) => {
                println!("读取文件头失败: {}", e);
                return None;
            }
        };

        if bytes_read < 16 {
            return None;
        }

        // 根据文件扩展名选择解析策略
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "mp4" | "m4v" | "mov" => self.parse_mp4_header(&buffer[..bytes_read]),
                "avi" => self.parse_avi_header(&buffer[..bytes_read]),
                "mkv" => self.parse_mkv_header(&buffer[..bytes_read]),
                "flv" => self.parse_flv_header(&buffer[..bytes_read]),
                "webm" => self.parse_webm_header(&buffer[..bytes_read]),
                _ => self.parse_generic_header(&buffer[..bytes_read], &ext_str),
            }
        } else {
            self.parse_generic_header(&buffer[..bytes_read], "unknown")
        }
    }

    /// 解析 MP4/MOV 文件头
    fn parse_mp4_header(&self, buffer: &[u8]) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        // 查找 ftyp box (文件类型)
        let mut offset = 0;
        while offset + 8 <= buffer.len() {
            let size = u32::from_be_bytes([buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]]);
            let box_type = &buffer[offset + 4..offset + 8];
            
            if box_type == b"ftyp" {
                // 找到文件类型，尝试获取更多信息
                let codec = if offset + 12 <= buffer.len() {
                    let major_brand = &buffer[offset + 8..offset + 12];
                    String::from_utf8_lossy(major_brand).to_string()
                } else {
                    "mp4".to_string()
                };
                
                return Some((None, None, Some(codec), None));
            }
            
            if size == 0 || size > buffer.len() as u32 {
                break;
            }
            offset += size as usize;
        }
        
        Some((None, None, Some("mp4".to_string()), None))
    }

    /// 解析 AVI 文件头
    fn parse_avi_header(&self, buffer: &[u8]) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        if buffer.len() < 16 && &buffer[0..4] == b"RIFF" && &buffer[8..12] == b"AVI " {
            // 尝试从 AVI 头中读取分辨率
            let mut resolution = None;
            if buffer.len() >= 64 {
                let width = u32::from_le_bytes([buffer[60], buffer[61], buffer[62], buffer[63]]);
                let height = u32::from_le_bytes([buffer[64], buffer[65], buffer[66], buffer[67]]);
                if width > 0 && width < 10000 && height > 0 && height < 10000 {
                    resolution = Some((width, height));
                }
            }
            
            return Some((None, resolution, Some("avi".to_string()), None));
        }
        
        Some((None, None, Some("avi".to_string()), None))
    }

    /// 解析 MKV 文件头
    fn parse_mkv_header(&self, buffer: &[u8]) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        if buffer.len() >= 4 && &buffer[0..4] == b"\x1a\x45\xdf\xa3" {
            return Some((None, None, Some("mkv".to_string()), None));
        }
        
        Some((None, None, Some("mkv".to_string()), None))
    }

    /// 解析 FLV 文件头
    fn parse_flv_header(&self, buffer: &[u8]) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        if buffer.len() >= 9 && &buffer[0..3] == b"FLV" {
            return Some((None, None, Some("flv".to_string()), None));
        }
        
        Some((None, None, Some("flv".to_string()), None))
    }

    /// 解析 WebM 文件头
    fn parse_webm_header(&self, buffer: &[u8]) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        if buffer.len() >= 4 && &buffer[0..4] == b"\x1a\x45\xdf\xa3" {
            return Some((None, None, Some("webm".to_string()), None));
        }
        
        Some((None, None, Some("webm".to_string()), None))
    }

    /// 解析通用文件头
    fn parse_generic_header(&self, buffer: &[u8], extension: &str) -> Option<(Option<Duration>, Option<(u32, u32)>, Option<String>, Option<String>)> {
        // 尝试识别常见的视频文件头
        if buffer.len() >= 8 {
            if &buffer[0..4] == b"ftyp" || &buffer[4..8] == b"ftyp" {
                return Some((None, None, Some("mp4".to_string()), None));
            } else if &buffer[0..4] == b"RIFF" && buffer.len() >= 12 && &buffer[8..12] == b"AVI " {
                return Some((None, None, Some("avi".to_string()), None));
            } else if &buffer[0..4] == b"\x1a\x45\xdf\xa3" {
                return Some((None, None, Some("mkv".to_string()), None));
            } else if &buffer[0..3] == b"FLV" {
                return Some((None, None, Some("flv".to_string()), None));
            }
        }
        
        // 如果无法识别，返回扩展名作为格式
        Some((None, None, Some(extension.to_string()), None))
    }

    /// 从文件路径创建视频信息
    pub fn create_video_info(&self, path: PathBuf) -> Result<VideoInfo, Box<dyn std::error::Error>> {
        let metadata = std::fs::metadata(&path)?;
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // 使用智能文件头解析获取视频元数据
        let (duration, resolution, codec, audio_codec) = self.get_video_metadata(&path)
            .unwrap_or((None, None, None, None));

        println!("视频 {} 的元数据: 时长={:?}, 分辨率={:?}, 编码={:?}, 音频编码={:?}", 
                 name, duration, resolution, codec, audio_codec);

        Ok(VideoInfo {
            path,
            name,
            size: metadata.len(),
            duration,
            resolution,
            codec,
            audio_codec,
            created_time: metadata.created().ok(),
            modified_time: metadata.modified().ok(),
        })
    }

    /// 扫描目录中的视频文件
    pub fn scan_directory(&self, dir_path: &PathBuf) -> Result<Vec<VideoInfo>, Box<dyn std::error::Error>> {
        println!("开始扫描目录: {}", dir_path.display());
        let mut videos = Vec::new();
        
        if dir_path.is_dir() {
            println!("目录存在，开始读取内容...");
            match std::fs::read_dir(dir_path) {
                Ok(entries) => {
                    println!("成功读取目录内容");
                    for entry in entries {
                        match entry {
                            Ok(entry) => {
                                let path = entry.path();
                                println!("检查路径: {}", path.display());
                                
                                if path.is_file() && self.is_video_file(&path) {
                                    println!("发现视频文件: {}", path.display());
                                    match self.create_video_info(path) {
                                        Ok(video_info) => {
                                            videos.push(video_info);
                                            println!("成功创建视频信息");
                                        }
                                        Err(e) => {
                                            println!("创建视频信息失败: {}", e);
                                        }
                                    }
                                } else if path.is_dir() {
                                    println!("发现子目录: {}", path.display());
                                    // 递归扫描子目录
                                    match self.scan_directory(&path) {
                                        Ok(sub_videos) => {
                                            let sub_count = sub_videos.len();
                                            videos.extend(sub_videos);
                                            println!("子目录扫描完成，找到 {} 个视频", sub_count);
                                        }
                                        Err(e) => {
                                            println!("子目录扫描失败: {}", e);
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                println!("读取目录条目失败: {}", e);
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("读取目录失败: {}", e);
                    return Err(Box::new(e));
                }
            }
        } else {
            println!("路径不是目录: {}", dir_path.display());
            return Err("路径不是目录".into());
        }
        
        println!("目录扫描完成，找到 {} 个视频", videos.len());
        Ok(videos)
    }

    /// 获取视频文件的缩略图路径
    pub fn get_thumbnail_path(&self, video_path: &PathBuf) -> Option<PathBuf> {
        let mut thumbnail_path = video_path.clone();
        thumbnail_path.set_extension("jpg");
        
        if thumbnail_path.exists() {
            return Some(thumbnail_path);
        }
        
        // 尝试其他格式
        for ext in ["png", "bmp", "webp"] {
            thumbnail_path.set_extension(ext);
            if thumbnail_path.exists() {
                return Some(thumbnail_path);
            }
        }
        
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_is_video_file() {
        let processor = VideoProcessor::new();
        
        assert!(processor.is_video_file(&PathBuf::from("video.mp4")));
        assert!(processor.is_video_file(&PathBuf::from("movie.avi")));
        assert!(processor.is_video_file(&PathBuf::from("show.mkv")));
        assert!(!processor.is_video_file(&PathBuf::from("image.jpg")));
        assert!(!processor.is_video_file(&PathBuf::from("document.pdf")));
    }

    #[test]
    fn test_create_video_info() {
        let processor = VideoProcessor::new();
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_video.mp4");
        
        // 创建一个测试文件
        std::fs::write(&test_file, b"fake video content").unwrap();
        
        let video_info = processor.create_video_info(test_file.clone()).unwrap();
        
        assert_eq!(video_info.name, "test_video.mp4");
        assert_eq!(video_info.path, test_file);
        assert!(video_info.size > 0);
        
        // 清理测试文件
        let _ = std::fs::remove_file(test_file);
    }
}
