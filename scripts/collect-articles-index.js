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

// CSV用のエスケープ処理
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // ダブルクォート、カンマ、改行が含まれる場合はダブルクォートで囲む
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    // ダブルクォートは二重にエスケープ
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

// メイン処理
async function main() {
  console.log('🚀 Starting article data collection for CSV...');
  
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
  
  // CSV形式で出力
  const csvHeader = 'filename,title,topics';
  const csvRows = articles.map(article => {
    // topicsをパイプ（|）で区切る
    const topicsStr = article.topics.join('|');
    
    return [
      escapeCSV(article.filename),
      escapeCSV(article.title),
      escapeCSV(topicsStr)
    ].join(',');
  });
  
  // CSVコンテンツを作成（BOM付きでExcelでも文字化けしない）
  const BOM = '\uFEFF';
  const csvContent = BOM + csvHeader + '\n' + csvRows.join('\n');
  
  // ファイルを保存
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  fs.writeFileSync(
    path.join(publicDir, 'articles-index.csv'),
    csvContent,
    'utf8'
  );
  
  console.log('\n✅ Successfully generated articles-index.csv!');
  console.log(`   📝 Total articles: ${articles.length}`);
  console.log(`   📊 Format: CSV with pipe-separated topics`);
  console.log(`   📁 Output: public/articles-index.csv`);
  
  // サンプル出力（最初の3件）
  if (articles.length > 0) {
    console.log('\n📋 Sample output (first 3 rows):');
    console.log('   ' + csvHeader);
    csvRows.slice(0, 3).forEach(row => {
      console.log('   ' + row);
    });
  }
}

main().catch(console.error);
