---
title: "【Amazon Bedrock】Converse API（Converse/ConverseStream）についてまとめてみた"
emoji: "😽"
type: "tech"
topics:
  - "aws"
  - "bedrock"
  - "ai"
published: true
published_at: "2025-08-02 18:52"
---
# はじめに
Amazon Bedrockの`Converse API`を使用して、AIチャットを作成する機会があった為、`Converse API`について調べたことをまとめていきたいと思います。
また、`Converse API`以外にも用途に応じた推論APIがありましたので、その紹介もします。

# Amazon Bedrock Runtime APIの種類
https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Operations_Amazon_Bedrock_Runtime.html

## 同期推論API（即座にレスポンス）
リクエストを送るとすぐに結果が返る API で、短時間で完了する処理に向いています。
主にテキスト生成、画像生成、会話など、単発処理やリアルタイム応答が必要な場面で使用されます。
`InvokeModel`、`InvokeModelWithResponseStream`はモデル固有記述が必要（モデルごとにリクエスト形式やパラメータが異なる）ですが、`Converse`、`ConverseStream`は統一された記述方法で複数のモデルを扱うことができます。
- **Invoke系** → モデル固有の形式を理解してリクエストを書く必要がある
- **Converse系** → 統一フォーマットで書けるので、複数モデルを同じコードで扱いやすい

実務では、マルチターンやRAG連携、リアルタイム表示が必要な場合は `ConverseStream`が扱いやすそうです。

| API                               | 用途                | 特徴・詳細                                                                         |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| **InvokeModel**                   | 単発プロンプトの推論        | - モデル固有の入力形式を使用<br>- テキスト生成や画像生成など単発の処理に向く<br>- マルチターン対話はクライアント側で履歴を保持する必要あり  |
| **InvokeModelWithResponseStream** | 単発プロンプトのストリーミング推論 | - InvokeModel と同様だが、**トークンごとに逐次受信可能**<br>- レスポンスをリアルタイムで表示したい場合に便利            |
| **Converse**                      | 会話型推論（統一インターフェース） | - モデルに依存しない統一フォーマット<br>- 会話履歴を含めてマルチターン対話が可能<br>- ドキュメント添付やツール呼び出しも可能（RAGなど）  |
| **ConverseStream**                | 会話型ストリーミング推論      | - Converse のストリーミング版<br>- 会話の途中から部分的に応答を受け取り、リアルタイム表示可能<br>- チャットアプリや対話型UIに最適 |

## 非同期推論API（長時間処理）
実行に時間がかかるジョブ（動画生成、高解像度画像、大規模データ処理など）向け。
リクエスト送信後にバックグラウンドで処理され、完了したら結果を取得します。

| API                  | 用途          | 特徴・詳細                                                            |
| -------------------- | ----------- | ---------------------------------------------------------------- |
| **StartAsyncInvoke** | 非同期ジョブの開始   | - 動画生成、バッチ画像生成、大規模テキスト処理など時間がかかる処理向け<br>- ジョブIDを取得して後で結果を取りに行く形式 |
| **GetAsyncInvoke**   | 非同期ジョブの状態確認 | - ジョブの進捗状況や最終結果を取得<br>- ポーリングや EventBridge を使った通知で結果取得可能         |
| **ListAsyncInvokes** | 非同期ジョブの一覧取得 | - 複数ジョブの状態や履歴を管理<br>- 複数ユーザーやバッチ処理を扱う場合に便利                       |

## ユーティリティAPI
推論処理の補助や安全性チェックを行う API。

| API                | 用途        | 特徴・詳細                                          |
| ------------------ | --------- | ---------------------------------------------- |
| **CountTokens**    | トークン数カウント | - 入力テキストのトークン数を算出<br>- 料金計算やトークン制限の確認に使用       |
| **ApplyGuardrail** | ガードレール適用  | - 入力や出力を安全に制御<br>- 不適切な発話や禁止ワードのフィルタリングなどに利用可能 |

## 高度な対話API
特殊なリアルタイム双方向対話に対応。

| API                                    | 用途         | 特徴・詳細                                                      |
| -------------------------------------- | ---------- | ---------------------------------------------------------- |
| **InvokeModelWithBidirectionalStream** | 双方向ストリーミング | - 音声対話やリアルタイムチャットの双方向通信に対応<br>- ユーザー入力を受け取りつつモデル応答を逐次返す仕組み |


# Converse / ConverseStream
ここからは`Converse`、`ConverseStream`について深く見ていきます。

