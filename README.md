# コスパモンスター投稿選定ツール

楽天ROOM「コスパモンスター」とXへ、自然な紹介文を手動投稿するための商品選定ツールです。
X APIによる自動投稿は行いません。

## 仕組み

1. Hiroが360LiFE・mybestなどの比較記事を確認し、紹介する商品と選定理由を`config/curated-products.json`へ登録します。
2. GitHub Actionsが毎日8時（日本時間）に楽天市場商品検索APIとAmazon PA-APIを呼び、価格・販売中かどうか・アフィリエイトリンクを確認します。
3. 販売中の商品のみをGitHub Pagesのアプリへ表示します。
4. 商品ごとに、体験区分に合う自然な投稿文を3案作ります。
5. Hiroが投稿文を確認・編集し、コピーまたは`Xを開く`から手動投稿します。

比較記事は**候補選定の根拠**であり、本文・評価表・画像・ランキングを自動取得、転載、再公開しません。投稿する商品画像は楽天・Amazonのアフィリエイト素材または自作画像だけを使います。

## 商品の選び方

`コスパモンスター`では、単なるランキング順位ではなく以下を満たす商品を候補にします。

- 360LiFE・mybestなど、比較方法が明示された記事で候補になっている
- 楽天またはAmazonで同一の型番・容量・色を販売中
- 誰に向くか、見送る条件が説明できる
- 誇大な効能や最安保証をしなくても魅力を伝えられる

特に化粧品、デオドラント、健康関連は、メーカーが示す範囲を超える効果保証を投稿しないでください。

## 商品設定

`config/curated-products.json`に1商品ずつ登録します。最初のサンプルは`enabled: false`です。実在の商品を登録するまで候補は表示されません。

```json
[
  {
    "id": "body-soap-example",
    "enabled": true,
    "priority": 100,
    "genre": "日用品",
    "target": "汗をかきやすく、さっぱり洗いたい人",
    "problem": "夏のボディソープ選びで迷っている",
    "postMode": "research",
    "reason": "洗い上がりと続けやすい価格のバランスを重視するなら候補になる",
    "caution": "香りや肌との相性はあるので、成分と容量を確認してください。",
    "primaryProvider": "rakuten",
    "sourceReferences": [
      {
        "publisher": "360LiFE",
        "title": "確認した比較記事の正確なタイトル",
        "url": "https://360life.shinyusha.co.jp/articles/-/12345",
        "checkedAt": "2026-07-23"
      }
    ],
    "rakuten": { "itemCode": "shop-code:10000001" },
    "amazon": { "asin": "B000000000" }
  }
]
```

### 必須項目

| 項目 | 内容 |
| --- | --- |
| `genre` | 日用品、車用品、ガジェットなど |
| `target` | どんな人に向ける商品か |
| `problem` | その人が抱える購入前の悩み |
| `reason` | 自分の言葉で書いた選定理由 |
| `caution` | 向かない人、確認すべき条件 |
| `sourceReferences` | 参照した比較記事のURL・タイトル・確認日 |
| `primaryProvider` | 投稿文に載せる主な購入先。`rakuten`または`amazon` |

### 投稿文モード

| 値 | 用途 | 使い方 |
| --- | --- | --- |
| `research` | 比較記事を根拠に選んだ商品 | 実際に使ったような表現はしない |
| `owned` | Hiroが実際に使った商品 | `personalNote`へ実感を自分の言葉で書く |
| `sale` | セール・価格情報が主題の商品 | 価格保証や虚偽の希少性表現はしない |

`rakuten.itemCode`と`amazon.asin`のどちらか一方だけでも登録できます。両方があればアプリに両方の購入先を表示します。

## セットアップ

### 楽天

- [楽天ウェブサービス](https://webservice.rakuten.co.jp/)で`RAKUTEN_APP_ID`を取得します。
- [楽天アフィリエイト](https://affiliate.rakuten.co.jp/)で`RAKUTEN_AFFILIATE_ID`を取得します。

### Amazon

- [Amazonアソシエイト](https://affiliate.amazon.co.jp/)でPA-APIの認証情報を発行します。
- `AMAZON_ACCESS_KEY`、`AMAZON_SECRET_KEY`、`AMAZON_PARTNER_TAG`を用意します。
- AmazonリンクをXで使う場合は、Xアカウントを利用サイトとして登録し、プロフィールにAmazonアソシエイトの所定開示を掲載してください。

### GitHub Secrets

リポジトリの`Settings > Secrets and variables > Actions`に設定します。

| Secret名 | 内容 |
| --- | --- |
| `RAKUTEN_APP_ID` | 楽天ウェブサービスのアプリID |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイトID |
| `AMAZON_ACCESS_KEY` | Amazon PA-APIのアクセスキー |
| `AMAZON_SECRET_KEY` | Amazon PA-APIのシークレットキー |
| `AMAZON_PARTNER_TAG` | Amazonアソシエイトタグ |

楽天のみ、Amazonのみを使う場合、`curated-products.json`に対象プロバイダの商品が1件もなければ、該当するSecretは不要です。

## GitHub Pages

GitHubの`Settings > Pages`でSourceに`GitHub Actions`を指定します。公開アプリでは、比較根拠、購入先、投稿文案を確認できます。

## ローカル確認

```bash
cd affiliate-x-bot
cp .env.example .env
npm ci
npm start
```

## 広告表示と投稿上の注意

- 投稿文の`【PR】`は削除しないでください。
- 体験していない商品を、使用したように書かないでください。
- 比較記事から文章・画像・評価表をコピーしないでください。
- 効果保証、最安保証、虚偽の在庫僅少表現をしないでください。
- 楽天・Amazonの規約と各商品の広告表現を投稿前に確認してください。
