use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use std::fs::File;
use std::io::Read;
use symphonia::core::{
    io::MediaSourceStream,
};

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

    /// 使用 Symphonia 解析视频元数据
    fn get_video_metadata_symphonia(&self, path: &PathBuf) -> Option<VideoMetadata> {
        let file = match File::open(path) {
            Ok(file) => file,
            Err(e) => {
                println!("无法打开文件 {}: {}", path.display(), e);
                return None;
            }
        };

        let src = Box::new(file);
        let mss = MediaSourceStream::new(src, Default::default());
        
        let mut probed = match symphonia::default::get_probe().format(&Default::default(), mss, &Default::default(), &Default::default()) {
            Ok(probed) => probed,
            Err(e) => {
                println!("Symphonia 格式探测失败: {}", e);
                return None;
            }
        };
        
        let format = probed.format;
        let mut metadata = VideoMetadata::default();
        
        // 容器格式 - 从文件扩展名推断
        if let Some(ext) = path.extension() {
            metadata.container_format = ext.to_string_lossy().to_uppercase();
        }
        
        // 遍历所有轨道，查找视频流和音频流
        for track in format.tracks() {
            let params = &track.codec_params;
            
            // 检查是否为视频轨道 - 通过编解码器类型和特征判断
            let codec_name = format!("{:?}", params.codec);
            let is_video_codec = codec_name.contains("H264") || 
                                codec_name.contains("H265") || 
                                codec_name.contains("VP8") || 
                                codec_name.contains("VP9") ||
                                codec_name.contains("AV1") ||
                                codec_name.contains("MPEG") ||
                                codec_name.contains("Theora");
            
            // 视频轨道通常没有 sample_rate
            let has_video_characteristics = params.sample_rate.is_none();
            
            if is_video_codec || has_video_characteristics {
                metadata.has_video = true;
                metadata.video_codec = Some(codec_name.clone());
                
                // 注意：Symphonia 的 CodecParameters 不直接提供分辨率信息
                // 分辨率信息通常需要从编解码器特定的扩展数据中解析
                println!("找到视频轨道，编解码器: {}", codec_name);
                
                // 尝试从时间基准计算时长
                if let Some(time_base) = params.time_base {
                    if let Some(n_frames) = params.n_frames {
                        let time = time_base.calc_time(n_frames);
                        let duration_sec = time.seconds as f64 + time.frac;
                        metadata.duration = Some(Duration::from_secs_f64(duration_sec));
                        println!("从视频轨道计算时长: {:.2} 秒", duration_sec);
                    }
                }
                
                // 尝试获取帧率信息
                if let Some(time_base) = params.time_base {
                    if let Some(n_frames) = params.n_frames {
                        if let Some(duration) = metadata.duration {
                            let frame_rate = n_frames as f64 / duration.as_secs_f64();
                            metadata.frame_rate = Some(frame_rate);
                            println!("计算帧率: {:.2} fps", frame_rate);
                        }
                    }
                }
            } else {
                // 这可能是音频轨道
                metadata.has_audio = true;
                metadata.audio_codec = Some(codec_name);
                
                // 尝试从时间基准计算时长（如果视频轨道没有时长信息）
                if metadata.duration.is_none() {
                    if let Some(time_base) = params.time_base {
                        if let Some(n_frames) = params.n_frames {
                            let time = time_base.calc_time(n_frames);
                            let duration_sec = time.seconds as f64 + time.frac;
                            metadata.duration = Some(Duration::from_secs_f64(duration_sec));
                            println!("从音频轨道计算时长: {:.2} 秒", duration_sec);
                        }
                    }
                }
            }
        }
        
        // 获取元数据标签
        if let Some(_metadata_ref) = probed.metadata.get() {
            println!("找到元数据，但暂时跳过标签解析");
        }
        
        Some(metadata)
    }

    /// 从文件路径创建视频信息
    pub fn create_video_info(&self, path: PathBuf) -> Result<VideoInfo, Box<dyn std::error::Error>> {
        let metadata = std::fs::metadata(&path)?;
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // 优先使用 Symphonia 解析，失败时使用备用方案
        let video_metadata = self.get_video_metadata_symphonia(&path)
            .unwrap_or_default();

        println!("视频 {} 的元数据: 时长={:?}, 分辨率={:?}x{:?}, 编码={:?}, 音频编码={:?}, 容器={:?}", 
                 name, video_metadata.duration, video_metadata.width, video_metadata.height, 
                 video_metadata.video_codec, video_metadata.audio_codec, video_metadata.container_format);

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
struct VideoMetadata {
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

