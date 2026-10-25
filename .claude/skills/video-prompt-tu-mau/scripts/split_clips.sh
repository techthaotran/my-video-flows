#!/usr/bin/env bash
# Cắt video mẫu thành các clip tắt tiếng, kèm bảng frame đánh số giây và frame cuối từng clip.
# Dùng: split_clips.sh <video> <thư_mục_ra> [độ_dài_clip=10] [đuôi_tên=mau]
set -euo pipefail
src="${1:?thiếu đường dẫn video}"; out="${2:?thiếu thư mục ra}"; len="${3:-10}"; tag="${4:-mau}"
mkdir -p "$out"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
n=$(awk -v d="$dur" -v l="$len" 'BEGIN{printf "%d", (d/l==int(d/l))?d/l:int(d/l)+1}')
echo "Video dài ${dur}s, cắt thành ${n} clip ${len}s"
for ((i=0;i<n;i++)); do
  start=$(awk -v i="$i" -v l="$len" 'BEGIN{print i*l}')
  rest=$(awk -v d="$dur" -v s="$start" 'BEGIN{print d-s}')
  f="$out/video_${tag}_$((i+1))_nosound.mp4"
  if awk -v r="$rest" -v l="$len" 'BEGIN{exit !(r<l-0.2)}'; then
    # clip cuối ngắn hơn len: kéo giãn chậm cho đủ len giây
    ffmpeg -y -v error -ss "$start" -i "$src" -an \
      -vf "setpts=PTS*${len}/${rest},fps=30" -t "$len" -c:v libx264 -crf 18 -pix_fmt yuv420p "$f"
    echo "clip $((i+1)): ${start}s đến hết (${rest}s) kéo giãn thành ${len}s"
  else
    ffmpeg -y -v error -ss "$start" -t "$len" -i "$src" -an -c:v libx264 -crf 18 -pix_fmt yuv420p "$f"
    echo "clip $((i+1)): ${start}s đến $(awk -v s="$start" -v l="$len" 'BEGIN{print s+l}')s"
  fi
  ffmpeg -y -v error -sseof -0.1 -i "$f" -update 1 -q:v 1 "$out/frame_cuoi_${tag}_$((i+1)).png"
  ffmpeg -y -v error -i "$f" \
    -vf "fps=1,scale=240:-1,drawtext=text='%{n}':x=5:y=5:fontsize=28:fontcolor=red,tile=5x2" \
    -frames:v 1 "$out/bang_frame_${tag}_$((i+1)).png"
done
ls "$out"
