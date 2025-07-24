---
title: "【API Gateway・StepFunctions・Lambda】API Gatewayでリダイレクトさせる"
emoji: "📌"
type: "tech"
topics:
  - "aws"
  - "apigateway"
  - "stepfunctions"
published: true
published_at: "2025-07-02 18:39"
---

# はじめに
API Gateway でStepFunctionsと統合しているときに、APIのレスポンスによってリダイレクトをしたり処理を分ける方法は、フロント側で分岐させる方法もありますが、今回はバックエンドのみで実装してみます。
統合バックエンドでリダイレクトヘッダーを生成してAPI Gatewayでは単純にパススルーだけする方法ももちろん出来ますが、何らかの理由でAPI Gateway側で制御したい場合を考えて試してみます。

# StepFunctions使用の場合
## StepFunctions
下記のように最終的なステートで`statusCode`を出力するようにしておきます。
こちらはLambdaでも可能です。
```
{
  "statusCode": 302,
  "headers": {
    "Location": "https://example.com/"
  },
  "body": ""
}
```
![](https://storage.googleapis.com/zenn-user-upload/632849a07597-20250702.png)

## API Gateway
マッピングテンプレートで`context.responseOverride`を使用していきます。

統合レスポンスのマッピングテンプレートでcontext.responseOverrideを使用して以下のように記述します。
StepFunctionsから受け取ったデータの中の`statusCode`を見て、`context.responseOverride`で強制的にHTTPステータスコードを`301`に変更します。

```:VTL
#set($inputRoot = $input.path('$'))
#set($output = $util.parseJson($inputRoot.output))
#if($output.statusCode == 302)
  #set($context.responseOverride.status = 302)
  #set($context.responseOverride.header.Location = "$output.headers.Location")
  $output.body
#else
{
  "statusCode": 200,
  "body": $output
}
#end
```
--------

# Lambda使用の場合
Lambda関数内で処理することも可能ですが、今回はAPI Gateway側で制御していきます。
## Lambda
```python:python
import json

def lambda_handler(event, context):
    return {
        'result': 200
    }
```

## API Gateway
マッピングを行いたいので、プロキシ統合はオフにしておきます。

```:VTL
#set($inputRoot = $input.path('$'))
#if($inputRoot.result == 200)
#set($context.responseOverride.status = 302)
#set($context.responseOverride.header.Location = "https://example.com/")
#else
#set($context.responseOverride.status = 302)
#set($context.responseOverride.header.Location = "https://example.com/error")
#end
```