## 主な特徴
**統一インターフェース**: モデル間の差異を意識せずに同じAPIでアクセス可能
**マルチターン対話**: 会話履歴を維持した対話が容易
**ストリーミング対応**: ConverseStream APIによるリアルタイム応答
**Tool Use (Function Calling)**: 外部ツールとの連携機能
**マルチモーダル対応**: テキスト・画像・動画・ドキュメントの処理
**Guardrails対応**: 安全性制御機能の統合

https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html

## 対応モデル
以下が対応モデルです。主要なモデルはほぼ対応済みです。
埋め込みモデルやNova Cancvasなどの画像生成モデルは非対応です。
>Cohere Command (テキスト) と AI21 Labs Jurassic-2 (テキスト) は Converse API とのチャットをサポートしていません。モデルは一度に 1 つのユーザーメッセージのみを処理でき、会話の履歴を維持することはできません。複数のメッセージを渡そうとすると、エラーが発生します。

https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/conversation-inference-supported-models-features.html
:::message
`gpt-oss`モデルも**Converse / ConverseStream**に対応済みです。
https://aws.amazon.com/jp/blogs/news/openai-open-weight-models-now-available-on-aws/
:::

## 主要パラメータ
### 共通パラメータ
以下のパラメータは、ConverseおよびConverseStreamの両方で共通して使用されます。

`modelId`（必須）: 使用するモデルのIDまたはARN。
`messages`（必須）: 会話のメッセージのリスト。各メッセージはrole（userまたはsystem）とcontentを含みます。
`inferenceConfig`: 推論の設定。以下のパラメータを含むJSONオブジェクトです。
`temperature`: 生成される応答の多様性を制御します。0.0（決定論的）から1.0（多様性が高い）までの値を取ります。
`topP`: 生成される応答の確率分布の上位P%を考慮します。例えば、topP: 0.9は上位90%の確率を持つトークンを考慮します。
`maxTokens`: 生成される応答の最大トークン数。
`stopSequences`: 応答生成を停止するトークンのリスト。
`system`: モデルに対する指示やコンテキストを提供するシステムメッセージのリスト。
`promptVariables`: プロンプト管理で定義された変数とその値のマッピング。
`toolConfig`: モデルが使用するツールの設定。

### ConverseStream 特有パラメータ
`streamingConfig`: ストリーミングの設定。以下のパラメータを含むJSONオブジェクトです。

## messages フィールド内の content要素
`messages` フィールド内の `content`要素にはtextやimageなど様々な要素を渡すことができますが、モデル固有の制約や容量制限があります。
https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/conversation-inference-call.html#conversation-inference-call-request

### image（画像）
- `base64` でエンコードされた `raw バイト`を、`bytes` フィールド内の画像に渡します。
- リクエストボディでバイトを直接渡す代わりに、`Amazon S3 URI` を指定することもできます。
 ただし、以下のサポートされているモデルの`マルチメディア用の Amazon S3 リンク`列で`あり`になっているもののみです。

:::message
`content`フィールドには以下の制限が適用されます。
**最大 20 個**の画像を含めることができます。
各画像のサイズ、高さ、幅は、それぞれ **3.75 MB**、**8,000 px、8,000 px 以下**にする必要があります。
**最大 5 つのドキュメント**を含めることができます。各ドキュメントのサイズは **4.5 MB 以下**にする必要があります。
`role`が `user` の場合、画像とドキュメントのみを含めることができます。
:::

https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/conversation-inference-supported-models-features.html

https://qiita.com/PlanetMeron/items/2905e2d0aa7fe46a36d4

```py
# バイナリデータ（Raw bytes）を渡す
{
    "image": {
        "format": "png",
        "bytes": "<ここに画像データ>"
    }
}

# AWS SDK（Python の boto3 や Node.js SDK）を使う場合
with open("my_image.png", "rb") as f:
    image_bytes = f.read()

response = client.converse(
    modelId="my-model",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "image": {
                        "format": "png",
                        "bytes": image_bytes  # Base64 変換は不要
                    }
                }
            ]
        }
    ]
)

# Amazon S3 URI を指定（モデルによる）
{
    "image": {
        "format": "png",
        "source": { "s3Location": { "uri": "s3://bucket/image.png" } }
    }
}

```

### document（ドキュメント）
- `text`フィールド必須: `document`を含む場合、必ず`text`フィールドも必要
- `name`フィールドの文字制限:
    - アルファベットの文字
    - 空白文字 (連続した空白文字は使用不可)
    - ハイフン、括弧、角括弧のみ
- `base6`4 でエンコードされた `raw バイト`を、`bytes` フィールド内のドキュメントに渡します。 AWS SDK を使用する場合、`base64` のドキュメントのバイトをエンコードする必要はありません。

