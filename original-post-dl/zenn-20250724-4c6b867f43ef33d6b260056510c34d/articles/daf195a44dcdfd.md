---
title: "【Terraform】使用するための環境構築"
emoji: "🍣"
type: "tech"
topics:
  - "aws"
  - "bash"
  - "terraform"
  - "iam"
  - "tfenv"
published: true
published_at: "2025-01-08 21:05"
---

今回はMacで構築していきます。

## AWS CLIでユーザーを登録する
### デフォルトユーザーのアカウントを登録する
- マネジメントコンソールからフル権限を持ったユーザーのアクセスキーを取得する。
- AWS CLIで登録する。
```
$ aws configure
```
- AWS Access Key ID 、AWS Secret Access Key、Default region name 、Default output formatを入力。
  - Default output formatはjson。
### Terraform用ユーザーのアカウントを登録する
- フル権限（AdministratorAccess）IAMユーザーを作成して、アクセスキーを取得。
- AWS CLIで登録。
```
$ aws configure --profile 設定するユーザー名
```
- AWS Access Key ID 、AWS Secret Access Key、Default region name 、Default output formatを入力。
  - Default output formatはjson。
### ユーザー登録できたか確認
- ホームディレクトリの`.aws`内の`credentials`を参照。

## GitBashのインストール
Windowsはインストール。Macは不要（zshがデフォルトで入っている）。
TerraformをWindowsで動かす場合、GitBashのみが動作確認済。

## Terraformのインストール
### tfenvのインストール
Terraformのバージョンを変えられる。（Volta的な感じ）
- ホームディレクトリでtfenvのリポジトリをクローン。
```
$ cd ~
$ git clone https://github.com/tfutils/tfenv.git
```
- パスを通す。
```.zshrc（Mac）
export PATH=$PATH:~/.tfenv/bin
```
```.bashrc（Windows）
export PATH=$PATH:/c/Users/ユーザー名/.tfenv/bin
```
- ターミナルを再起動し、パスが通ったか確認。
```
$ tfenv
```
- バージョンの一覧でインストールするバージョンを確認。
```
$ tfenv list-remote
```
- インストール。
```
$ tfenv install バージョン
```
- デフォルトに指定。
```
$ tfenv use バージョン
```
- Terraformバージョンの確認。
```
$ terraform version
```
- インストールしているバージョンの確認。
```
$ tfenv list
※がついているものがデフォルトバージョン
```

## git-secretsのインストール
アクセスキー情報のリポジトリへのコミットを防ぐ為。
WindowsとMacで方法が違う。今回はMacのみ。
```
$ brew install git-secrets
$ git secrets --register-aws --global
$ git secrets --install ~/.git-templates/git-secrets -f
$ git config --global init.templatedir ~/.git-templates/git-secrets

動作確認
$ git init
$ git add .
$ git commit -m "test"
```