---
title: "【Terraform】RDSの作成"
emoji: "💭"
type: "tech"
topics:
  - "aws"
  - "mysql"
  - "terraform"
  - "rds"
published: true
published_at: "2025-01-12 23:43"
---

main.tfやterraform.tfvarsの内容はこちら。
https://zenn.dev/t_oishi/articles/c92f6a352ffa22

- 今回はRDSでMySQLをインストールします。

## パラメーターグループの作成
### aws_db_parameter_group
1. name : string : パラメーターグループ名
2. family : string : パラメーターグループのファミリー（mysql8.0,postgres12など）
3. parameter : block : 具体的なパラメーター（nameやvalueを設定）
5. tags : object : タグ

```HCL:rds.tf
#------------------
#RDS parameter group
#------------------
resource "aws_db_parameter_group" "mysql_standalone_parametergroup" {
  name = "${var.project}-${var.environment}-mysql-standalone-parametergroup"
  family = "mysql8.0"

  parameter {
    name = "character_set_database"
    value = "utf8mb4"
  }

  parameter {
    name = "character_set_server"
    value = "utf8mb4"
}
```

## オプショングループの作成
### aws_db_option_group
1. name : string : オプショングループ名
2. engine_name : string : 関連づけるエンジン名（mysql,postgresなど）
3. major_engine_version : string : 関連づけるエンジンバージョン（5.7,8.0など）
4. option : block : 具体的なオプション設定（option_name,option_settingsを設定）
5. tags : object : タグ

```HCL:rds.tf
#------------------
#RDS option group
#------------------
resource "aws_db_option_group" "mysql_standalone_optiongroup" {
  name                 = "${var.project}-${var.environment}-mysql-standalone-optiongroup"
  engine_name          = "mysql"
  major_engine_version = "8.0"
}
```

## サブネットグループの作成
### aws_db_subnet_group
1. name : string : サブネットグループ名
2. subnet_ids : string[] : サブネットID
3. tags : object : タグ

```HCL:rds.tf
#------------------
#RDS subnet group
#------------------
resource "aws_db_subnet_group" "mysql_standalone_subnetroup" {
  name       = "${var.project}-${var.environment}-mysql-standalone-subnetgroup"
  subnet_ids = [aws_subnet.private_subnet_1a.id, aws_subnet.private_subnet_1c.id]

  tags = {
    Name    = "${var.project}-${var.environment}-mysql-standalone-subnetgroup"
    Project = var.project
    Env     = var.environment
  }
}
```

## ランダム文字列の設定
RDSのパスワード設定に使うために、random_stringリソースとして定義します。
hashicorp/randomプロバイダーをインストールしないといけないので、applyする前に`terraform init`をする。
applyした後は、terraform.tfstateで確認。設定項目は他にもあるので、必要に応じて変更。

```HCL:rds.tf
resource "random_string" "db_password" {
  length  = 16
  special = false
}
```

## RDSの作成
### aws_db_instance（基本設定）
1. engine : string : データベースエンジン
2. engine_version : string : データベースエンジンのバージョン
3. identifier : string : RDSインスタンスリソース
4. instance_class : string : インスタンスタイプ
5. username : string : マスターDBのユーザー名
6. password : string : マスターDBのパスワード
7. tags : object : タグ
### aws_db_instance（ストレージ）
1. allocated_storage : string : 割り当てるストレージサイズ（ギガバイト）
2. max_allocated_storage : string : オートスケールさせる最大ストレージサイズ
3. storage_type : enum : standard,gp２,io1など
4. storage_encrypted : string : DBを暗号化するKMSキーIDまたはfalse
### aws_db_instance（DB設定）
1. db_name : string : データベース名
2. parameter_group_name : string : パラメータグループ名
3. option_group_name : string : オプショングループ名
### aws_db_instance（バックアップ）
1. backup_window : string : バックアップを行う時間帯
2. backup_retention_period : bool : バックアップを残す数
3. maintenance_window : string : メンテナンスを行う時間
4. auto_minor_version_upgrade : bool : 自動でマイナーバージョンアップグレードするかどうか
### aws_db_instance（削除防止）
1. deletion_protection : bool : 削除防止するかどうか
2. skip_final_snapshot : bool : 削除時のスナップショットをスキップするかどうか
3. apply_immediately : bool : 即時反映するかどうか

```HCL:rds.tf
resource "aws_db_instance" "mysql_standalone" {
  #基本設定
  engine         = "mysql"
  engine_version = "8.0.40"

  identifier = "${var.project}-${var.environment}-mysql-standalone"

  username = "admin"
  #上記で作成したrandom_string。最後に.result
  password = random_string.db_password.result

  instance_class = "db.t3.micro"

  #ストレージ
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp2"
  storage_encrypted     = false
  
  #ネットワーク
  multi_az          = false
  availability_zone = "ap-northeast-1a"
  #最後に.name
  db_subnet_group_name   = aws_db_subnet_group.mysql_standalone_subnetroup.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  publicly_accessible    = false
  port                   = 3306

  #DB設定
  db_name = "udemy_terraform"
  #最後に.name
  parameter_group_name = aws_db_parameter_group.mysql_standalone_parametergroup.name
  option_group_name    = aws_db_option_group.mysql_standalone_optiongroup.name

  #バックアップ
  backup_window              = "04:00-05:00"
  backup_retention_period    = 7
  maintenance_window         = "Mon:05:00-Mon:08:00"
  auto_minor_version_upgrade = false

  #削除防止
  deletion_protection = true
  skip_final_snapshot = false

  apply_immediately = true

  tags = {
    Name    = "${var.project}-${var.environment}-mysql-standalone"
    Project = var.project
    Env     = var.environment
  }
}
```