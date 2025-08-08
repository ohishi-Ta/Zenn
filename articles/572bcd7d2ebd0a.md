---
title: "【ECS】ECSについて改めて学んでみた"
emoji: "😸"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: []
published: false
---
# はじめに
これまでDockerを使用して、Wordpressを動かしたりの経験はありましたが、いろいろなブログの内容を元に行っていたので、あまり詳しい知識はありませんでした。
今回`AWS PartnerCast はじめてのコンテナ on AWS`に参加したので、まとめていきたいと思います。

# コンテナとは
コンテナは、アプリケーションを実行するための実行環境をパッケージ化した技術です。
アプリケーションとその依存関係（必要なライブラリや設定など）を一つのまとまりにし、それを軽量でスケール可能な形式でパッケージ化します。
これにより、コンテナを使うことでアプリケーションの環境に依存せず、どんな環境でも同じように動作させることができます。

![](https://storage.googleapis.com/zenn-user-upload/18b8f5d13022-20250807.png)

# Dockerとは
Dockerは、コンテナ技術を利用してアプリケーションを効率的にデプロイ、スケール、および管理するためのプラットフォームです。Dockerは、ソフトウェアを「コンテナ」と呼ばれる独立したユニットにパッケージ化します。このコンテナは、アプリケーションコード、ランタイム、ライブラリ、および依存関係をすべて含んでおり、どの環境でも一貫して動作します。

https://qiita.com/Sicut_study/items/4f301d000ecee98e78c9

# Dockerを使うメリット
### Docker コンテナの技術的特性
- アプリケーションに必要なものを１つにまとめられる
- インフラ構成をコード化できる- Infrastructure as a Code

### 技術的特性を活かすことで次のような効果が期待できる
- アプリケーションの可搬性が向上する
- 構成管理が容易になる

# Dockerの主要な構成要素
### Dockerfile
- コンテナを定義するための設計書

### Dockerイメージ
- コンテナを作成するためのテンプレート
- Dockerコンテナの構成要素をまとめたもの

### Dockerコンテナ
- Dockerイメージが実行できる状態になっているもの


# Dockerのワークフロー
**構築：build**
build DockerファイルからImageを作成
```
docker build
```

**実行：run**
Docker Imageからコンテナを起動
```
docker run
```

**運搬：push / pull**
Docker ImageをRegistryに保管/取得
```
docker push
docker pull
```
**Docker Hub（Registry）**
Docker社が提供しているDockerイメージの共有サービス

![](https://storage.googleapis.com/zenn-user-upload/c883123e8055-20250807.png)


###　Docker イメージ
Dockerコンテナの動作環境となるテンプレートファイルです。
Dockerイメージには、OSやアプリケーションからアプリケーションの実行に使われるコマンド、メタデータまで含まれます。

![](https://storage.googleapis.com/zenn-user-upload/c541e5e74b84-20250807.png)

### DockerイメージとDockerコンテナの違い
上記で述べたように、DockerイメージはDockerコンテナを動作させるのに使うテンプレートファイルを指します。

それに対し、Dockerコンテナはテンプレートファイルに基づいてアプリケーションを実行する環境・インスタンスです。1つのDockerイメージを実行すると1つのDockerコンテナが作成されます。

Dockerイメージを作るためには、まず設計書にあたる「Dockerfile」を作成します。
Dockerfileは、Dockerコンテナの設計内容をコマンド形式でまとめたテキストファイルです。

そうしてDockerfileをbuildする（組み立てる）ことで、Dockerイメージが作成されます。
さらにDockerイメージをrunする（実行可能な状態にする）ことで、Dockerコンテナが作成されるわけです。

# Dockerfileの基本的な文法

```txt
FROM amazonlinux:2 

# yum update & install 
RUN yum update -y ¥    && yum install php httpd -y 

# COPY index page 
COPY index.html /var/www/html/index.html 

# start web server 
CMD ["/usr/sbin/httpd","-DFOREGROUND"]
```

**FROM：ベースイメージ**
Dockerイメージのベースとなるイメージを指定します。

**RUN：build時実行コマンド**
Dockerコンテナ内で実行するコマンドを定義します。

**COPY：ローカルファイル追加**
Dockerを動かすホストOS内のファイルをDockerコンテナ内にコピーします。

**CMD：起動時実行コマンド**
Dockerコンテナを起動した時に実行するコマンドを定義します。

# DockerfileとDocker Composeの違い
`Dockerfile`は、Dockerイメージを構築するために使用される設定ファイルです。
Dockerfileには、イメージに含まれるファイルやアプリケーションの設定などが記述されます。

`Docker Compose`は、複数のDockerコンテナを組み合わせてアプリケーションを実行するためのツールです。docker-compose.ymlは、Docker Composeを使用するための設定ファイルで、複数のコンテナ間の関係や環境変数などが記述されます。

つまり、Dockerfileは単独のDockerイメージを作るための設定ファイルであり、docker-compose.ymlは複数のDockerイメージを組み合わせてアプリケーションを実行するための設定ファイルです。

例えば、データベースやアプリケーションサーバーも一緒に立ち上げて管理したいとなると、一つ一つrunするのも面倒になりますし、コンテナの同士のネットワーク（どのポート使うか）とかの設定も大変になります。
そこで、docker-compose.ymlで定義してあげるとまとめて管理していくことができます。

# ハンズオン：コンテナイメージを作成してビルド、実行する
### Dockerfile作成
```txt:Dockerfile
# ruby:3.2.1 というベースイメージを取得する
FROM public.ecr.aws/docker/library/ruby:3.2.1

# 必要なパッケージ群を取得する
RUN apt-get update -qq && \
    apt-get install -y nodejs postgresql-client npm && \
    rm -rf /var/lib/apt/lists/\*

# ローカルにあるファイルをコンテナイメージ内にコピーする
WORKDIR /myapp
COPY Gemfile /myapp/Gemfile

# Rails アプリケーションを作成する
RUN bundle install && \
    rails new . -O && \
    sed -i -e "52a\  config.hosts.clear\n  config.web_console.allowed_ips = '0.0.0.0/0'\n  config.action_dispatch.default_headers.delete('X-Frame-Options')" config/environments/development.rb

# Rails を 3000 番ポートで起動する
EXPOSE 3000
CMD ["rails", "server", "-b", "0.0.0.0", "-p", "3000"]
```

```txt:Gemfile
source 'https://rubygems.org'
gem 'rails', '7.2.2'
```

### コンテナイメージをビルドする
```
cd /workshop
docker build -t rails-app .
```
-t のあとの引数では、ビルドするコンテナイメージの "名前" を指定しています。最後のピリオド (.) は、ビルド時の "コンテクスト" としてカレントディレクトリを指定しています。ビルドの過程では、指定したコンテクストにあるファイルを参照できます。
`docker build -t <REPOSITORY: イメージの名前> <DOCKERFILE_DIRECTORY>`
**タグをつける場合**
`docker build -t <REPOSITORY: イメージの名前>:<タグの名前> <DOCKERFILE_DIRECTORY>`
タグを記述しない場合自動的に`latest`になります。
```
（例）
docker build -t rails-app:production .
```

ビルドしたイメージを確認
```
docker image ls
```
![](https://storage.googleapis.com/zenn-user-upload/afe5f024a203-20250807.png)

これで、コンテナの元となるコンテナイメージを作成できました。Ruby やアプリケーションファイルを準備して、コンテナイメージを作成することで、コンテナ実行環境さえ用意すれば、Ruby などのミドルウェアや依存ライブラリを設定しなくとも Ruby on Rails アプリケーションを実行できるようになりました。

### コンテナを実行する
```
docker run -d -p 8081:3000 rails-app:latest
```


# コンテナオーケストレーションとは


# ハンズオン：ECS
### 作るもの
- コンテナを動かすための前提環境
    - VPC
- コンテナ環境として用意するもの
    - ECR
    - ECS
    - Fargate
    - ALB

### 構成図
![](https://storage.googleapis.com/zenn-user-upload/5264a46fccd2-20250807.png)

VPCの作成は割愛します。

ECSの各種設定については、詳しくはこちら
https://blog.serverworks.co.jp/2023/10/24/104221#%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%81%AE%E3%83%91%E3%83%A9%E3%83%A1%E3%83%BC%E3%82%BF

# ECS コンソールでクラスターを作成する
**クラスター名**：`ecs-handson-cluster`
**インフラストラクチャ**：`AWS Fargate`

で作成します。

# コンテナイメージの保存（ECR）
ECS ではクラスター上でコンテナ実行しますが、そのコンテナの元となるコンテナイメージは別の場所から取得してくる必要があります。
今回は、VS Code Server上で作成したコンテナイメージを Elastic Container Registry (ECR) と呼ばれるイメージレジストリに保存します。

### ECR リポジトリを作成する

**リポジトリ名**；`rails-app`

![](https://storage.googleapis.com/zenn-user-upload/4a5069c99167-20250807.png)
![](https://storage.googleapis.com/zenn-user-upload/76364c9daee9-20250807.png)

「プッシュコマンドの表示」をクリックすると、コンテナイメージをレポジトリに push するためのコマンドを表示できます。
![](https://storage.googleapis.com/zenn-user-upload/916818043bca-20250807.png)
![](https://storage.googleapis.com/zenn-user-upload/cf2a5ec999c7-20250807.png)

### ECR にコンテナイメージを push する
VS Codeで下記を実行します。
先ほどの**「プッシュコマンドの表示」**をクリックして表示されたものを見て実行します。

```
# ディレクトリを移動する
cd /workshop
# AWS アカウント ID を取得する
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# ECR レジストリにログインする
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# コンテナイメージをビルドする
docker build -t rails-app .

# コンテナイメージにタグを付与する
docker tag rails-app:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/rails-app:latest

# タグを付与したコンテナイメージを ECR に push する
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/rails-app:latest
```

### 保存したコンテナイメージを確認する
ECRにプッシュされていることを確認できました。

![](https://storage.googleapis.com/zenn-user-upload/fdbce47235f5-20250807.png)

# タスク定義の作成

**タスク**：ECS でコンテナを実行する際の最小の実行単位であり、1 つのタスクには 1 つ以上のコンテナを含むことができます。
**タスク定義**：コンテナイメージやリソース量などを設定したテンプレートで、タスク定義をもとにタスクを起動します。
**サービス**：タスクを複数実行し続けるように設定したり、ALB との連携を設定したりできます。

![](https://storage.googleapis.com/zenn-user-upload/8d6236f7a971-20250807.png)

### タスク定義を作成する
**タスク定義ファミリー**；`ecs-handson-task`

![](https://storage.googleapis.com/zenn-user-upload/aacac9957c72-20250807.png)

### タスク実行ロールとタスクロール
> `タスク実行ロール`は、ユーザーに代わって AWS API コールを実行するためのアクセス許可を Amazon ECS コンテナと Fargate エージェントに付与します。タスク実行 IAM ロールは、タスクの要件に応じて必要です。さまざまな目的とサービスのタスク実行ロールを、アカウントに複数関連付けることができます。

https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task_execution_IAM_role.html

> Amazon ECS タスクには IAM ロールを関連付けることができます。IAM ロールで付与される許可は、タスクで実行されているコンテナによって引き受けられます。コンテナ化したアプリケーションは AWS API を呼び出す必要がある場合、AWS 認証情報でそれらの AWS API リクエストに署名する必要があります。なお、タスクの IAM ロールは、アプリケーションを使用するための認証情報を管理する戦略を利用できます。これは、Amazon EC2 インスタンスプロファイルが Amazon EC2 インスタンスに認証情報を提供する方法と似ています。AWS 認証情報を作成してコンテナに配布したり、Amazon EC2 インスタンスのロールを使用したりする代わりに、IAM ロールを Amazon ECS のタスク定義または RunTask API オペレーションに関連付けることができます。コンテナは、AWS SDK または AWS CLI を使用して認可された AWS サービスへの API リクエストを実行できます。

https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/task-iam-roles.html

**タスク実行ロール**
- タスク実行時にアクセスしたいAWSリソースの権限を管理

**タスクロール**
- タスク実行して起動したコンテナがアクセスしたいAWSリソースの権限を管理



続いて、実行するコンテナについて、設定していきます。
`イメージ URI`は先ほどプッシュしたECRのURIをコピーします。
![](https://storage.googleapis.com/zenn-user-upload/58389741caa5-20250807.png)

これでタスク定義を作成します。


### ALB 用のセキュリティグループを作成する
このハンズオンでは、複数のタスクにリクエストを負荷分散するためにロードバランサーを使用します。
ここでは、ALB 用のセキュリティグループを作成し、手元のブラウザから HTTP でアクセスできるようにします。

**セキュリティグループ名**：ecs-alb-sg
**説明**：ecs-alb-sg
**VPC**：ecs-handson-vpc
**タイプ**： (インバウンドルール) HTTP
**リソースタイプ**：(インバウンドルール) Anywhere-IPv4

アウトバウンドはデフォルトです。

![](https://storage.googleapis.com/zenn-user-upload/76ab4eee9c42-20250807.png)

# Fargate へのデプロイ
サーバーの管理が不要な AWS Fargate 上でコンテナを実行してみます。Fargate を使用することで、EC2 と比較して運用負荷を大きく削減することができます。

# Fargate 用のサービスを作成する

![](https://storage.googleapis.com/zenn-user-upload/6f079eb7b180-20250807.png)

**タスク定義ファミリー**：ecs-handson-task
**タスク定義のリビジョン**：1 (最新)
**サービス名**：ecs-fargate-service
**既存のクラスター**：ecs-handson-cluster（デフォルト）
**コンピューティングオプション**：キャパシティプロバイダー戦略（デフォルト）
**キャパシティプロバイダー戦略**：カスタムを使用 (アドバンスト)
**キャパシティプロバイダー**：FARGATE
**プラットフォームのバージョン**：LATEST（デフォルト）
**必要なタスク**：2
**ヘルスチェックの猶予期間**：30

![](https://storage.googleapis.com/zenn-user-upload/76d01013db7d-20250807.png)
![](https://storage.googleapis.com/zenn-user-upload/4fed60e60185-20250807.png)


サービスの設定についてこちらが詳しく書かれています。
https://blog.serverworks.co.jp/2023/10/24/104221#%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E3%81%AE%E3%83%91%E3%83%A9%E3%83%A1%E3%83%BC%E3%82%BF


![](https://storage.googleapis.com/zenn-user-upload/0ad12ad8a22f-20250807.png)

**ロードバランシングを使用**：ON
**ロードバランサーの種類**：Applicatioin Load Balancer（デフォルト）
**コンテナ**：rails-app 3000:3000
**Application Load Balancer**：新しいロードバランサーの作成（デフォルト）
**ロードバランサー名**：ecs-fargate-alb
**リスナー**：新しいリスナーを作成（デフォルト）
**ポート / プロトコル**	：80 / HTTP（デフォルト）
**ターゲットグループ**：新しいターゲットグループの作成（デフォルト）
**ターゲットグループ名**：ecs-fargate-tg

![](https://storage.googleapis.com/zenn-user-upload/6cdd803c00c6-20250807.png)
![](https://storage.googleapis.com/zenn-user-upload/42c5f821a086-20250807.png)

### デプロイの確認
EC2コンソール内のロードバランサーが表示されるので、ALB の DNS 名をコピーします。
無事にRails アプリケーションが表示されれば完成です。

![](https://storage.googleapis.com/zenn-user-upload/2b0e679e3a75-20250807.png)


# 参考サイト
https://blog.serverworks.co.jp/container-docker-ecs-ecr-beginner-zukai
https://blog.serverworks.co.jp/2023/10/24/104221