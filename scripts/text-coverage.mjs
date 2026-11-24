// How far each translation has come (npm run coverage:texts): for each
// language, the files it has of English's, the share of English's texts they
// hold, the stories it translates, and, for a draft (src/texts/languages.json),
// the files still in English, story by story, so that a translator can pick
// one. A story is translated once its every file is (src/texts/plugin.mjs,
// storyFiles): until then a draft plays it in English.
//
//   npm run coverage:texts            every language
//   npm run coverage:texts -- es      one language

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { languageInfo, storyFiles, translatedStories } from '../src/texts/plugin.mjs';

const TEXTS = 'src/texts';
const catalogue = JSON.parse(readFileSync('src/engine/catalogue.json', 'utf8'));
const files = (l) => readdirSync(join(TEXTS, l)).filter((f) => f.endsWith('.ftl')).sort();
const english = files('en');
// The number of texts (messages and their attributes) of a file: what a translator writes.
const size = (l, f) => readFileSync(join(TEXTS, l, f), 'utf8').split('\n').filter((line) => /^(-?[a-zA-Z][\w-]*\s*=|\s+\.[\w-]+\s*=)/.test(line)).length;
const total = english.reduce((n, f) => n + size('en', f), 0);

const wanted = process.argv[2];
const info = languageInfo();
const languages = Object.keys(info.languages).filter((l) => l !== 'en' && (!wanted || l === wanted));
for (const language of languages) {
  const present = files(language);
  const done = english.filter((f) => present.includes(f));
  const texts = done.reduce((n, f) => n + size('en', f), 0);
  const stories = translatedStories(language);
  const { name, status } = info.languages[language];
  console.log(`${language} (${name}), ${status}: ${done.length}/${english.length} files, ${texts}/${total} texts (${Math.floor((100 * texts) / total)} %), ${stories.length}/${catalogue.stories.length} stories`);
  if (status === 'complete') continue;
  const claimed = new Set(catalogue.stories.flatMap((s) => storyFiles(s, english)));
  const core = english.filter((f) => !claimed.has(f) && !present.includes(f));
  if (core.length) console.log(`  core files still in English: ${core.join(', ')}`);
  for (const story of catalogue.stories) {
    const missing = storyFiles(story, english).filter((f) => !present.includes(f));
    if (missing.length) console.log(`  ${story.id}: ${missing.length} file(s), ${missing.reduce((n, f) => n + size('en', f), 0)} texts: ${missing.join(', ')}`);
  }
}
