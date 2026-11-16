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
    // 1. قاموس مصطلحات ماينكرافت (طبقة المعالجة المسبقة Pre-processing)
    // =========================================================================
    const minecraftDictionary = {
        'شيدر': 'shader',
        'شيدرز': 'shaders',
        'مود': 'mod',
        'مودات': 'mods',
        'حزمة موارد': 'texture pack',
        'حزم موارد': 'texture packs',
        'حزمة سلوكيات': 'behavior pack',
        'حزم سلوكيات': 'behavior packs',
        'أثاث': 'furniture',
        'سيارات': 'cars',
        'سيارة': 'car',
        'أسلحة': 'weapons guns',
        'سلاح': 'weapon gun',
        'أشجار': 'custom trees',
        'شجرة': 'tree',
        'ديناصور': 'dinosaurs',
        'حيوانات': 'animals',
        'زومبي': 'zombie',
        'تخفي': 'xray stealth',
        'طيران': 'elytra wings',
        'أكل': 'food farming',
        'بيت': 'house structure',
        'بناء': 'build structure',
        'سحر': 'magic',
        'أبعاد': 'dimension portal',
        'درع': 'armor',
        'أدوات': 'tools',
        'رعب': 'horror',
        'باركور': 'parkour',
        'مغامرة': 'adventure map',
        'قرية': 'village',
        'تنين': 'dragon',
        'بصريات': 'ray tracing graphics pbr',
        'كتل': 'custom blocks'
    };

    // =========================================================================
    // 2. دالة الترجمة الفورية عبر Google Translate Free API مع المعالجة المسبقة
    // =========================================================================
    async function translateQuery(query) {
        let text = query.trim();

        // تطبيق قاموس المصطلحات الخاصة بلعبة Minecraft أولاً
        for (const [arTerm, enTerm] of Object.entries(minecraftDictionary)) {
            if (text.includes(arTerm)) {
                text = text.replace(new RegExp(arTerm, 'g'), enTerm);
            }
        }

        // إذا كان النص يحتوي على أحرف عربية أو يحتاج ترجمة عامة، نستخدم واجهة Google Translate المجانية
        try {
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(translateUrl);
            if (response.ok) {
                const data = await response.json();
                if (data && data[0] && Array.isArray(data[0])) {
                    let translated = data[0].map(item => item[0]).join('');
                    if (translated && translated.trim().length > 0) {
                        return translated.trim();
                    }
                }
            }
        } catch (e) {
            console.error('Translation API error:', e);
        }

        return text;
    }

    const refinedQuery = await translateQuery(q);

    try {
        const results = [];
        const seenUrls = new Set();

        // 3. البحث في MCPEDL واستخراج روابط صفحات المودات الحقيقية بدقة
        const targetUrl = `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery + (category ? ' ' + category : ''))}`;
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
        });

        if (response.ok) {
            const html = await response.text();
            // استخراج روابط المودات حصرياً وتجاهل RSS، الأرشيف، التصنيفات، والمؤلفين
            const hrefRegex = /<a[^>]+href="(https:\/\/mcpedl\.com\/[^\/]+\/?)"[^>]*>([\s\S]*?)<\/a>/g;
            let itemMatch;

            while ((itemMatch = hrefRegex.exec(html)) !== null) {
                const url = itemMatch[1];
                if (url && 
                    !url.includes('/author/') && 
                    !url.includes('/category/') && 
                    !url.includes('/tag/') && 
                    !url.includes('/page/') && 
                    !url.includes('/feed/') && 
                    !url.includes('/rss/') &&
                    !url.includes('/wp-content/') &&
                    url !== 'https://mcpedl.com/' && 
                    url !== 'https://mcpedl.com' &&
                    !seenUrls.has(url)) {
                    
                    seenUrls.add(url);
                    let slug = url.split('/').filter(Boolean).pop() || '';
                    let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    results.push({
                        title: title || 'Minecraft Bedrock Mod',
                        url: url,
                        source: 'mcpedl.com'
                    });
                    if (results.length >= 15) break;
                }
            }
        }

        // 4. البحث في المصادر الإضافية من الـ 50 مصدراً المعتمد
        for (const site of APPROVED_SITES.slice(1, 15)) {
            try {
                const siteSearchUrl = `https://${site}/?s=${encodeURIComponent(refinedQuery)}`;
                const sRes = await fetch(siteSearchUrl, { 
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(2500)
                });
                if (sRes.ok) {
                    const sHtml = await sRes.text();
                    const sLinkRegex = new RegExp(`href="(https?:\/\/(?:[^\/]+\.)?${site.replace('.', '\.')}\/[^\/]+\/)"`, 'g');
                    let sMatch;
                    while ((sMatch = sLinkRegex.exec(sHtml)) !== null) {
                        const sUrl = sMatch[1];
                        if (!seenUrls.has(sUrl) && 
                            !sUrl.includes('feed') && 
                            !sUrl.includes('login') && 
                            !sUrl.includes('tag') &&
                            !sUrl.includes('category') &&
                            sUrl !== `https://${site}/`) {
                            
                            seenUrls.add(sUrl);
                            let slug = sUrl.split('/').filter(Boolean).pop() || 'mod-item';
                            let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            
                            results.push({
                                title: title,
                                url: sUrl,
                                source: site
                            });
                            if (results.length >= 25) break;
                        }
                    }
                }
            } catch (e) {
                // تجاهل المواقع غير المتاحة مؤقتاً لضمان سرعة الاستجابة
            }
            if (results.length >= 25) break;
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
