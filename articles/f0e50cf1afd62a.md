---
title: "【MCP】公式クイックスタートを活用してMCP天気予報サーバーを構築してみた"
emoji: "😊"
type: "tech"
topics:
  - "python"
  - "mcp"
  - "claude"
published: true
published_at: "2025-07-21 23:51"
---

## はじめに
MCPをキャッチアップしたところで、何か手を動かして作成してみたいと思い、MCPサーバーを作るクイックスタートが公開されているようでしたので、シンプルなMCP天気予報サーバーを構築し、ホストであるClaude for Desktopに接続してみました。

## MCPとは
MCPとは、Anthropic社が公開したAIエージェントと外部ツールを繋ぐ標準規格です。
従来各AI企業が独自方式でツール連携していた問題を解決し、一度作ればどのAIでも使える環境を実現します。
AIエージェントがMCPホスト、外部ツールがMCPサーバーとして相互通信し、天気取得やデータベース操作などのツール機能、ファイルなどのリソース、定型指示のプロンプトを提供します。Claude Desktopでの天気予報取得やGitHubリポジトリ分析、Slack連携などが可能で、AIエージェントの外部実行性能を飛躍的に向上させるAI時代の標準インフラです。


>MCPは、アプリケーションがLLMにコンテキストを提供する方法を標準化するオープンプロトコルです。MCPはAIアプリケーション用のUSB-Cポートのようなものだと考えてください。USB-Cがデバイスを様々な周辺機器やアクセサリに接続するための標準化された方法を提供するのと同様に、MCPはAIモデルを様々なデータソースやツールに接続するための標準化された方法を提供します。

https://modelcontextprotocol.io/introduction#general-architecture

https://speakerdeck.com/minorun365/yasasiimcpru-men?slide=14

## 環境構築
- python、uv のインストール
https://zenn.dev/tabayashi/articles/52389e0d6c353a
- Claude for Desktop のインストール
https://claude.ai/download

venvで仮想環境でセットアップをしていきます。
**仮想環境を使うメリット**
- **プロジェクト間の完全分離**
    - お互いに影響しない

- **クリーンな環境**
    - 必要なパッケージのみ

-  **バージョン管理**
    - プロジェクトごとに適切なバージョン

- **再現性**
    - 他の人も同じ環境を作れる

- **削除が簡単**
    - フォルダを消すだけで完全削除
 
https://gihyo.jp/article/2024/03/monthly-python-2403
https://docs.python.org/ja/3/library/venv.html

## 実装
プロジェクトの作成と初期化を行います。
```
uv init weather
cd weathe
source .venv/bin/activate
```

Python仮想環境を作成
```
uv venv
.venv\Scripts\activate

//Linuxの場合
source .venv/bin/activate
```

次に`mcp`をインストールしていきます。
`mcp[cli]` で`mcp`という名前のパッケージを、`cli`というオプション機能を含めてインストールしています。
```
uv add "mcp[cli]" httpx

//実行結果
 + annotated-types==0.7.0
 + anyio==4.9.0
 + attrs==25.3.0
 + certifi==2025.7.14
 + click==8.2.1
 + colorama==0.4.6
 + h11==0.16.0
 + httpcore==1.0.9
 + httpx==0.28.1
 + httpx-sse==0.4.1
 + idna==3.10
 + jsonschema==4.25.0
 + jsonschema-specifications==2025.4.1
 + markdown-it-py==3.0.0
 + mcp==1.12.0
 + mdurl==0.1.2
 + pydantic==2.11.7
 + pydantic-core==2.33.2
 + pydantic-settings==2.10.1
 + pygments==2.19.2
 + python-dotenv==1.1.1
 + python-multipart==0.0.20
 + pywin32==311
 + referencing==0.36.2
 + rich==14.0.0
 + rpds-py==0.26.0
 + shellingham==1.5.4
 + sniffio==1.3.1
 + sse-starlette==2.4.1
 + starlette==0.47.2
 + typer==0.16.0
 + typing-extensions==4.14.1
 + typing-inspection==0.4.1
 + uvicorn==0.35.0
```

### MCPサーバーコードの実装
weather.pyというファイルを作って、以下のコードを記述します。

