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
    // قائمة مرجعية شاملة تضم 50 موقعاً ومصدراً موثوقاً لمودات وشيدرز ماينكرافت بيدروك
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
    // القاموس الذكي المتقدم لتحويل الاستعلامات العربية والوصفية إلى كلمات مفتاحية دقيقة
    // =========================================================================
    const arabicToEnglishMap = {
        'شيدر': 'shader realistic graphics lighting water',
        'واقعي': 'realistic graphics shader RTX ultra',
        'خفيف': 'lightweight performance shader low end potato',
        'ضعيفة': 'low end potato pc mobile shader',
        'أسلحة': 'guns weapons firearms combat military pack',
        'سلاح': 'weapon gun firearm combat',
        'سيارات': 'cars vehicles transport supercars',
        'سيارة': 'car vehicle transport',
        'أثاث': 'furniture decoration interior house decor',
        'أشجار': 'custom trees leaves nature forest',
        'شجرة': 'tree nature plant custom',
        'ديناصور': 'dinosaurs prehistoric mobs fossils',
        'حيوانات': 'animals pets wildlife safari',
        'زومبي': 'zombie horror apocalypse survival',
        'تخفي': 'xray stealth resource pack hack',
        'طيران': 'wings elytra jetpack flying',
        'أكل': 'food farming crops cooking',
        'بيت': 'house structure furniture modern',
        'بناء': 'structure build map architecture',
        'سحر': 'magic spells items mystical',
        'أبعاد': 'dimension portal biome realm',
        'درع': 'armor gear equipment protection',
        'أدوات': 'tools utility items multi-tool',
        'رعب': 'horror scary monster creepy',
        'باركور': 'parkour map obstacle jump',
        'مغامرة': 'adventure map quest story',
        'قرية': 'village upgrade structure town',
        'تنين': 'dragon mounts mythical boss',
        'بصريات': 'ray tracing graphics pbr texture',
        'كتل': 'custom blocks 3d models ores'
    };

    function smartTranslate(query) {
        let cleanQuery = query.toLowerCase().trim();
        let mappedKeywords = [];
        
        for (const [arKey, enVal] of Object.entries(arabicToEnglishMap)) {
            if (cleanQuery.includes(arKey)) {
                mappedKeywords.push(enVal);
            }
        }

        if (mappedKeywords.length > 0) {
            return mappedKeywords.join(' ') + ' ' + cleanQuery;
        }
        
        return cleanQuery;
    }

    const refinedQuery = smartTranslate(q);

    try {
        const results = [];
        const seenUrls = new Set();

        // جلب النتائج من المصدر الرئيسي الموثوق (MCPEDL) كبداية مضمونة وسريعة
        const targetUrl = `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery + (category ? ' ' + category : ''))}`;
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (response.ok) {
            const html = await response.text();
            const hrefRegex = /<a[^>]+href="(https:\/\/mcpedl\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
            let itemMatch;

            while ((itemMatch = hrefRegex.exec(html)) !== null) {
                const url = itemMatch[1];
                if (url && !url.includes('/author/') && !url.includes('/category/') && !url.includes('/tag/') && !url.includes('/page/') && !seenUrls.has(url) && url !== 'https://mcpedl.com/') {
                    seenUrls.add(url);
                    let slug = url.split('/').filter(Boolean).pop() || '';
                    let title = slug.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase());
                    
                    results.push({
                        title: title || 'Minecraft Bedrock Content',
                        url: url,
                        source: 'mcpedl.com'
                    });
                    if (results.length >= 12) break;
                }
            }
        }

        // البحث السريع في مصادر إضافية من القائمة الـ 50
        for (const site of APPROVED_SITES.slice(1, 15)) {
            try {
                const siteSearchUrl = `https://${site}/?s=${encodeURIComponent(refinedQuery)}`;
                const sRes = await fetch(siteSearchUrl, { 
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(2500)
                });
                if (sRes.ok) {
                    const sHtml = await sRes.text();
                    const sLinkRegex = new RegExp(`href="(https?:\/\/(?:[^\/]+\.)?${site.replace('.', '\.')}\/[^"]+)"`, 'g');
                    let sMatch;
                    while ((sMatch = sLinkRegex.exec(sHtml)) !== null) {
                        const sUrl = sMatch[1];
                        if (!seenUrls.has(sUrl) && !sUrl.includes('feed') && !sUrl.includes('login') && sUrl !== `https://${site}/`) {
                            seenUrls.add(sUrl);
                            let slug = sUrl.split('/').filter(Boolean).pop() || 'mod-item';
                            let title = slug.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase());
                            results.push({
                                title: title,
                                url: sUrl,
                                source: site
                            });
                            if (results.length >= 20) break;
                        }
                    }
                }
            } catch (e) {
                // تجاوز المواقع التي لا تستجيب بسرعة
            }
            if (results.length >= 20) break;
        }

        return res.status(200).json({
            success: true,
            originalQuery: q,
            refinedQuery: refinedQuery,
            results: results
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
