// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  app_lib::run();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_ffprobe_metadata() {
        // 创建一个测试视频文件路径（这里使用一个不存在的路径，只是为了测试函数调用）
        let test_path = PathBuf::from("/tmp/test_video.mp4");
        let processor = app_lib::video::VideoProcessor::new();
        // 测试 ffprobe 方法（应该返回 None，因为文件不存在）
        let result = processor.get_video_metadata_ffprobe(&test_path);
        assert!(result.is_none());
        println!("ffprobe 测试完成");
    }
}