このコードは[For Server Developers - Model Context Protocol](https://modelcontextprotocol.io/quickstart/server)から引用しています。

```python:weather.py
from typing import Any
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("weather")

# Constants
NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0"

async def make_nws_request(url: str) -> dict[str, Any] | None:
    """Make a request to the NWS API with proper error handling."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            return None

def format_alert(feature: dict) -> str:
    """Format an alert feature into a readable string."""
    props = feature["properties"]
    return f"""
Event: {props.get('event', 'Unknown')}
Area: {props.get('areaDesc', 'Unknown')}
Severity: {props.get('severity', 'Unknown')}
Description: {props.get('description', 'No description available')}
Instructions: {props.get('instruction', 'No specific instructions provided')}
"""

@mcp.tool()
async def get_alerts(state: str) -> str:
    """Get weather alerts for a US state.

    Args:
        state: Two-letter US state code (e.g. CA, NY)
    """
    url = f"{NWS_API_BASE}/alerts/active/area/{state}"
    data = await make_nws_request(url)

    if not data or "features" not in data:
        return "Unable to fetch alerts or no alerts found."

    if not data["features"]:
        return "No active alerts for this state."

    alerts = [format_alert(feature) for feature in data["features"]]
    return "\n---\n".join(alerts)

@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get weather forecast for a location.

    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
    """
    # First get the forecast grid endpoint
    points_url = f"{NWS_API_BASE}/points/{latitude},{longitude}"
    points_data = await make_nws_request(points_url)

    if not points_data:
        return "Unable to fetch forecast data for this location."

    # Get the forecast URL from the points response
    forecast_url = points_data["properties"]["forecast"]
    forecast_data = await make_nws_request(forecast_url)

    if not forecast_data:
        return "Unable to fetch detailed forecast."

    # Format the periods into a readable forecast
    periods = forecast_data["properties"]["periods"]
    forecasts = []
    for period in periods[:5]:  # Only show next 5 periods
        forecast = f"""
{period['name']}:
Temperature: {period['temperature']}°{period['temperatureUnit']}
Wind: {period['windSpeed']} {period['windDirection']}
Forecast: {period['detailedForecast']}
"""
        forecasts.append(forecast)

    return "\n---\n".join(forecasts)
if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
```


### コードの解説
**1. インポートとセットアップ**
```:python
pythonfrom typing import Any
import httpx
from mcp.server.fastmcp import FastMCP
```
解説:

typing.Any: 型ヒントで「任意の型」を表す
httpx: 非同期HTTP通信ライブラリ（requestsの非同期版）
FastMCP: MCPサーバーを簡単に作成するためのフレームワーク

```:python
python# Initialize FastMCP server
mcp = FastMCP("weather")
```
解説:

MCPサーバーインスタンスを作成
"weather"はサーバー名（Claude Desktopで表示される）

**2. 定数定義**
```:python
python# Constants
NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0"
```
解説:

NWS_API_BASE: National Weather ServiceのAPIベースURL
USER_AGENT: API呼び出し時の識別情報（多くのAPIで必須）

**3. HTTP リクエスト関数**
```:python
pythonasync def make_nws_request(url: str) -> dict[str, Any] | None:
    """Make a request to the NWS API with proper error handling."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            return None
```
解説:
＜関数シグネチャ＞

async def: 非同期関数（awaitで呼び出し可能）
-> dict[str, Any] | None: 戻り値の型ヒント

辞書またはNone を返す
|は Union型（Python 3.10+の書き方）



＜ヘッダー設定＞
```:python
pythonheaders = {
    "User-Agent": USER_AGENT,           # API提供者への身元証明
    "Accept": "application/geo+json"    # GeoJSON形式でのレスポンス要求
}
```
＜非同期HTTP通信＞
pythonasync with httpx.AsyncClient() as client:

async with: 非同期コンテキストマネージャー
リソースの自動クリーンアップを保証
```:python
pythonresponse = await client.get(url, headers=headers, timeout=30.0)
response.raise_for_status()  # HTTPエラー（4xx, 5xx）で例外発生
return response.json()       # JSONをPython辞書に変換
```
＜エラーハンドリング＞
```:python
pythonexcept Exception:
    return None
```
すべての例外をキャッチしてNoneを返す
呼び出し元でNoneチェックが必要

**4. データフォーマット関数**
```:python
pythondef format_alert(feature: dict) -> str:
    """Format an alert feature into a readable string."""
    props = feature["properties"]
    return f"""
Event: {props.get('event', 'Unknown')}
Area: {props.get('areaDesc', 'Unknown')}
Severity: {props.get('severity', 'Unknown')}
Description: {props.get('description', 'No description available')}
Instructions: {props.get('instruction', 'No specific instructions provided')}
"""
```
解説:

GeoJSONのfeatureオブジェクトから警報情報を抽出
.get(key, default): キーが存在しない場合のデフォルト値を設定
f"""...""": 複数行のf-string（フォーマット済み文字列）

**5. MCPツール定義**
気象警報ツール
```:python
python@mcp.tool()
async def get_alerts(state: str) -> str:
    """Get weather alerts for a US state.

    Args:
        state: Two-letter US state code (e.g. CA, NY)
    """
```
解説:

@mcp.tool(): デコレータでMCPツールとして登録
docstring: Claudeがツールの用途を理解するための説明文
Args: セクション: パラメータの説明

処理フロー
```:python
pythonurl = f"{NWS_API_BASE}/alerts/active/area/{state}"
data = await make_nws_request(url)

if not data or "features" not in data:
    return "Unable to fetch alerts or no alerts found."

if not data["features"]:
    return "No active alerts for this state."

alerts = [format_alert(feature) for feature in data["features"]]
return "\n---\n".join(alerts)
```
ステップ解説:

URL構築: 州コードを使ってAPI URL作成
データ取得: 非同期でAPI呼び出し
データ検証: レスポンスの妥当性チェック
リスト内包表記: 各警報をフォーマット
文字列結合: 区切り文字で結合して返却

**6. 天気予報ツール**
2段階API呼び出し
```:python
python# First get the forecast grid endpoint
points_url = f"{NWS_API_BASE}/points/{latitude},{longitude}"
points_data = await make_nws_request(points_url)

# Get the forecast URL from the points response
forecast_url = points_data["properties"]["forecast"]
forecast_data = await make_nws_request(forecast_url)
```
NWS APIの特徴:

Points API: 緯度経度から予報グリッド情報取得
Forecast API: グリッド情報から実際の予報データ取得

データ処理とフォーマット
```:python
pythonperiods = forecast_data["properties"]["periods"]
forecasts = []
for period in periods[:5]:  # Only show next 5 periods
    forecast = f"""
{period['name']}:
Temperature: {period['temperature']}°{period['temperatureUnit']}
Wind: {period['windSpeed']} {period['windDirection']}
Forecast: {period['detailedForecast']}
"""
    forecasts.append(forecast)

return "\n---\n".join(forecasts)
```
処理の詳細:

periods[:5]: スライシングで最初の5つの期間のみ取得
各期間の詳細情報を読みやすい形式でフォーマット
リストに追加後、区切り文字で結合

**7. サーバー起動部分**
```:python
pythonif __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
```
解説:

if __name__ == "__main__": スクリプト直接実行時のみ実行
transport='stdio': 標準入出力経由でMCP通信
Claude Desktopとの通信方式


## Claude Desctopで動作検証
Claude DesctopのMCPセットアップの方法はこちらをご覧ください。
https://zenn.dev/t_oishi/articles/11770898ae7449

claude_desktop_config.json　に以下の記述を追記します。
```
{
    "mcpServers": {
        "weather": {
            "command": "uv",
            "args": [
                "--directory",
                "C:\\Users\\user\\Desktop\\xxx",
                "run",
                "weather.py"
            ]
        }

    }
  }
```

問題なくMCPサーバーが作成でき、動作していることが確認できました！
今回使用している、`NWS（National Weather Service）のAPI`はアメリカの緯度経度しか対応していないので、動作確認時はアメリカの州の名前等でテストしましょう。
![](https://storage.googleapis.com/zenn-user-upload/e9ef76ed1208-20250721.png)