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
    // أفضل 50 مصدراً معتمداً لمودات وشيدرز ماينكرافت بيدروك
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
        "minecraft-dl.com",
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
    // الخطوة 1: استخدام ذكاء اصطناعي مجاني لتحليل الطلب واستخراج أدق 3 كلمات مفتاحية / مودات إنجليزية
    // =========================================================================
    async function getAIKeywords(query) {
        try {
            const prompt = `You are a Minecraft Bedrock expert. User request: "${query}". Extract the top 3 precise English mod names or search keywords for Minecraft Bedrock (e.g. Tree Capitator, Shader, etc.). Return ONLY comma-separated keywords, no extra text.`;
            const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
            if (res.ok) {
                const text = await res.text();
                if (text && text.trim().length > 0) {
                    return text.trim().replace(/['"\
]/g, ' ');
                }
            }
        } catch (e) {
            console.error("AI keyword extraction error:", e);
        }
        return query;
    }

    const refinedQuery = await getAIKeywords(q);

    try {
        let rawResults = [];
        const seenUrls = new Set();

        // الخطوة 2: البحث في المصادر المعتمدة (عبر DuckDuckGo HTML حصرياً محصوراً في الـ 50 مصدراً)
        const topSites = APPROVED_SITES.slice(0, 15);
        const siteQuery = topSites.map(s => `site:${s}`).join(' OR ');
        const searchQuery = `${refinedQuery} ${category || ''} minecraft bedrock (${siteQuery})`;

        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(ddgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        if (response.ok) {
            const html = await response.text();
            const uddgRegex = /uddg=([^&"']+)/g;
            let match;
            while ((match = uddgRegex.exec(html)) !== null) {
                try {
                    const decodedUrl = decodeURIComponent(match[1]);
                    if (isValidModPageUrl(decodedUrl, APPROVED_SITES) && !seenUrls.has(decodedUrl)) {
                        seenUrls.add(decodedUrl);
                        let title = extractTitleFromUrl(decodedUrl);
                        let source = getDomain(decodedUrl);
                        rawResults.push({
                            title: title,
                            url: decodedUrl,
                            source: source
                        });
                        if (rawResults.length >= 20) break;
                    }
                } catch (err) {
                    // ignore
                }
            }
        }

        // Fallback مباشر إذا كانت النتائج قليلة
        if (rawResults.length < 3) {
            try {
                const mcpedlUrl = `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery)}`;
                const mcpedlRes = await fetch(mcpedlUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                if (mcpedlRes.ok) {
                    const mcpedlHtml = await mcpedlRes.text();
                    const linkRegex = /<a[^>]+href="(https:\/\/mcpedl\.com\/[^\/]+\/?)"[^>]*>([\s\S]*?)<\/a>/g;
                    let mMatch;
                    while ((mMatch = linkRegex.exec(mcpedlHtml)) !== null) {
                        const url = mMatch[1];
                        if (isValidModPageUrl(url, APPROVED_SITES) && !seenUrls.has(url)) {
                            seenUrls.add(url);
                            let title = extractTitleFromUrl(url);
                            rawResults.push({
                                title: title,
                                url: url,
                                source: 'mcpedl.com'
                            });
                            if (rawResults.length >= 20) break;
                        }
                    }
                }
            } catch(e) {}
        }

        // =========================================================================
        // الخطوة 3: تمرير النتائج للذكاء الاصطناعي لفلترتها وإرجاع المودات المطابقة فقط
        // =========================================================================
        async function filterResultsWithAI(userQuery, results) {
            if (!results || results.length === 0) return results;
            try {
                const candidateList = results.map((r, i) => `[${i}] Title: ${r.title}, URL: ${r.url}`).join('\n');
                const prompt = `User request: "${userQuery}". Review these candidate links and select ONLY the ones that are actual direct mod/addon/shader pages matching the user request. Return ONLY a JSON array of valid indices (e.g. [0, 2, 5]), or [] if none. Candidates:\n${candidateList}`;
                const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
                if (res.ok) {
                    const text = await res.text();
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
                console.error("AI filtering error:", e);
            }
            return results; // Fallback to raw results if AI filter fails
        }

        const finalResults = await filterResultsWithAI(q, rawResults);

        return res.status(200).json({
            success: true,
            originalQuery: q,
            refinedQuery: refinedQuery,
            results: finalResults
        });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ أثناء جلب النتائج من الخادم',
            details: error.message 
        });
    }
}

function isValidModPageUrl(url, approvedSites) {
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace('www.', '');
        const isApproved = approvedSites.some(site => domain === site || domain.endsWith('.' + site));
        if (!isApproved) return false;

        const path = parsed.pathname.toLowerCase();
        const bannedKeywords = ['/news', '/guides', '/maps', '/mods', '/textures', '/shaders', '/category', '/tag', '/author', '/page', '/feed', '/rss', '/search', '/login', '/register', '/faq', '/contact', '/privacy', '/terms', '/wp-content'];
        for (const ban of bannedKeywords) {
            if (path === ban || path === ban + '/' || path.startsWith(ban + '/')) {
                return false;
            }
        }

        const segments = path.split('/').filter(Boolean);
        if (segments.length === 0) return false;
        if (['mods', 'shaders', 'textures', 'maps', 'addons', 'packs'].includes(segments[0])) {
            if (segments.length < 2) return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

function extractTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split('/').filter(Boolean);
        let slug = segments[segments.length - 1] || 'Minecraft Mod';
        slug = slug.replace(/\.[^/.]+$/, '');
        return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } catch (e) {
        return 'Minecraft Bedrock Content';
    }
}

function getDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '');
    } catch (e) {
        return 'mcpedl.com';
    }
}