こちらも`image`同様`Amazon S3 URI` を渡せますが、モデル次第になります。

```py
{
    "role": "user",
    "content": [
        {
            "text": "string"
        },
        {
            "document": {
                "format": "pdf",
                "name": "MyDocument",
                "source": {
                    "bytes": "document in bytes"
                }
            }
        }
    ]
}

# Amazon S3 URI を指定（モデルによる）
{
    "role": "user",
    "content": [
        {
            "text": "string"
        },
        {
            "document": {
                "format": "pdf",
                "name": "MyDocument",
                "source": {
                    "s3Location": {
                      "uri": "s3://amzn-s3-demo-bucket/myDocument",
                      "bucketOwner": "111122223333"
                    }
                }
            }
        }
    ]
}
```

### video（動画）
- エンコーディング: AWS SDKを使う場合は`Base64`エンコード不要
- テキストなし: textフィールドを省略すると、モデルが動画を説明する
- S3権限: s3:GetObject権限が必要

こちらも`image`同様`Amazon S3 URI` を渡せますが、モデル次第になります。

```
{
    "role": "user",
    "content": [
        {
            "video": {
                "format": "mp4",
                "source": {
                    "bytes": "video in bytes"
                }
            }
        }
    ]
}
```

### cachePoint（キャッシュポイント）
- 用途: プロンプトキャッシュでコストと遅延を削減

### guardContent（ガードコンテンツ）
- 用途: 特定の入力のみをガードレールで評価

### reasoningContent（推論コンテンツ）
- 用途: モデルが回答を導く過程や思考の痕跡を確認したいとき。デバッグや説明可能 AI（XAI）的に利用。
- signatureフィールド必須: 全会話メッセージのハッシュ値
- 改ざん検証: メッセージが変更されるとエラーが発生
- 継続リクエスト: 後続のConverseリクエストにsignatureと全メッセージ履歴を含める必要
- redactedContent: モデルプロバイダーが安全性のため暗号化したコンテンツ

### toolUse（ツール使用）
- 用途: 外部 API 呼び出しや、検索・計算・ドキュメント参照などをモデルが実行する場合。どのツールをどのように使うかを示す。
- モデル生成のみ: ユーザーが直接作成してはいけない
- toolUseId必須: ツール実行の識別用ID
- inputスキーマ準拠: 事前定義されたツールスキーマに従う必要
- アシスタントロールのみ: role = "assistant"でのみ使用可能


### toolResult（ツール結果）
- 用途: toolUse で指定した外部ツールの返り値を格納。モデルの最終回答を生成する際に内部的に利用。
- toolUseIdマッチング: 対応するtoolUseのIDと一致させる必要
- ユーザーロールのみ: role = "user"でのみ使用可能
- 順序重要: toolUseの後に必ずtoolResultを送信


## ConverseStream 実装例

```py
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")

# ConverseStream APIでストリーミングリクエストを送信
response = client.converse_stream(
   # 使用するモデルID
   modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
   
   # メッセージ配列
   messages=[
       {
           "role": "user",  # メッセージの送信者
           "content": [{"text": "日本について200文字で説明してください"}]  # 質問内容
       }
   ],
   
   # 推論設定
   inferenceConfig={
       "maxTokens": 1000,    # 最大生成トークン数
       "temperature": 0.1    # 応答のランダム性
   }
)

# ストリーミングレスポンスを1つずつ処理
for event in response["stream"]:
   # テキストの差分データが含まれている場合
   if "contentBlockDelta" in event:
       delta = event["contentBlockDelta"]["delta"]
       
       # テキストデータが存在する場合
       if "text" in delta:
           # テキストを改行なし、即座に出力（リアルタイム表示）
           print(delta["text"], end="", flush=True)
   
   # メッセージ終了イベントの場合
   elif "messageStop" in event:
       print("\n処理完了")  # 改行して完了メッセージを表示
       break  # ループを終了
```

# おわりに
Amazon BedrockのConverseおよびConverseStreamは、モデル固有の違いを意識せず統一フォーマットで利用できるため、複数モデルを同じコードで扱いやすいのが大きな特徴です。
マルチターンの会話やリアルタイム表示、外部ツールとの連携も簡単に実装でき、チャットアプリやRAG連携システムの構築に非常に便利です。

**参考サイト**
https://dev.classmethod.jp/articles/amazon-bedrock-converse-api/
https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_ConverseStream_Mistral_section.html
https://docs.aws.amazon.com/bedrock/
https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Types_Amazon_Bedrock_Runtime.html