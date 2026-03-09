from flask import Flask, request, jsonify
import yt_dlp

app = Flask(__name__)

def get_priority(entry):
    title = entry.get('title', '').lower()
    uploader = entry.get('uploader', '').lower()
    
    # 1순위: Topic (유튜브 생성 공식 채널)
    if ' - topic' in uploader:
        return 1
    # 2순위: Official Audio
    if 'official audio' in title or 'audio' in title:
        return 2
    # 3순위: Music Video (나머지 중 MV 키워드 포함)
    if 'music video' in title or 'mv' in title:
        return 3
    # 기타
    return 4

@app.route('/search', methods=['GET'])
def search_music():
    keyword = request.args.get('q')
    limit = int(request.args.get('limit', 10)) # 기본 10개 검색
    
    if not keyword:
        return jsonify({"error": "검색어를 입력하세요."}), 400

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'skip_download': True,
        'noplaylist': True,
        'extract_flat': False,
    }

    try:
        # 넉넉하게 검색하여 후보군 확보
        search_query = f"ytsearch{limit}:{keyword}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            entries = info.get('entries', [])

            # 우선순위에 따라 정렬 (1순위가 가장 앞으로)
            sorted_entries = sorted(entries, key=get_priority)

            results = []
            for entry in sorted_entries:
                results.append({
                    "priority": get_priority(entry),
                    "title": entry.get('title'),
                    "artist": entry.get('uploader'),
                    "stream_url": entry.get('url'),
                    "thumbnail": entry.get('thumbnail'),
                    "duration": entry.get('duration'),
                    "video_id": entry.get('id')
                })

            return jsonify({"results": results})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
