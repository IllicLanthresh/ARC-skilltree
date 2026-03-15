/**
 * Downloads ARC Raiders skill icons from the official community wiki (arcraiders.wiki).
 * Uses the MediaWiki API to resolve image URLs from the Skill_icons category.
 *
 * Usage: node scripts/download-icons.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const skillNodes = require('../src/lib/data/skillNodes.json');

const WIKI_API = 'https://arcraiders.wiki/w/api.php';
const OUT_DIR = 'static/icons';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function fetchJson(url) {
  return fetch(url).then((r) => JSON.parse(r.data.toString()));
}

// Build mapping from our iconName (snake_case.png) to wiki filename
function toWikiFilename(skillName) {
  return `File:Icon ${skillName}.png`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Step 1: Get all skill names from our data
  const skills = skillNodes.map((n) => ({ iconName: n.iconName, wikiName: n.name.en }));
  console.log(`Found ${skills.length} skills in data`);

  // Step 2: Resolve wiki image URLs via MediaWiki API (batch of 50)
  const wikiTitles = skills.map((s) => toWikiFilename(s.wikiName));
  const titlesParam = wikiTitles.map(encodeURIComponent).join('|');
  const apiUrl = `${WIKI_API}?action=query&titles=${titlesParam}&prop=imageinfo&iiprop=url&format=json`;

  console.log('Resolving image URLs from arcraiders.wiki...');
  const result = await fetchJson(apiUrl);

  const pages = result.query?.pages ?? {};
  const urlMap = new Map();
  for (const page of Object.values(pages)) {
    if (page.imageinfo && page.imageinfo.length > 0) {
      const title = page.title.replace('File:', '');
      urlMap.set(title, page.imageinfo[0].url);
    }
  }

  console.log(`Resolved ${urlMap.size}/${skills.length} image URLs`);

  // Step 3: Download each icon
  let downloaded = 0;
  let failed = 0;

  for (const skill of skills) {
    const wikiKey = `Icon ${skill.wikiName}.png`;
    const imageUrl = urlMap.get(wikiKey);

    if (!imageUrl) {
      console.warn(`  MISSING: ${skill.wikiName} (tried "${wikiKey}")`);
      failed++;
      continue;
    }

    const destPath = path.join(OUT_DIR, skill.iconName);
    try {
      const response = await fetch(imageUrl);
      if (response.status === 200) {
        fs.writeFileSync(destPath, response.data);
        downloaded++;
        process.stdout.write(`  ${downloaded}/${skills.length} ${skill.iconName}\r`);
      } else {
        console.warn(`  FAILED (${response.status}): ${skill.iconName}`);
        failed++;
      }
    } catch (err) {
      console.warn(`  ERROR: ${skill.iconName} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${failed} failed`);
}

main().catch(console.error);
