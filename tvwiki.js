const mangayomiSources = [{
    "name": "TVWiki",
    "lang": "ko",
    "baseUrl": "https://tvwiki5.net",
    "apiUrl": "",
    "iconUrl": "https://tvwiki5.net",
    "typeSource": "multi",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/ko/tvwiki.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // 설정에서 동적 주소 및 쿠키 로드
    getPreference(key, defaultValue) {
        return new SharedPreferences().get(key) || defaultValue;
    }

    getBaseUrl() {
        return this.getPreference("tvwiki_base_url", "https://tvwiki5.net");
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Referer": this.getBaseUrl(),
            "Cookie": this.getPreference("user_cookie", "")
        };
    }

    // 공통 파싱 로직 (드라마 목록 등)
    async parseListPage(url) {
        const res = await this.client.get(url, { headers: this.getHeaders() });
        const doc = new Document(res.body);
        const list = [];
        
        // 아이템 선택자 (.video-block 혹은 사이트 구조에 맞는 클래스)
        const items = doc.select(".video-block, .archive-post"); 
        for (const item of items) {
            const titleEl = item.selectFirst(".video-title, .post-title, h2");
            const imgEl = item.selectFirst("img");
            const linkEl = item.selectFirst("a");

            if (titleEl && linkEl) {
                list.push({
                    name: titleEl.text.trim(),
                    imageUrl: imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "",
                    link: linkEl.attr("href")
                });
            }
        }

        const hasNextPage = doc.selectFirst(".next, .page-numbers.next") !== null;
        return { list, hasNextPage };
    }

    async getPopular(page) {
        return await this.parseListPage(`${this.getBaseUrl()}/drama?page=${page}&sort=views`);
    }

    async getLatestUpdates(page) {
        return await this.parseListPage(`${this.getBaseUrl()}/drama?page=${page}`);
    }

    async search(query, page, filters) {
        return await this.parseListPage(`${this.getBaseUrl()}/search?q=${encodeURIComponent(query)}&page=${page}`);
    }

    async getDetail(url) {
        const res = await this.client.get(url, { headers: this.getHeaders() });
        const doc = new Document(res.body);

        const name = doc.selectFirst(".video-info-title, h1")?.text.trim() || "알 수 없는 제목";
        const imageUrl = doc.selectFirst(".video-poster img")?.attr("src") || "";
        const description = doc.selectFirst(".video-description, .entry-content")?.text.trim() || "";
        const genre = doc.select(".video-meta-item a").map(e => e.text);

        const chapters = [];
        const episodes = doc.select(".episode-list li a, .video-episode-list a");
        episodes.forEach((ep) => {
            chapters.push({
                name: ep.text.trim(),
                url: ep.attr("href")
            });
        });

        return { 
            name, 
            imageUrl, 
            link: url, 
            description, 
            genre, 
            status: 0, 
            chapters: chapters.reverse() // 1화부터 정렬
        };
    }

    async getVideoList(url) {
        const res = await this.client.get(url, { headers: this.getHeaders() });
        const body = res.body;

        // m3u8 스트리밍 주소 정규식 추출
        let streamUrl = body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/)?.[1];

        // iframe 내부에 있을 경우 추가 탐색
        if (!streamUrl) {
            const iframeSrc = body.match(/<iframe[^>]+src=["']([^"']+)["']/)?.[1];
            if (iframeSrc) {
                const ifRes = await this.client.get(iframeSrc, { headers: this.getHeaders() });
                streamUrl = ifRes.body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/)?.[1];
            }
        }

        if (!streamUrl) return [];

        return [{
            url: streamUrl,
            quality: "Auto",
            originalUrl: streamUrl,
            headers: this.getHeaders()
        }];
    }

    getSourcePreferences() {
        return [
            {
                key: "tvwiki_base_url",
                editTextPreference: {
                    title: "기본 주소 (Base URL)",
                    summary: "도메인 변경 시 수정하세요.",
                    value: "https://tvwiki5.net",
                    dialogTitle: "주소 수정",
                    dialogMessage: "예: https://tvwiki10.net",
                }
            },
            {
                key: "user_cookie",
                editTextPreference: {
                    title: "세션 쿠키 (Cookie)",
                    summary: "Cloudflare 우회용 쿠키 값을 입력하세요.",
                    value: "",
                    dialogTitle: "쿠키 입력",
                    dialogMessage: "브라우저에서 추출한 cf_clearance 등",
                }
            }
        ];
    }
}
