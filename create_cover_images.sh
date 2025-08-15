#!/bin/bash

# VideoVault 封面图片生成脚本
# 为每个视频文件创建对应的封面图片

echo "🎨 开始为VideoVault Demo视频创建封面图片..."

# 检查是否安装了ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ 需要安装ImageMagick来生成图片"
    echo "macOS安装命令: brew install imagemagick"
    echo "Ubuntu安装命令: sudo apt-get install imagemagick"
    exit 1
fi

# 进入demo_videos目录
cd demo_videos

echo "📁 进入demo_videos目录..."

# 为每个视频创建对应的封面图片
echo "🎬 为Movies/Action/Elephants_Dream_720p.mp4创建封面..."
convert -size 300x450 xc:navy -gravity center -pointsize 24 -fill white -annotate 0 "Elephants\nDream\n720p" "Movies/Action/Elephants_Dream_720p.jpg"

echo "🎬 为Movies/Action/Sintel_1080p.mp4创建封面..."
convert -size 300x450 xc:darkred -gravity center -pointsize 24 -fill white -annotate 0 "Sintel\n1080p" "Movies/Action/Sintel_1080p.jpg"

echo "🎬 为Movies/Comedy/Big_Buck_Bunny_1080p.mp4创建封面..."
convert -size 300x450 xc:darkgreen -gravity center -pointsize 24 -fill white -annotate 0 "Big Buck\nBunny\n1080p" "Movies/Comedy/Big_Buck_Bunny_1080p.jpg"

echo "🎬 为TV_Shows/Season_1/test_video_1.mp4创建封面..."
convert -size 300x450 xc:purple -gravity center -pointsize 24 -fill white -annotate 0 "Test Video 1\nTV Show" "TV_Shows/Season_1/test_video_1.jpg"

echo "🎬 为TV_Shows/Season_1/test_video_2.mp4创建封面..."
convert -size 300x450 xc:teal -gravity center -pointsize 24 -fill white -annotate 0 "Test Video 2\nTV Show" "TV_Shows/Season_1/test_video_2.jpg"

echo "🎬 为Documentaries/test_video_3.mp4创建封面..."
convert -size 300x450 xc:orange -gravity center -pointsize 24 -fill white -annotate 0 "Test Video 3\nDocumentary" "Documentaries/test_video_3.jpg"

# 创建一些不同格式的封面文件来测试多种格式支持
echo "🖼️  创建不同格式的封面文件..."

# PNG格式
convert -size 300x450 xc:navy -gravity center -pointsize 24 -fill white -annotate 0 "Elephants\nDream\n720p" "Movies/Action/Elephants_Dream_720p.png"

# BMP格式
convert -size 300x450 xc:darkred -gravity center -pointsize 24 -fill white -annotate 0 "Sintel\n1080p" "Movies/Action/Sintel_1080p.bmp"

echo "✅ 封面图片创建完成！"
echo ""
echo "📁 文件结构："
echo "demo_videos/"
echo "├── Movies/"
echo "│   ├── Action/"
echo "│   │   ├── Elephants_Dream_720p.mp4"
echo "│   │   ├── Elephants_Dream_720p.jpg"
echo "│   │   ├── Elephants_Dream_720p.png"
echo "│   │   ├── Sintel_1080p.mp4"
echo "│   │   ├── Sintel_1080p.jpg"
echo "│   │   └── Sintel_1080p.bmp"
echo "│   └── Comedy/"
echo "│       ├── Big_Buck_Bunny_1080p.mp4"
echo "│       └── Big_Buck_Bunny_1080p.jpg"
echo "├── TV_Shows/"
echo "│   └── Season_1/"
echo "│       ├── test_video_1.mp4"
echo "│       ├── test_video_1.jpg"
echo "│       ├── test_video_2.mp4"
echo "│       └── test_video_2.jpg"
echo "└── Documentaries/"
echo "    ├── test_video_3.mp4"
echo "    └── test_video_3.jpg"

echo ""
echo "🎯 这些封面图片可以用于测试："
echo "- 封面文件自动检测"
echo "- 多种图片格式支持 (JPG, PNG, BMP)"
echo "- 封面与视频的关联匹配"
echo "- 缩略图生成和缓存"
echo "- 封面显示性能优化"
