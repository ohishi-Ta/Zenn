const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// 既存のマッピングを読み込み
const existingMappingPath = path.join(__dirname, '../public/tags-mapping.json');
let existingMapping = {};
if (fs.existsSync(existingMappingPath)) {
  const data = JSON.parse(fs.readFileSync(existingMappingPath, 'utf8'));
  existingMapping = data.tagMapping || {};
}

// 全タグを1回のリクエストで処理する関数
async function processAllTagsInSingleRequest(newTags, articles) {
  console.log(`🚀 Processing ${newTags.length} tags in a single AI request...`);
  
  try {
    // タグリストとコンテキスト情報を準備
    const tagContexts = newTags.map(tag => {
      const contexts = articles
        .filter(a => a.topics.includes(tag))
        .slice(0, 2) // 各タグにつき最大2記事のコンテキスト
        .map(a => ({ title: a.title, otherTags: a.topics.filter(t => t !== tag) }));
      
      return {
        tag,
        contexts: contexts.length > 0 ? contexts : [{ title: 'なし', otherTags: [] }]
      };
    });

    const prompt = `あなたは技術用語の正式名称を判定する専門家です。
以下の${newTags.length}個のタグについて、それぞれの適切な表記（正式名称やよく使われる表記）をまとめて判定してください。

タグ一覧とコンテキスト:
${tagContexts.map((item, index) => 
  `${index + 1}. "${item.tag}"
   記事例: ${item.contexts[0].title}
   関連タグ: ${item.contexts[0].otherTags.slice(0, 3).join(', ') || 'なし'}`
).join('\n')}

判定ルール:
1. 公式ドキュメントで使われている正式名称を優先
2. 略語の場合は一般的に使われる大文字小文字を適用（例: aws → AWS, api → API）
3. フレームワーク名は公式の表記に従う（例: nextjs → Next.js, react → React）
4. AWSサービスは正式名称（例: apigateway → API Gateway）
5. 日本語タグの場合はそのまま返す
6. **不明な場合は、元のタグをそのまま返す（変更しない）**

回答は以下のJSON形式で、必ず全${newTags.length}個のタグを含めてください:
{
${newTags.map(tag => `  "${tag}": "正式名称または元のタグ"`).join(',\n')}
}`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000, // 大量のタグに対応
      },
    });

    console.log('🤖 Sending single batch request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    console.log('📥 Received response, parsing JSON...');
    console.log('🔍 Response preview:', content.substring(0, 500));
    
    // より柔軟なJSON抽出
    let jsonContent;
    
    // 1. 標準的なJSONブロックを探す
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    } else {
      // 2. コードブロック内のJSONを探す
      const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
      } else {
        // 3. 行ごとにJSONっぽい部分を探す
        const lines = content.split('\n');
        const jsonLines = [];
        let inJson = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            inJson = true;
            jsonLines.push(line);
          } else if (inJson && line.trim().endsWith('}')) {
            jsonLines.push(line);
            break;
          } else if (inJson) {
            jsonLines.push(line);
          }
        }
        
        if (jsonLines.length > 0) {
          jsonContent = jsonLines.join('\n');
        }
      }
    }
    
    if (!jsonContent) {
      console.error('❌ Full response content:');
      console.error(content);
      throw new Error('No JSON found in response');
    }
    
    console.log('🔍 Extracted JSON:', jsonContent.substring(0, 200) + '...');
    const aiMapping = JSON.parse(jsonContent);
    
    // AIの結果を小文字キーのマッピングに変換
    const normalizedMapping = {};
    Object.entries(aiMapping).forEach(([originalTag, properName]) => {
      normalizedMapping[originalTag.toLowerCase()] = properName;
    });
    
    // 処理されていないタグがあれば元のタグをそのまま使用
    const processedTags = Object.keys(normalizedMapping);
    const missingTags = newTags.filter(tag => !processedTags.includes(tag.toLowerCase()));
    
    if (missingTags.length > 0) {
      console.log(`⚠️  ${missingTags.length} tags missing from AI response, keeping original`);
      missingTags.forEach(tag => {
        normalizedMapping[tag.toLowerCase()] = tag; // 元のタグをそのまま使用
      });
    }
    
    console.log('✅ Successfully processed all tags in single request!');
    return normalizedMapping;

  } catch (error) {
    console.error('❌ AI request failed:', error.message);
    throw error; // エラーを再投げして処理を停止
  }
}

// frontmatterのみを効率的に読み込む
function readFrontmatterOnly(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
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
  
  const frontmatterContent = lines.slice(0, endIndex + 1).join('\n');
  try {
    const { data } = matter(frontmatterContent);
    return data;
  } catch (error) {
    console.warn(`Failed to parse frontmatter in ${filePath}:`, error.message);
    return null;
  }
}

// メイン処理
async function main() {
  console.log('🚀 Starting single-request tag mapping generation...');
  
  const articlesDir = path.join(__dirname, '../articles');
  const articles = [];
  const allTags = new Set();
  
  // frontmatterのみ読み込み
  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
  console.log(`📁 Found ${files.length} markdown files`);
  
  files.forEach(file => {
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
  });
  
  console.log(`📚 Found ${allTags.size} unique tags from ${articles.length} articles`);
  
  // 新しいタグのみを特定
  const allTagsArray = Array.from(allTags);
  const newTags = allTagsArray.filter(tag => !existingMapping[tag.toLowerCase()]);
  
  console.log(`🆕 ${newTags.length} new tags to process`);
  console.log(`♻️  ${allTagsArray.length - newTags.length} tags already mapped`);
  
  // 全タグを1回のリクエストで処理
  let newMappings = {};
  if (newTags.length > 0) {
    try {
      newMappings = await processAllTagsInSingleRequest(newTags, articles);
      
      // 処理結果をログ出力
      console.log('\n📋 Mapping results:');
      Object.entries(newMappings).forEach(([original, mapped]) => {
        const originalTag = newTags.find(t => t.toLowerCase() === original);
        const status = originalTag === mapped ? '(unchanged)' : '';
        console.log(`  ${originalTag} → ${mapped} ${status}`);
      });
    } catch (error) {
      console.error('💥 AI request failed completely:', error.message);
      process.exit(1); // 処理を停止
    }
  } else {
    console.log('✨ No new tags to process!');
  }
  
  // 既存のマッピングと新しいマッピングを統合
  const tagMapping = { ...existingMapping, ...newMappings };
  
  // データ構築
  const enrichedArticles = articles.map(article => ({
    ...article,
    topics: article.topics.map(topic => ({
      original: topic,
      display: tagMapping[topic.toLowerCase()] || topic
    }))
  }));
  
  // 統計生成
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
    generatedBy: 'Single-request Gemini-powered tag mapper v4.0',
    processing: {
      totalTags: allTagsArray.length,
      newTagsProcessed: newTags.length,
      existingTags: allTagsArray.length - newTags.length,
      requestsUsed: newTags.length > 0 ? 1 : 0
    }
  };
  
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  fs.writeFileSync(
    path.join(publicDir, 'tags-mapping.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('\n✅ Successfully generated tags mapping!');
  console.log(`   📊 Total tags: ${Object.keys(tagMapping).length}`);
  console.log(`   📝 Articles processed: ${articles.length}`);
  console.log(`   🆕 New tags processed: ${newTags.length}`);
  console.log(`   🔁 Existing tags reused: ${allTagsArray.length - newTags.length}`);
  console.log(`   🤖 AI requests used: ${output.processing.requestsUsed}`);
  console.log(`   ⚡ Mode: AI only (no fallback)`);
}

main().catch(console.error);
