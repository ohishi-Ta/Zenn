---
title: "GenU（Generative AI Use Cases JP）の閉域モードを試してみた"
emoji: "🐷"
type: "tech" # tech: 技術記事 / idea: アイデア
topics:
  - "aws"
  - "bedrock"
  - "genu"
published: true
published_at: "2025-09-07 20:22"
---
# はじめに
**GenU（Generative AI Use Cases JP）**のバージョン5.0.0から`閉域モード`に対応したようなので、試してみました。
これまで**GenU**は、クライアント～GenU間の通信はインターネット上のCloudFront経由で行われ閉域でのデプロイはサポートされておらず、カスタマイズする必要がありました。
https://github.com/aws-samples/generative-ai-use-cases/issues/721

`閉域モード`を使うことでCloudFrontを経由せず、閉域環境でも**GenU**を動作させることができるようになりました。

>・Amazon CloudFront は利用せず、Web の静的ファイルは Application Load Balancer と ECS Fargate でサーブします。
・Amazon Cognito へは Amazon API Gateway を経由してアクセスします。
・Lambda 関数から他サービスへの通信は VPC Endpoint 経由で行います。

## 公式ドキュメント
GitHubの公式ドキュメントです。
- [Generative AI Use Cases (略称:GenU)](https://github.com/aws-samples/generative-ai-use-cases/blob/main/README_ja.md)
- [デプロイオプション](https://github.com/aws-samples/generative-ai-use-cases/blob/main/docs/ja/DEPLOY_OPTION.md)
- [閉域モード](https://github.com/aws-samples/generative-ai-use-cases/blob/main/docs/ja/CLOSED_NETWORK.md)

# 構築
こちらからプロジェクトフォルダにクローンします。
https://github.com/aws-samples/generative-ai-use-cases/

## オプション設定
デフォルトでは、以下の点線以外の構成でデプロイされます。
点線の箇所は`/generative-ai-use-cases/packages/cdk/cdk.json`で有効化する必要があります。
![](/images/f36a5efefcee35/arch.drawio.png)

### 閉域モード関連のオプション
閉域モードを有効化するためには、
`closedNetworkMode`を`true`にします。
今回はこちらのみ設定します。
```
"closedNetworkMode": true,
```
閉域モード関連のオプションについては以下です。
既存のVPCやサブネットが選択でき、柔軟に対応できそうです。

| パラメータ                          | 説明                                                                                                                                                                                                 |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| closedNetworkMode                   | 閉域モードにするかどうか。`true` だと閉域モード。デフォルトは `false`。                                                                                                                           |
| closedNetworkVpcIpv4Cidr            | VPC を新規作成する場合に指定する IPv4 の CIDR。デフォルトでは `10.0.0.0/16`。                                                                                                                     |
| closedNetworkVpcId                  | VPC をインポートする場合の VPC ID。こちらを指定しないと VPC は新規作成になる。                                                                                                                    |
| closedNetworkSubnetIds              | GenU 関連のリソースをデプロイする Subnet の ID を複数指定。ALB、Fargate タスク、VPC Endpoint、Resolver Endpoint が作成される。指定しない場合は Isolated な Subnet が選択される。2 つ以上の Subnet ID を配列で指定する。 |
| closedNetworkCertificateArn         | GenU にドメインを付与する場合に指定する ACM の ARN。ACM は手動で生成する。指定しない場合、GenU は Application Load Balancer のデフォルトのエンドポイントで公開される。                          |
| closedNetworkDomainName             | GenU のドメイン名。Private Hosted Zone は CDK が生成するため、手動作成不要。`closedNetworkCertificateArn` と `closedNetworkDomainName` は両方指定するか、両方指定しないかのどちらかである必要あり。 |
| closedNetworkCreateTestEnvironment  | 検証環境を作成するかどうか。デフォルトで作成する。必要ない場合は `false` を指定する。検証環境は EC2 の Windows インスタンスとして作成し、Fleet Manager 経由でアクセスする。(詳細な手順は後述。) |
| closedNetworkCreateResolverEndpoint | Route53 の Resolver Endpoint を生成するかどうか。デフォルトで `true`。                                                                                                                           |

### 現状の制約
- デプロイはインターネットに疎通可能な環境で行う必要があります。また、動作検証環境にはマネージメントコンソールからアクセスするため、その場合もインターネット疎通が必要になります。
- デプロイには、通常モードのデプロイと同様の環境が必要です。具体的には、AWS IAM ユーザーの設定、Node.js、Docker が必要です。
- GenU がデプロイされるリージョンとモデルのリージョンは同一である必要があります。GenU を ap-northeast-1 にデプロイし、us-east-1 のモデルを利用するといったことは現状できません。
- 様々なリソースを作成するため、既存の VPC をインポートする場合は可能な限り clean な環境を利用することを推奨します。
- SAML 連携は利用できません。
- Voice Chat のユースケースは現状利用できません。
- AgentCore Chat のユースケースは現状利用できません。

## デプロイ
その後以下コマンドでデプロイしていきます。
CDKを使用するための準備については以下を参照ください。
https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/deploy.html

```
cd generative-ai-use-cases
npm ci
npx -w packages/cdk cdk bootstrap
npm run cdk:deploy

# 高速デプロイ (作成されるリソースを事前確認せずに素早くデプロイ)
npm run cdk:deploy:quick
```

注意として、`closedNetworkMode`が`true`の場合、アプリのデプロイリージョン（）とモデルリージョンが同じである必要があります。
以下は `"modelRegion": "us-east-1"`の場合に、`ap-northeast-1`でデプロイしようとしてるときのエラーです。
リージョンを合わせてデプロイしてください。
```
Error: The app region and modelRegion must be same if closedNetworkMode=true (ap-northeast-1 vs us-east-1)
```

# リソース確認
### VPC
![](/images/f36a5efefcee35/image-1.png)

デフォルトGenUだとパブリックサブネットしか作成されませんが、閉域モードだとプライベートサブネットのみになっています。
また、S3やDynamoDBへの接続のためゲートウェイエンドポイントが作成されています。
![](/images/f36a5efefcee35/image-2.png)
![](/images/f36a5efefcee35/image-3.png)

### CloudFront・ALB・ECS
>・Amazon CloudFront は利用せず、Web の静的ファイルは Application Load Balancer と ECS Fargate でサーブします。

デフォルトGenUだとCloudFrontが作成されていましたが、閉域モードだと作成されていないのが確認できました。
その代わり閉域モードでは、ALB・ECSが作成されていました。

CloudFrontを使用しないことで、以下が可能になりました。
- 企業のプライベートネットワーク内でのみ利用
- インターネットからの直接アクセスを制限
- データの外部流出リスクを最小化

![](/images/f36a5efefcee35/image-4.png)
![](/images/f36a5efefcee35/image-5.png)

### Lambda
> ・Lambda 関数から他サービスへの通信は VPC Endpoint 経由で行います。

以下のようにLambdaがVPC内で実行されることが確認できました。
![](/images/f36a5efefcee35/image-6.png)

### API Gateway
>・Amazon Cognito へは Amazon API Gateway を経由してアクセスします。

デフォルトGenUだと`Api`というものしかつくられませんが、閉域モードだと`GenU Cognito ID Pool Proxy API`と`GenU Cognito UserPool Proxy API`が新たに作成されていました。
名前の通り、CognitoへのアクセスがAPI Gateway経由で作成されていました。
![](/images/f36a5efefcee35/image-7.png)


# おわりに
閉域モードに対応した GenU（Generative AI Use Cases JP） を試すことで、CloudFront を経由せずに閉域環境での利用が可能になることが確認できました。
ALB や ECS、VPC Endpoint を組み合わせることで、企業内ネットワークに限定した安全な環境を構築できます。
また、Lambda や API Gateway を通じた各サービスへの接続も閉域内で完結させることが可能です。
現状の制約や注意点（デプロイにはインターネット環境が必要、リージョン制約、Docker 必須など）を理解した上で活用することで、よりセキュアな GenU の環境を作ることができます。
GenUのアップデートは日々更新されているので、さらに柔軟に利用できるようになっていくとでしょう。キャッチアップしていきたいと思います。