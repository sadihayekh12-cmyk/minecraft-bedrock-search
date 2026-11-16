export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { q, category } = req.query;
    if (!q) {
        return res.status(400).json({ success: false, error: 'الرجاء إدخال كلمة البحث' });
    }

    // AI Translation & Keyword extraction via text.pollinations.ai with safety fallback
    async function getAIKeywords(query) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const prompt = `Translate and extract the most precise English search keywords for Minecraft Bedrock mods from this request: "${query}". Return ONLY keywords, no punctuation.`;
            const aiRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (aiRes.ok) {
                const text = await aiRes.text();
                if (text && text.trim().length > 0) {
                    return text.trim().replace(/['"\n]/g, ' ');
                }
            }
        } catch (e) {
            // Ignore AI timeout
        }

        // Fast local fallback dictionary
        const dict = {
            'شيدر': 'shader', 'شيدرز': 'shaders', 'مود': 'mod', 'مودات': 'mods',
            'أثاث': 'furniture', 'سيارات': 'cars', 'أسلحة': 'weapons guns', 'سلاح': 'weapon gun',
            'أشجار': 'custom trees', 'شجرة': 'tree', 'tree': 'tree', 'trees': 'trees',
            'تقطيع': 'capitator chop', 'زومبي': 'zombie', 'تخفي': 'xray', 'طيران': 'elytra', 'رعب': 'horror'
        };
        let t = query.toLowerCase();
        for (const [k, v] of Object.entries(dict)) {
            if (t.includes(k)) t = t.replace(new RegExp(k, 'gi'), v);
        }
        return t;
    }

    const refinedQuery = await getAIKeywords(q);
    let results = [];
    const seenUrls = new Set();

    function isValidModUrl(url) {
        try {
            const parsed = new URL(url);
            const path = parsed.pathname.toLowerCase();
            const banned = ['/seeds', '/lostpassword', '/login', '/register', '/news', '/guides', '/maps', '/mods', '/textures', '/shaders', '/category', '/tag', '/author', '/page', '/feed', '/rss', '/search', '/faq', '/contact', '/privacy', '/terms', '/wp-content', '/do='];
            for (const b of banned) {
                if (path === b || path.startsWith(b + '/')) return false;
            }
            if (path === '/' || path === '') return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    // 1. Modrinth API search
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(refinedQuery)}&limit=10`;
        const modrinthRes = await fetch(modrinthUrl, {
            headers: { 'User-Agent': 'MinecraftBedrockSearch/1.0' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (modrinthRes.ok) {
            const modrinthData = await modrinthRes.json();
            if (modrinthData && modrinthData.hits) {
                for (const hit of modrinthData.hits) {
                    if (hit.slug && hit.title) {
                        const url = `https://modrinth.com/mod/${hit.slug}`;
                        if (!seenUrls.has(url)) {
                            seenUrls.add(url);
                            results.push({
                                title: hit.title,
                                url: url,
                                source: 'modrinth.com'
                            });
                        }
                    }
                }
            }
        }
    } catch (err) {
        // Skip on timeout
    }

    // 2. Jina Reader for MCPEDL
    try {
        if (results.length < 10) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const jinaUrl = `https://r.jina.ai/https://mcpedl.com/?s=${encodeURIComponent(refinedQuery)}`;
            const jinaRes = await fetch(jinaUrl, {
                headers: { 'Accept': 'text/plain', 'User-Agent': 'Mozilla/5.0' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (jinaRes.ok) {
                const jinaText = await jinaRes.text();
                const mdLinkRegex = /\[([^\]+)\]\((https?:\/\/[^\)]+)\)/g;
                let match;
                while ((match = mdLinkRegex.exec(jinaText)) !== null) {
                    const title = match[1];
                    const url = match[2];
                    if (url.includes('mcpedl.com') && isValidModUrl(url) && !seenUrls.has(url)) {
                        const lowerTitle = title.toLowerCase();
                        if (!['home', 'sign in', 'register', 'search', 'mcpedl', 'more', 'download'].includes(lowerTitle)) {
                            seenUrls.add(url);
                            results.push({
                                title: title,
                                url: url,
                                source: 'mcpedl.com'
                            });
                            if (results.length >= 15) break;
                        }
                    }
                }
            }
        }
    } catch (err) {
        // Skip on timeout
    }

    return res.status(200).json({
        success: true,
        originalQuery: q,
        refinedQuery: refinedQuery,
        results: results
    });
}
