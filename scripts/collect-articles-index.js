const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

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
  console.log('🚀 Starting article data collection...');
  
  const articlesDir = path.join(__dirname, '../articles');
  const articles = [];
  
  // frontmatterのみ読み込み
  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
  console.log(`📁 Found ${files.length} markdown files`);
  
  files.forEach(file => {
    const filePath = path.join(articlesDir, file);
    const frontmatter = readFrontmatterOnly(filePath);
    
    if (frontmatter && frontmatter.published && frontmatter.topics) {
      const filename = file.replace('.md', '');
      
      articles.push({
        filename: filename,
        title: frontmatter.title,
        topics: frontmatter.topics
      });
    }
  });
  
  console.log(`📚 Collected ${articles.length} published articles`);
  
  // 出力データ
  const output = {
    articles: articles
  };
  
  // ファイルを保存
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  fs.writeFileSync(
    path.join(publicDir, 'articles-index.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('\n✅ Successfully generated articles-index.json!');
  console.log(`   📝 Total articles: ${articles.length}`);
}

main().catch(console.error);
