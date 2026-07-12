# affiliate-x-bot

値下げしたオススメ商品のアフィリエイト投稿候補を作成するシステムです。
楽天市場と Amazon（PA-API 5.0）の両方に対応し、スマホ向けWebアプリから投稿文をコピーしてXへ手動投稿します。

## 仕組み

1. `config/watchlist.json` に登録した商品を、楽天市場商品検索API または Amazon Product Advertising API（PA-API 5.0）で定期的にチェックします。楽天は `config/ranking-watch.json` で楽天市場ランキングAPIのリアルタイムランキング監視もできます。
2. 前回チェック時の価格（`data/price-history.json`）と比較し、値下げ幅が `config/config.json` の `discountThreshold` 以上なら「値下げ商品」と判定します。
3. 値下げ幅が大きい順に最大 `maxCandidatesPerRun` 件を選び、商品名・値下げ前後の価格・割引率・アフィリエイトリンクを含む投稿文を組み立てます。
4. 候補は `data/post-candidates.json` に保存され、GitHub Pages上の投稿候補アプリで確認できます。
5. Hiroが投稿文をコピーし、Xアプリから最終確認して手動投稿します。X APIは使用しません。
6. GitHub Actions（`.github/workflows/affiliate-post.yml`）で定期実行し、価格履歴/候補データの更新結果をリポジトリにコミットして状態を保持します。

初回実行時はすべての商品が「前回価格の記録なし」となるため、投稿は行われず基準価格の記録だけが行われます。2回目以降のチェックから値下げ判定が有効になります。

## セットアップ

### 1. 楽天ウェブサービスの登録

