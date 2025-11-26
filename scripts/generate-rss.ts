/**
 * RSS Feed Generation Script for Naver
 * 
 * Generates RSS 2.0 feed for Korean site (copydrum.com)
 * Includes latest 50-100 drum sheets
 * 
 * Output: /public/rss.xml
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run generate:rss
 * 
 * This script runs automatically via Vercel Cron Jobs (daily).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://www.copydrum.com';
const SITE_TITLE = 'COPYDRUM - 전문 드럼 악보 쇼핑몰';
const SITE_DESCRIPTION = '전문 드러머를 위한 최고 품질의 드럼 악보를 제공하는 온라인 쇼핑몰';
const MAX_ITEMS = 100; // 최대 100개

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
  // XML must start with <?xml declaration, no leading whitespace or comments
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

/**
 * Main function
 */
async function main() {
  // Read environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Error: Missing required environment variables');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Fetch latest drum sheets (active only, ordered by created_at DESC)
  console.log(`Fetching latest ${MAX_ITEMS} drum sheets...`);
  const { data: sheets, error: sheetsError } = await supabase
    .from('drum_sheets')
    .select('id, title, artist, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(MAX_ITEMS);

  if (sheetsError) {
    console.error('Error fetching drum sheets:', sheetsError);
    process.exit(1);
  }

  if (!sheets || sheets.length === 0) {
    console.error('No active drum sheets found');
    process.exit(1);
  }

  console.log(`Found ${sheets.length} drum sheets`);

  // Generate RSS feed
  console.log('\nGenerating RSS feed...');
  const rssXml = generateRssFeed(sheets);
  
  // Output directory
  const publicDir = join(__dirname, '..', 'public');
  const rssFilename = join(publicDir, 'rss.xml');
  
  // Write RSS file
  writeFileSync(rssFilename, rssXml, 'utf-8');
  console.log(`✓ Wrote ${rssFilename}`);
  console.log(`\n✅ RSS feed generation complete!`);
  console.log(`   Generated ${sheets.length} items`);
  console.log(`   Feed URL: ${BASE_URL}/rss.xml`);
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

