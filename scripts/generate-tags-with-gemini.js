const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// 既存のマッピングを読み込み（学習データとして使用）
const existingMappingPath = path.join(__dirname, '../public/tags-mapping.json');
let existingMapping = {};
if (fs.existsSync(existingMappingPath)) {
  const data = JSON.parse(fs.readFileSync(existingMappingPath, 'utf8'));
  existingMapping = data.tagMapping || {};
}

// よく使われる技術タグの基本ルール（AIへのヒント用）
const knownPatterns = {
  aws_services: ['ec2', 's3', 'lambda', 'rds', 'dynamodb', 'cloudfront'],
  programming_languages: ['javascript', 'typescript', 'python', 'go', 'rust'],
  frameworks: ['react', 'vue', 'angular', 'nextjs', 'nuxtjs'],
  databases: ['mysql', 'postgresql', 'mongodb', 'redis'],
  tools: ['docker', 'kubernetes', 'terraform', 'ansible'],
};

async function getProperTagName(tag, context = {}) {
  // 既にマッピングがある場合はそれを使用
  if (existingMapping[tag.toLowerCase()]) {
    return existingMapping[tag.toLowerCase()];
  }

  try {
    const prompt = `
あなたは技術用語の正式名称を判定する専門家です。
以下のタグの適切な表記（正式名称やよく使われる表記）を判定してください。

タグ: "${tag}"

コンテキスト情報:
- 記事タイトル: ${context.title || 'なし'}
- 他のタグ: ${context.otherTags ? context.otherTags.join(', ') : 'なし'}
- 記事タイプ: ${context.type || 'tech'}

既存のマッピング例:
${JSON.stringify(Object.entries(existingMapping).slice(0, 10), null, 2)}

判定ルール:
1. 公式ドキュメントで使われている正式名称を優先
2. 略語の場合は一般的に使われる大文字小文字を適用（例: aws → AWS, api → API）
3. フレームワーク名は公式の表記に従う（例: nextjs → Next.js, react → React）
4. 日本語タグの場合はそのまま返す
5. 不明な場合は、最も一般的と思われる表記を推測

回答は以下のJSON形式で、理由の説明は不要です:
{"proper_name": "正式名称"}
`;

    // Gemini Proモデルを使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // コスト効率の良いモデル
      generationConfig: {
        temperature: 0.1, // 一貫性を重視
        maxOutputTokens: 100,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    // JSONパースを試行
    const jsonMatch = content.match(/\{[^}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.proper_name;
    }
    
    // JSON形式でない場合は、内容から推測
    throw new Error('Invalid JSON response');

  } catch (error) {
    console.error(`Error processing tag "${tag}":`, error.message);
    
    // AIが失敗した場合の簡単なフォールバック処理
    return applyBasicRules(tag);
  }
}

// AIが使えない場合の基本的なルール
function applyBasicRules(tag) {
  const lower = tag.toLowerCase();
  
  // よく知られた略語は大文字に
  const commonAcronyms = ['api', 'aws', 'gcp', 'ai', 'ml', 'ci', 'cd', 'url', 'uri', 'html', 'css', 'svg', 'pdf', 'json', 'xml', 'sql', 'orm', 'cms', 'cdn', 'dns', 'ssh', 'ssl', 'tls', 'vpc', 'iam', 'ram', 'cpu', 'gpu', 'seo'];
  if (commonAcronyms.includes(lower)) {
    return tag.toUpperCase();
  }
  
  // .jsや.tsで終わる場合は特別処理
  if (lower.endsWith('js')) {
    const base = lower.slice(0, -2);
    return base.charAt(0).toUpperCase() + base.slice(1) + '.js';
  }
  
  if (lower.endsWith('ts')) {
    const base = lower.slice(0, -2);
    return base.charAt(0).toUpperCase() + base.slice(1) + '.ts';
  }
  
  // キャメルケースっぽいものは維持
  if (tag.match(/[a-z][A-Z]/)) {
    return tag;
  }
  
  // それ以外は最初を大文字に
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

// バッチ処理で効率化
async function processTagsInBatch(uniqueTags, articles) {
  const tagMapping = { ...existingMapping };
  const newTags = [];
  
  for (const tag of uniqueTags) {
    if (!tagMapping[tag.toLowerCase()]) {
      newTags.push(tag);
    }
  }
  
  console.log(`Found ${newTags.length} new tags to process`);
  
  // 新しいタグをバッチで処理（API呼び出しを削減）
  for (const tag of newTags) {
    // タグが使われている記事のコンテキストを収集
    const contexts = articles
      .filter(a => a.topics.includes(tag))
      .slice(0, 3) // 最初の3記事だけ使用
      .map(a => ({
        title: a.title,
        otherTags: a.topics.filter(t => t !== tag),
        type: a.type
      }));
    
    const properName = await getProperTagName(tag, contexts[0] || {});
    tagMapping[tag.toLowerCase()] = properName;
    console.log(`  ${tag} → ${properName}`);
    
    // レート制限対策（Geminiは1分あたり60リクエスト）
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return tagMapping;
}

// frontmatterのみを効率的に読み込む関数
function readFrontmatterOnly(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // frontmatterの終了位置を見つける（2つ目の --- を探す）
  const lines = content.split('\n');
  if (lines[0] !== '---') return null;
  
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) return null;
  
  // frontmatter部分のみを解析
  const frontmatterContent = lines.slice(0, endIndex + 1).join('\n');
  try {
    const { data } = matter(frontmatterContent);
    return data;
  } catch (error) {
    console.warn(`Failed to parse frontmatter in ${filePath}:`, error.message);
    return null;
  }
}

// メイン処理（topicsタグのみを収集するように最適化）
async function main() {
  const articlesDir = path.join(__dirname, '../articles');
  const articles = [];
  const allTags = new Set();
  
  // 記事データを収集（frontmatterのみ読み込み）
  fs.readdirSync(articlesDir).forEach(file => {
    if (file.endsWith('.md')) {
      const filePath = path.join(articlesDir, file);
      const frontmatter = readFrontmatterOnly(filePath);
      
      if (frontmatter && frontmatter.published && frontmatter.topics) {
        const article = {
          slug: file.replace('.md', ''),
          title: frontmatter.title,
          emoji: frontmatter.emoji,
          type: frontmatter.type || 'tech',
          topics: frontmatter.topics,
          published_at: frontmatter.published_at
        };
        
        articles.push(article);
        frontmatter.topics.forEach(tag => allTags.add(tag));
      }
    }
  });
  
  console.log(`Processing ${allTags.size} unique tags from ${articles.length} articles...`);
  
  // AIでタグマッピングを生成
  const tagMapping = await processTagsInBatch(Array.from(allTags), articles);
  
  // 記事データにマッピングを適用
  const enrichedArticles = articles.map(article => ({
    ...article,
    topics: article.topics.map(topic => ({
      original: topic,
      display: tagMapping[topic.toLowerCase()] || topic
    }))
  }));
  
  // 統計情報を生成
  const tagStats = {};
  enrichedArticles.forEach(article => {
    article.topics.forEach(topic => {
      const displayName = topic.display;
      if (!tagStats[displayName]) {
        tagStats[displayName] = {
          count: 0,
          articles: [],
          variations: new Set()
        };
      }
      tagStats[displayName].count++;
      tagStats[displayName].articles.push(article.slug);
      tagStats[displayName].variations.add(topic.original);
    });
  });
  
  // Set を配列に変換
  Object.keys(tagStats).forEach(key => {
    tagStats[key].variations = Array.from(tagStats[key].variations);
  });
  
  // 出力
  const output = {
    tagMapping,
    articles: enrichedArticles,
    tagStats,
    totalTags: Object.keys(tagMapping).length,
    lastUpdated: new Date().toISOString(),
    generatedBy: 'Gemini-powered tag mapper v2.0'
  };
  
  // publicディレクトリがなければ作成
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  fs.writeFileSync(
    path.join(publicDir, 'tags-mapping.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log(`✅ Successfully generated tags mapping with Gemini!`);
  console.log(`   - Total tags: ${Object.keys(tagMapping).length}`);
  console.log(`   - Articles processed: ${articles.length}`);
  console.log(`   - New tags added: ${Object.keys(tagMapping).length - Object.keys(existingMapping).length}`);
}

main().catch(console.error);
