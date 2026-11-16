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

    // =========================================================================
    // القائمة المرجعية التي تضم 50 مصدراً معتمداً لمودات وشيدرز ماينكرافت بيدروك
    // =========================================================================
    const APPROVED_SITES = [
        "mcpedl.com",
        "modbay.org",
        "curseforge.com",
        "modrinth.com",
        "planetminecraft.com",
        "9minecraft.net",
        "mcpebox.com",
        "mcpelife.com",
        "minecraft-inside.ru",
        "tlauncher.org",
        "minecraft-resourcepacks.com",
        "texture-packs.com",
        "minecraftbedrock.com",
        "mcpedl.org",
        "mcpe-planet.com",
        "minecraft-stats.com",
        "planetmcpe.com",
        "minecraftpocket-servers.com",
        "minecraft-malitia.com",
        "bedrocktweaks.net",
        "vanillatweaks.net",
        "mcpedl.ru",
        "minecraft-hub.art",
        "mcpehub.org",
        "minecraft-master.com",
        "minecraft-mods.io",
        "skmedix.pl",
        "ultimate-mcpe.com",
        "minecraft-bedrock.ru",
        "mcpe-store.com",
        "minecraft-add-ons.com",
        "mcpe-downloads.com",
        "planet-minecraft.ru",
        "minecraft-game.co",
        "minecraft-planet.net",
        "mcpedl.net",
        "mcpe-base.com",
        "minecraft-pocket.com",
        "minecraft-bedrock-mods.com",
        "mc-mod.net",
        "mc-dl.com",
        "minecraft-forum.net",
        "minecraft-resource.com",
        "mcpebox.org",
        "mcpelife.ru",
        "minecraft-pe.com",
        "mcpe-monster.com",
        "minecraft-master.ru",
        "planetmcpe.org",
        "bedrock-add-ons.com"
    ];

    // =========================================================================
    // خطوة الوكيل الذكي 1: تحليل وتفسير طلب المستخدم عبر Pollinations AI مع fallback محلي
    // =========================================================================
    async function agenticAnalyzeQuery(query) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const prompt = `You are an expert Minecraft Bedrock search agent. Analyze user query: "${query}". Provide 2-3 precise English search keywords/mod names for Bedrock mods. Return ONLY the keywords separated by spaces, no punctuation or extra text.`;
            const aiRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (aiRes.ok) {
                const text = await aiRes.text();
                if (text && text.trim().length > 0) {
                    return text.trim().replace(/['"\n]/g, ' ');
                }
            }
        } catch (e) {
            // Fallback
        }

        const dict = {
            'شيدر': 'shader realistic', 'شيدرز': 'shaders', 'مود': 'mod', 'مودات': 'mods',
            'أثاث': 'furniture decoration', 'سيارات': 'cars vehicles', 'أسلحة': 'guns weapons', 'سلاح': 'weapon gun',
            'أشجار': 'custom trees', 'شجرة': 'tree capitator', 'tree': 'tree', 'trees': 'trees',
            'تقطيع': 'tree capitator chop', 'زومبي': 'zombie apocalypse', 'تخفي': 'xray stealth', 'طيران': 'elytra wings'
        };
        let t = query.toLowerCase();
        for (const [k, v] of Object.entries(dict)) {
            if (t.includes(k)) t = t.replace(new RegExp(k, 'gi'), v);
        }
        return t;
    }

    const refinedQuery = await agenticAnalyzeQuery(q);
    let rawResults = [];
    const seenUrls = new Set();

    // دالة للتحقق من أن الرابط هو صفحة مود حقيقية وليس قسم رئيسي أو صفحة عامة
    function isValidModUrl(url) {
        try {
            const parsed = new URL(url);
            const domain = parsed.hostname.replace('www.', '');
            const isApproved = APPROVED_SITES.some(site => domain === site || domain.endsWith('.' + site));
            if (!isApproved) return false;

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

    // =========================================================================
    // خطوة الوكيل الذكي 2: جلب النتائج من Modrinth API ومن خلال Jina AI Reader لـ MCPEDL و ModBay
    // =========================================================================
    
    // أ) Modrinth API Search
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(refinedQuery)}&limit=10`;
        const modrinthRes = await fetch(modrinthUrl, {
            headers: { 'User-Agent': 'MinecraftBedrockAgenticSearch/1.0' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (modrinthRes.ok) {
            const data = await modrinthRes.json();
            if (data && data.hits) {
                for (const hit of data.hits) {
                    if (hit.slug && hit.title) {
                        const url = `https://modrinth.com/mod/${hit.slug}`;
                        if (!seenUrls.has(url)) {
                            seenUrls.add(url);
                            rawResults.push({
                                title: hit.title,
                                url: url,
                                source: 'modrinth.com'
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {}

    // ب) Jina AI Reader للمصادر الكبرى مثل MCPEDL
    try {
        if (rawResults.length < 15) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const jinaUrl = `https://r.jina.ai/https://mcpedl.com/?s=${encodeURIComponent(refinedQuery)}`;
            const jinaRes = await fetch(jinaUrl, {
                headers: { 'Accept': 'text/plain', 'User-Agent': 'Mozilla/5.0' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (jinaRes.ok) {
                const text = await jinaRes.text();
                const mdLinkRegex = /\[([^\]+)\]\((https?:\/\/[^\)]+)\)/g;
                let match;
                while ((match = mdLinkRegex.exec(text)) !== null) {
                    const title = match[1];
                    const url = match[2];
                    if (isValidModUrl(url) && !seenUrls.has(url)) {
                        const lowerTitle = title.toLowerCase();
                        if (!['home', 'sign in', 'register', 'search', 'mcpedl', 'more', 'download', 'news', 'guides'].includes(lowerTitle)) {
                            seenUrls.add(url);
                            rawResults.push({
                                title: title,
                                url: url,
                                source: new URL(url).hostname.replace('www.', '')
                            });
                            if (rawResults.length >= 20) break;
                        }
                    }
                }
            }
        }
    } catch (e) {}

    // =========================================================================
    // خطوة الوكيل الذكي 3: تقييم وفلترة النتائج بالذكاء الاصطناعي لاستبعاد الروابط غير المطابقة نهائياً
    // =========================================================================
    async function agenticFilterResults(userQuery, results) {
        if (!results || results.length === 0) return results;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const candidateList = results.map((r, i) => `[${i}] Title: ${r.title}, URL: ${r.url}`).join('\n');
            const prompt = `User request: "${userQuery}". Review these candidate links and select ONLY the ones that are actual direct mod/addon/shader pages matching the user request. Return ONLY a JSON array of valid indices (e.g. [0, 2, 5]), or [] if none. Candidates:\n${candidateList}`;
            
            const aiRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (aiRes.ok) {
                const text = await aiRes.text();
                const match = text.match(/\[[\d,\s]*\]/);
                if (match) {
                    const indices = JSON.parse(match[0]);
                    if (Array.isArray(indices)) {
                        const filtered = indices.map(i => results[i]).filter(Boolean);
                        if (filtered.length > 0) return filtered;
                    }
                }
            }
        } catch (e) {
            // Fallback to raw results if AI filter times out
        }
        return results;
    }

    const finalResults = await agenticFilterResults(q, rawResults);

    return res.status(200).json({
        success: true,
        originalQuery: q,
        refinedQuery: refinedQuery,
        results: finalResults
    });
}
