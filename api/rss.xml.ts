/**
 * RSS Feed Endpoint
 * 
 * This endpoint serves the RSS feed at /rss.xml
 * It calls the generate-rss cron endpoint logic
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://www.copydrum.com';
const SITE_TITLE = 'COPYDRUM - 전문 드럼 악보 쇼핑몰';
const SITE_DESCRIPTION = '전문 드러머를 위한 최고 품질의 드럼 악보를 제공하는 온라인 쇼핑몰';
const MAX_ITEMS = 100;

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  created_at: string;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date for RSS (RFC 822 format)
 */
function formatRssDate(dateString: string | null): string {
  if (!dateString) {
    return new Date().toUTCString();
  }
  
  try {
    const date = new Date(dateString);
    return date.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

/**
 * Generate RSS feed
 */
function generateRssFeed(sheets: DrumSheet[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  
  // Channel metadata
  xml += `    <title>${escapeXml(SITE_TITLE)}</title>\n`;
  xml += `    <link>${escapeXml(BASE_URL)}</link>\n`;
  xml += `    <description>${escapeXml(SITE_DESCRIPTION)}</description>\n`;
  xml += `    <language>ko</language>\n`;
  xml += `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>\n`;
  xml += `    <atom:link href="${escapeXml(`${BASE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />\n`;
  
  // Items
  sheets.forEach((sheet) => {
    const itemUrl = `${BASE_URL}/sheet-detail/${sheet.id}`;
    const itemTitle = `${escapeXml(sheet.title)} - ${escapeXml(sheet.artist)}`;
    const itemDescription = `${escapeXml(sheet.title)} - ${escapeXml(sheet.artist)} 드럼 악보`;
    const pubDate = formatRssDate(sheet.created_at);
    
    xml += '    <item>\n';
    xml += `      <title>${itemTitle}</title>\n`;
    xml += `      <link>${escapeXml(itemUrl)}</link>\n`;
    xml += `      <description>${itemDescription}</description>\n`;
    xml += `      <pubDate>${escapeXml(pubDate)}</pubDate>\n`;
    xml += `      <category>Drum</category>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>\n`;
    xml += '    </item>\n';
  });
  
  xml += '  </channel>\n';
  xml += '</rss>';
  return xml;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing required environment variables');
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch latest drum sheets
    const { data: sheets, error: sheetsError } = await supabase
      .from('drum_sheets')
      .select('id, title, artist, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (sheetsError) {
      console.error('Error fetching drum sheets:', sheetsError);
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
    }

    if (!sheets || sheets.length === 0) {
      // Return empty RSS feed
      const emptyRss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>COPYDRUM</title><link>https://www.copydrum.com</link><description>No items available</description></channel></rss>';
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      return res.status(200).send(emptyRss);
    }

    // Generate RSS feed
    const rssXml = generateRssFeed(sheets);

    // Return RSS XML
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.status(200).send(rssXml);
  } catch (error) {
    console.error('Fatal error:', error);
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
  }
}

