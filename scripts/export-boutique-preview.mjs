import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PRODUCTS, CATEGORIES, LOCATIONS } from '../js/catalog.js';
import { BLOG_POSTS } from '../js/blogs.js';
import { DEFAULT_HOME, DEFAULT_SITE } from '../js/site-content.js';

const target = process.argv[2] && resolve(process.argv[2]);
if (!target || !existsSync(join(target,'.openai/hosting.json'))) throw new Error('Pass the existing Site checkout with its hosting manifest.');
const source = resolve(import.meta.dirname,'../vercel-site/dist');
const output=join(target,'dist');
cpSync(source,output,{recursive:true,force:true});
mkdirSync(join(output,'api'),{recursive:true});
writeFileSync(join(output,'api/content'),JSON.stringify({products:PRODUCTS,categories:CATEGORIES,locations:LOCATIONS,blogs:BLOG_POSTS,home:DEFAULT_HOME,site:DEFAULT_SITE,meta:{source:'preview',stale:false}}));
writeFileSync(join(output,'api/runtime-config'),JSON.stringify({local_auth_bypass:false,firebase:{}}));
for(const name of ['index','gifting','shop','product','bag','checkout','journal','blog','account','login','contact','help','404']) {
  const path=join(output,`${name}.html`);
  let html=readFileSync(path,'utf8');
  if(!html.includes('/js/preview-only.js'))html=html.replace('</body>','<script type="module" src="/js/preview-only.js"></script></body>');
  writeFileSync(path,html);
}
console.log('Exported the boutique review build with local recipient saves and payments disabled.');
