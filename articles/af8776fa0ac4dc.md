---
title: "「Next.js+ヘッドレスCMSで始めるモダンWebサイト制作入門」を読んで"
emoji: "📘"
type: "tech"
topics:
  - "nextjs"
  - "microcms"
  - "入門"
published: true
published_at: "2024-10-03 15:04"
---

![](https://storage.googleapis.com/zenn-user-upload/3832235f720d-20241003.png)
[Amazonリンク](https://www.amazon.co.jp/Next-js%EF%BC%8B%E3%83%98%E3%83%83%E3%83%89%E3%83%AC%E3%82%B9CMS%E3%81%A7%E3%81%AF%E3%81%98%E3%82%81%E3%82%8B%EF%BC%81-%E3%81%8B%E3%82%93%E3%81%9F%E3%82%93%E3%83%A2%E3%83%80%E3%83%B3Web%E3%82%B5%E3%82%A4%E3%83%88%E5%88%B6%E4%BD%9C%E5%85%A5%E9%96%80-%E9%AB%98%E9%80%9F%E3%81%A7%E3%80%81%E5%AE%89%E5%85%A8%E3%81%A7%E3%80%81%E9%81%8B%E7%94%A8%E3%81%97%E3%82%84%E3%81%99%E3%81%84%E3%82%B5%E3%82%A4%E3%83%88%E3%81%AE%E3%81%A4%E3%81%8F%E3%82%8A%E3%81%8B%E3%81%9F-%E6%9F%B4%E7%94%B0-%E5%92%8C%E7%A5%88/dp/4798183660)

# はじめに
一度Next.jsとmicroCMSを使ってサイトを作成したことはありましたが、あまり覚えていない＋正しい構築方法が知りたいという思いで、はじめました。

# 環境構築
- Node.js v22.9.0
- Next.js v14.2.12
  
:::message
Next.js 13以降はNode.js 16.8以上が必要です。
:::

1. ```npm init```でpackage.json作成
2. ```volta pin node@latest```でnode.jsバージョン指定
3.プロジェクトディレクトリに入り、```volta pin node@latest```でnode.jsバージョン指定
4.```npm run dev```でスタート画面が見れれば成功

```
app
├── _actions
├── _components
│   ├── Article
│   ├── ButtonLink
│   ├── Category
│   ├── ContactForm
│   ├── Date
│   ├── Footer
│   ├── Header
│   ├── Hero
│   ├── Menu
│   ├── NewsList
│   ├── Pagenation
│   ├── SearchField
│   └── Sheet
├── _constants
├── _libs
├── contact
├── fonts
├── members
└── news
    ├── [slug]
    ├── category
    │   └── [id]
    ├── p
    │   └── [current]
    └── search
public

```

# 学べた点
### next/imageの使い方
- next/imageを使うことによってブラウザ幅に適したサイズの画像を自動で生成して最適化してくれる。
- 画像はpublicフォルダ内に格納
  
```js
import Image from "next/image";

export default async function Home() {
  return (
    <>
        <Image
          className={styles.bgimg}
          src="/img-mv.jpg"
          alt=""
          width={4000}
          height={1200}
        />
    </>
  );
}
```
### Linkの使い方
- 「リロードしないことで高速な遷移を行うことができる」らしい
```js
import Link from "next/link";

export default function Article({ data }: Props) {
  return (
     <>
        <Link href="/">リンク</Link>
     </>
  );
}
```

### Nested-layouts
- 階層ごとにlayout.tsxをおけば、各階層での共通レイアウトが設定できる。


### クライアントサイドでの実行もできる
- 先頭に"use client"を指定すれば、簡単にクライアントコンポーネントを利用できる
- Reactフックとか。今回はハンバーガーメニューのボタンクリックなどで使用していた。

### microCMSとの連携
- 繋ぎ込みは簡単だが、スキーマをしっかりと設計しないとTypescriptがごちゃごちゃになりそう。（慣れの問題なのかも知れないが）

### SSG、ISRの使いわけ
- 下記の記述だけで、SSR,ISRに対応できる
```js
export const revalidate = 10;
```

### Next.jsのみでカテゴリー分け、ページネーション、検索機能もつけれる

# デプロイ
VercelとmicroCMSの設定だけで、CMS側もSSGも自動でビルド・デプロイしてくれる。

# 感想
- ページ遷移がとにかく早い！
- Reactの知識がないと難しいので、それなりに学習コストは高い
- コンポーネントなど細かく作り込んでいくコストもかかる

## Next.jsを使った参考サイト
https://cwt.jp/category/58/1

