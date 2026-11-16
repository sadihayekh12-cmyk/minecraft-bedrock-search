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

    // قاموس مصطلحات دقيق وسريع لضمان عمل الفلترة فوراً بدون بطء
    const minecraftDictionary = {
        'شيدر': 'shader',
        'شيدرز': 'shaders',
        'مود': 'mod',
        'مودات': 'mods',
        'حزمة موارد': 'texture pack',
        'حزم موارد': 'texture packs',
        'أثاث': 'furniture',
        'سيارات': 'cars',
        'سيارة': 'car',
        'أسلحة': 'weapons guns',
        'سلاح': 'weapon gun',
        'أشجار': 'custom trees',
        'شجرة': 'tree',
        'tree': 'tree',
        'trees': 'trees',
        'تقطيع': 'capitator chop',
        'ديناصور': 'dinosaurs',
        'حيوانات': 'animals',
        'زومبي': 'zombie',
        'تخفي': 'xray stealth',
        'طيران': 'elytra wings',
        'أكل': 'food',
        'بيت': 'house',
        'بناء': 'build',
        'سحر': 'magic',
        'أبعاد': 'dimension',
        'درع': 'armor',
        'أدوات': 'tools',
        'رعب': 'horror',
        'باركور': 'parkour',
        'مغامرة': 'adventure',
        'قرية': 'village',
        'تنين': 'dragon',
        'كتل': 'custom blocks'
    };

    // دالة ترجمة سريعة وآمنة مع مهلة زمنية (Timeout) قصيرة لعدم تجاوز حد Vercel
    async function getRefinedQuery(query) {
        let text = query.trim();
        for (const [arTerm, enTerm] of Object.entries(minecraftDictionary)) {
            if (text.toLowerCase().includes(arTerm)) {
                text = text.replace(new RegExp(arTerm, 'gi'), enTerm);
            }
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // مهلة 2 ثانية فقط للترجمة السحابية
            
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(translateUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

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
            // في حال حدوث أي تاخير أو خطأ، يتم الاعتماد على النص المعالج محلياً فوراً
        }

        return text;
    }

    const refinedQuery = await getRefinedQuery(q);

    try {
        let results = [];
        const seenUrls = new Set();

        // 1. البحث السريع والمباشر في مصادر MCPEDL و ModBay باستخدام البحث الداخلي الخاص بهم لتجنب البطيء
        const searchTargets = [
            `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery)}`,
            `https://modbay.org/?s=${encodeURIComponent(refinedQuery)}`
        ];

        for (const targetUrl of searchTargets) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500); // مهلة 3.5 ثانية لكل مصدر

                const response = await fetch(targetUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const html = await response.text();
                    // استخراج روابط صفحات المودات فقط وتجنب أقسام القائمة
                    const hrefRegex = /<a[^>]+href="(https:\/\/(?:mcpedl\.com|modbay\.org)\/[^\/]+\/?)"[^>]*>([\s\S]*?)<\/a>/g;
                    let itemMatch;

                    while ((itemMatch = hrefRegex.exec(html)) !== null) {
                        const url = itemMatch[1];
                        if (isValidModPageUrl(url, APPROVED_SITES) && !seenUrls.has(url)) {
                            seenUrls.add(url);
                            let title = extractTitleFromUrl(url);
                            let source = getDomain(url);
                            results.push({
                                title: title,
                                url: url,
                                source: source
                            });
                            if (results.length >= 12) break;
                        }
                    }
                }
            } catch (err) {
                // تخطي المصدر في حال بطء الاستجابة
            }
            if (results.length >= 12) break;
        }

        // إذا لم توجد نتائج كافية، استخدم رابط بحث احتياطي مباشر
        if (results.length === 0) {
            const fallbackUrl = `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery)}`;
            results.push({
                title: `بحث مباشر عن: ${q} (${refinedQuery})`,
                url: fallbackUrl,
                source: 'mcpedl.com'
            });
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
            error: 'حدث خطأ أثناء الاتصال بالخادم',
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
        return slug.replace(/-/g, ' ').replace(/\w/g, l => l.toUpperCase());
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
