use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use std::process::Command;
use std::str::FromStr;

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
    /// 容器格式
    pub container_format: Option<String>,
    /// 帧率
    pub frame_rate: Option<f64>,
    /// 比特率
    pub bit_rate: Option<u32>,
}

/// 视频文件处理器
pub struct VideoProcessor;

impl VideoProcessor {
    /// 创建新的视频处理器实例
    pub fn new() -> Self {
        Self
    }

    /// 使用 ffprobe 解析视频元数据
    pub fn get_video_metadata_ffprobe(&self, path: &PathBuf) -> Option<VideoMetadata> {
        let path_str = path.to_string_lossy();
        
        // 构建 ffprobe 命令
        let output = Command::new("ffprobe")
            .args(&[
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                &path_str
            ])
            .output();
        
        let output = match output {
            Ok(output) => output,
            Err(e) => {
                println!("执行 ffprobe 命令失败: {}", e);
                return None;
            }
        };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("ffprobe 命令执行失败: {}", error);
            return None;
        }
        
        let json_str = match String::from_utf8(output.stdout) {
            Ok(s) => s,
            Err(e) => {
                println!("解析 ffprobe 输出失败: {}", e);
                return None;
            }
        };
        
        // 解析 JSON 输出
        let json: serde_json::Value = match serde_json::from_str(&json_str) {
            Ok(v) => v,
            Err(e) => {
                println!("解析 JSON 失败: {}", e);
                return None;
            }
        };
        
        let mut metadata = VideoMetadata::default();
        
        // 从文件扩展名获取容器格式
        if let Some(ext) = path.extension() {
            metadata.container_format = ext.to_string_lossy().to_uppercase();
        }
        
        // 解析格式信息
        if let Some(format_info) = json.get("format") {
            if let Some(duration_str) = format_info.get("duration") {
                if let Some(duration_sec) = duration_str.as_str().and_then(|s| f64::from_str(s).ok()) {
                    metadata.duration = Some(Duration::from_secs_f64(duration_sec));
                }
            }
            
            if let Some(bit_rate_str) = format_info.get("bit_rate") {
                if let Some(bit_rate) = bit_rate_str.as_str().and_then(|s| u32::from_str(s).ok()) {
                    metadata.bit_rate = Some(bit_rate);
                }
            }
        }
        
        // 解析流信息
        if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
            for stream in streams {
                let codec_type = stream.get("codec_type").and_then(|t| t.as_str());
                
                match codec_type {
                    Some("video") => {
                        metadata.has_video = true;
                        
                        // 视频编码格式
                        if let Some(codec_name) = stream.get("codec_name").and_then(|c| c.as_str()) {
                            metadata.video_codec = Some(codec_name.to_string());
                        }
                        
                        // 分辨率
                        if let (Some(width), Some(height)) = (
                            stream.get("width").and_then(|w| w.as_u64()),
                            stream.get("height").and_then(|h| h.as_u64())
                        ) {
                            metadata.width = Some(width as u32);
                            metadata.height = Some(height as u32);
                        }
                        
                        // 帧率
                        if let Some(r_frame_rate) = stream.get("r_frame_rate").and_then(|r| r.as_str()) {
                            if let Some(frame_rate) = self.parse_frame_rate(r_frame_rate) {
                                metadata.frame_rate = Some(frame_rate);
                            }
                        }
                        
                        // 如果格式中没有时长，尝试从视频流获取
                        if metadata.duration.is_none() {
                            if let Some(duration_str) = stream.get("duration").and_then(|d| d.as_str()) {
                                if let Some(duration_sec) = f64::from_str(duration_str).ok() {
                                    metadata.duration = Some(Duration::from_secs_f64(duration_sec));
                                }
                            }
                        }
                    },
                    Some("audio") => {
                        metadata.has_audio = true;
                        
                        // 音频编码格式
                        if let Some(codec_name) = stream.get("codec_name").and_then(|c| c.as_str()) {
                            metadata.audio_codec = Some(codec_name.to_string());
                        }
                        
                        // 如果还没有时长信息，尝试从音频流获取
                        if metadata.duration.is_none() {
                            if let Some(duration_str) = stream.get("duration").and_then(|d| d.as_str()) {
                                if let Some(duration_sec) = f64::from_str(duration_str).ok() {
                                    metadata.duration = Some(Duration::from_secs_f64(duration_sec));
                                }
                            }
                        }
                    },
                    _ => {}
                }
            }
        }
        
        Some(metadata)
    }
    
    /// 解析帧率字符串 (例如: "30000/1001")
    fn parse_frame_rate(&self, frame_rate_str: &str) -> Option<f64> {
        let parts: Vec<&str> = frame_rate_str.split('/').collect();
        if parts.len() == 2 {
            if let (Ok(numerator), Ok(denominator)) = (
                f64::from_str(parts[0]),
                f64::from_str(parts[1])
            ) {
                if denominator != 0.0 {
                    return Some(numerator / denominator);
                }
            }
        }
        None
    }

    /// 从文件路径创建视频信息
    pub fn create_video_info(&self, path: PathBuf) -> Result<VideoInfo, Box<dyn std::error::Error>> {
        let metadata = std::fs::metadata(&path)?;
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // 使用 ffprobe 解析视频元数据
        let video_metadata = self.get_video_metadata_ffprobe(&path)
            .unwrap_or_default();

        Ok(VideoInfo {
            path,
            name,
            size: metadata.len(),
            duration: video_metadata.duration,
            resolution: if let (Some(w), Some(h)) = (video_metadata.width, video_metadata.height) {
                Some((w, h))
            } else {
                None
            },
            codec: video_metadata.video_codec,
            audio_codec: video_metadata.audio_codec,
            created_time: metadata.created().ok(),
            modified_time: metadata.modified().ok(),
            container_format: Some(video_metadata.container_format),
            frame_rate: video_metadata.frame_rate,
            bit_rate: video_metadata.bit_rate,
        })
    }

}

/// 视频元数据结构
#[derive(Debug, Clone, Default)]
pub struct VideoMetadata {
    pub duration: Option<Duration>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub container_format: String,
    pub frame_rate: Option<f64>,
    pub bit_rate: Option<u32>,
    pub has_video: bool,
    pub has_audio: bool,
}

