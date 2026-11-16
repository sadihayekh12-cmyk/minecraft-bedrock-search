export default async function handler(req, res) {
    // تفعيل CORS لضمان التواصل السلس مع الواجهة الأمامية
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
    // القاموس الذكي لتحويل الاستعلامات العربية والوصفية إلى كلمات مفتاحية إنجليزية دقيقة
    // =========================================================================
    const arabicToEnglishMap = {
        'شيدر': 'shader realistic graphics',
        'واقعي': 'realistic graphics shader',
        'خفيف': 'lightweight performance shader low end',
        'ضعيفة': 'low end potato pc shader',
        'أسلحة': 'guns weapons combat pack',
        'سلاح': 'weapon gun pack',
        'سيارات': 'cars vehicles transport',
        'سيارة': 'car vehicle',
        'أثاث': 'furniture decoration interior',
        'أشجار': 'custom trees leaves nature',
        'شجرة': 'tree nature plant custom',
        'ديناصور': 'dinosaurs prehistoric mobs',
        'حيوانات': 'animals pets wildlife',
        'زومبي': 'zombie horror apocalypse',
        'تخفي': 'xray stealth resource',
        'طيران': 'wings elytra jetpack',
        'أكل': 'food farming crops',
        'بيت': 'house structure furniture',
        'بناء': 'structure build map',
        'سحر': 'magic spells items',
        'أبعاد': 'dimension portal biome',
        'درع': 'armor gear equipment',
        'أدوات': 'tools utility items'
    };

    // دالة ذكية لتحليل وفهم الاستعلام العربي واستخراج الكلمات المفتاحية الإنجليزية
    function smartTranslate(query) {
        let cleanQuery = query.toLowerCase().trim();
        let mappedKeywords = [];
        
        // البحث عن الكلمات المفتاحية في الاستعلام العربي ومطابقتها
        for (const [arKey, enVal] of Object.entries(arabicToEnglishMap)) {
            if (cleanQuery.includes(arKey)) {
                mappedKeywords.push(enVal);
            }
        }

        // إذا تم العثور على مطابقات وصفية دقيقة، يتم دمجها مع النص الأصلي للتعزيز
        if (mappedKeywords.length > 0) {
            return mappedKeywords.join(' ') + ' ' + cleanQuery;
        }
        
        // إذا لم توجد مطابقة في القاموس، يتم إرجاع النص كما هو
        return cleanQuery;
    }

    const refinedQuery = smartTranslate(q);

    try {
        // بناء رابط البحث الموجه للموقع المعتمد (MCPEDL) مع الكلمات المفتاحية المحسنة
        const targetUrl = `https://mcpedl.com/?s=${encodeURIComponent(refinedQuery + (category ? ' ' + category : ''))}`;
        
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('فشل الاتصال بالموقع المستهدف');
        }

        const html = await response.text();
        
        // استخراج الروابط والعناوين بدقة باستخدام التعبير المنتظم (Regex)
        const results = [];
        const regex = /<a[^>]+href="(https:\/\/mcpedl\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        const seenUrls = new Set();

        while ((match = regex.exec(html)) !== null) {
            const url = match[1];
            
            // فلترة الروابط لاستبعاد صفحات التصنيفات والمؤلفين والصفحات غير المرغوبة
            if (url.includes('mcpedl.com/') && 
                url !== 'https://mcpedl.com/' && 
                !url.includes('/author/') && 
                !url.includes('/category/') && 
                !url.includes('/tag/') &&
                !url.includes('/page/') &&
                !seenUrls.has(url)) {
                
                seenUrls.add(url);
                
                // استنباط عنوان نظيف من الرابط
                let slug = url.split('/').filter(Boolean).pop() || '';
                let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                results.push({
                    title: title,
                    url: url,
                    source: 'mcpedl.com'
                });

                if (results.length >= 10) break; // جلب أفضل 10 نتائج مطابقة
            }
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