- [楽天ウェブサービス](https://webservice.rakuten.co.jp/) で開発者登録し、`アプリID`（`RAKUTEN_APP_ID`）を取得します。
- [楽天アフィリエイト](https://affiliate.rakuten.co.jp/) に登録し、`アフィリエイトID`（`RAKUTEN_AFFILIATE_ID`）を取得します。

### 2. Amazon Product Advertising API (PA-API 5.0) の登録

- [Amazonアソシエイト](https://affiliate.amazon.co.jp/) に登録します（PA-APIの利用にはアソシエイトアカウントが必須です）。
- [Associates Central](https://affiliate.amazon.co.jp/assoc_credentials/home) の「Product Advertising API」から `アクセスキー`（`AMAZON_ACCESS_KEY`）と `シークレットキー`（`AMAZON_SECRET_KEY`）を発行します。
- アソシエイトタグ（`AMAZON_PARTNER_TAG`、例: `yourtag-22`）を確認します。
- **注意点**
  - PA-APIは新規登録直後は使えず、アソシエイト経由で**直近180日以内に3件以上の売上**が発生していないとリクエストが拒否されます（既存の売上実績がないと `TooManyRequests`/`InvalidParameterValue` 系のエラーになります）。
  - リクエスト数の上限（TPS）は売上実績に応じて上がる仕組みなので、`config/watchlist.json` にAmazon商品を大量に登録しすぎないようにしてください（本システムは同時に最大10件ずつバッチ取得することでリクエスト数を抑えています）。
  - Amazon.co.jp以外のマーケットプレイスを使う場合は `.env.example` にある `AMAZON_HOST` / `AMAZON_REGION` / `AMAZON_MARKETPLACE` を対象国に合わせて変更してください。

### 3. 監視する商品の登録

`config/watchlist.json` に商品を追加します。`provider` に `"rakuten"` または `"amazon"` を指定してください（省略時は `"rakuten"` 扱いになります）。

```json
[
  {
    "id": "vacuum-a",
    "label": "コードレス掃除機 Aモデル（楽天市場）",
    "provider": "rakuten",
    "itemCode": "shop-code:10000001",
    "enabled": true,
    "minDiscountRate": 0.15
  },
  {
    "id": "vacuum-b",
    "label": "コードレス掃除機 Bモデル（Amazon）",
    "provider": "amazon",
    "asin": "B0XXXXXXXX",
    "enabled": true,
    "minDiscountRate": 0.15
  }
]
```

- 楽天商品の `itemCode` は商品ページURLや商品検索APIのレスポンスに含まれる `店舗コード:商品コード` 形式の値です。
- Amazon商品の `asin` は商品ページURLに含まれる10桁の商品コード（ASIN）です。
- `minDiscountRate` を省略した場合は `config/config.json` の値が使われます。
- `enabled: false` にすると一時的に監視対象から外せます。

### 4. 楽天ランキング監視の登録

楽天市場ランキングAPIを使う場合は、`config/ranking-watch.json` に監視条件を追加します。初回実行時は価格履歴の作成だけを行い、2回目以降の実行で値下げ判定が有効になります。

```json
[
  {
    "id": "rakuten-realtime-all",
    "label": "楽天リアルタイムランキング全体",
    "provider": "rakuten-ranking",
    "enabled": true,
    "period": "realtime",
    "genreId": null,
    "pages": 1,
    "minDiscountRate": 0.15,
    "minReviewCount": 30,
    "minReviewAverage": 4,
    "maxPrice": 30000
  }
]
```

- `period` は `"realtime"` / `"daily"` / `"weekly"` / `"monthly"` を指定できます。
- `genreId` を `null` にすると全体ランキング、数値を指定するとジャンル別ランキングになります。
- `pages` は取得ページ数です。1ページあたり30件前後、最大10ページまでに制限しています。
- `minReviewCount` / `minReviewAverage` / `maxPrice` / `minPrice` で投稿候補を絞れます。
- ランキング由来の商品も、既存の値下げ率判定の対象になります。候補は価格が下がった実行時にだけ作成されます。

### 5. GitHub Secrets の登録

リポジトリの Settings > Secrets and variables > Actions に以下を登録します。楽天・Amazonのどちらか一方しか使わない場合も、`watchlist.json` にそのプロバイダの商品が1件もなければ該当シークレットは未設定のままで構いません（実行時にそのプロバイダのAPIは呼び出されません）。

| Secret名 | 内容 |
|---|---|
| `RAKUTEN_APP_ID` | 楽天ウェブサービスのアプリID |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイトID |
| `AMAZON_ACCESS_KEY` | Amazon PA-APIのアクセスキー |
| `AMAZON_SECRET_KEY` | Amazon PA-APIのシークレットキー |
| `AMAZON_PARTNER_TAG` | Amazonアソシエイトタグ |

`.github/workflows/affiliate-post.yml` は6時間おきに自動実行され、価格履歴と投稿候補を更新します。XへのAPI投稿は行いません。

### 6. 投稿候補アプリの公開

GitHubの `Settings` > `Pages` で、Sourceに **GitHub Actions** を指定します。以後、候補データが更新されるたびに `.github/workflows/deploy-pages.yml` がアプリを公開します。

公開URLをスマホのホーム画面へ追加し、候補カードの `コピー` と `Xを開く` を使って投稿します。`見送り` は、その端末のブラウザ内だけで候補を非表示にします。

## ローカルでの動作確認

```bash
cd affiliate-x-bot
cp .env.example .env   # 値を書き換える
npm install

# 投稿候補と価格履歴を更新する
npm start
```

## 広告表示（ステマ規制）について

アフィリエイトリンクを含む投稿は景品表示法の「ステルスマーケティング規制」の対象となり、広告であることが分かるよう明示する必要があります。`config/config.json` の `hashtags` に既定で `#PR` を含めています。表示方法を変更する場合も、広告であることが一目で分かる表記を必ず残してください。

## ディレクトリ構成

```
affiliate-x-bot/
  config/
    config.json        # しきい値・候補件数・ハッシュタグ
    watchlist.json      # 監視する商品一覧
    ranking-watch.json  # 楽天ランキング監視条件
  data/
    price-history.json  # 商品ごとの直近価格（自動更新）
    post-candidates.json # 投稿候補（自動更新・公開用）
  docs/                  # GitHub Pagesで公開するスマホ向け投稿候補アプリ
  src/
    index.js          # エントリーポイント
    lib/
      rakuten.js        # 楽天市場商品検索APIクライアント
      rakutenRanking.js # 楽天市場ランキングAPIクライアント
      amazon.js          # Amazon PA-API 5.0クライアント
      selectDiscounts.js # 値下げ判定ロジック
      composeTweet.js     # 投稿文の組み立て
      jsonStore.js          # JSON読み書きユーティリティ
```
