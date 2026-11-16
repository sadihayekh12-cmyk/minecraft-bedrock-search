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

    try {
        const targetUrl = `https://mcpedl.com/?s=${encodeURIComponent(q + (category ? ' ' + category : ''))}`;
        
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('فشل الاتصال بالموقع المستهدف');
        }

        const html = await response.text();
        
        const results = [];
        const regex = /<a[^>]+href="(https:\/\/mcpedl\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        const seenUrls = new Set();

        while ((match = regex.exec(html)) !== null) {
            const url = match[1];
            
            if (url.includes('mcpedl.com/') && 
                url !== 'https://mcpedl.com/' && 
                !url.includes('/author/') && 
                !url.includes('/category/') && 
                !url.includes('/tag/') &&
                !url.includes('/page/') &&
                !seenUrls.has(url)) {
                
                seenUrls.add(url);
                
                let slug = url.split('/').filter(Boolean).pop() || '';
                let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                results.push({
                    title: title,
                    url: url,
                    source: 'mcpedl.com'
                });

                if (results.length >= 10) break;
            }
        }

        return res.status(200).json({
            success: true,
            query: q,
            results: results
        });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ أثناء جفق النتائج من الخادم',
            details: error.message 
        });
    }
}