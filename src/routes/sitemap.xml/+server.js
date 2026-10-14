export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const origin = url.origin || 'https://catatai.com';
	const lastMod = new Date().toISOString().split('T')[0];

	const pages = [
		{ loc: `${origin}/`, priority: '1.0', changefreq: 'daily' },
		{ loc: `${origin}/#fitur`, priority: '0.9', changefreq: 'weekly' },
		{ loc: `${origin}/#demo`, priority: '0.9', changefreq: 'weekly' },
		{ loc: `${origin}/#kantong`, priority: '0.8', changefreq: 'weekly' },
		{ loc: `${origin}/#komparasi`, priority: '0.8', changefreq: 'weekly' },
		{ loc: `${origin}/#faq`, priority: '0.9', changefreq: 'weekly' }
	];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages
	.map(
		(page) => `\t<url>
\t\t<loc>${page.loc}</loc>
\t\t<lastmod>${lastMod}</lastmod>
\t\t<changefreq>${page.changefreq}</changefreq>
\t\t<priority>${page.priority}</priority>
\t</url>`
	)
	.join('\n')}
</urlset>`.trim();

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=3600'
		}
	});
}
