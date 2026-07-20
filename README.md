# atom2rss

GitHub の Atom フィードを RSS 2.0 に変換し続ける Cloudflare Worker です。
Microsoft Teams の RSS アプリ(Workflows / 旧 RSS コネクタ)は Atom を正しく読めないことがあるため、
この Worker を経由させることで GitHub のフィードを Teams で購読できるようにします。

```
Teams (RSS アプリ) ──→ atom2rss (Cloudflare Worker) ──→ github.com/*.atom
                        Atom → RSS 2.0 変換 + 5 分キャッシュ
```

## 使い方

Worker の URL に、github.com の Atom フィードのパスをそのまま付けるだけです。

| 読みたいもの | GitHub の Atom | Worker 経由の RSS |
| --- | --- | --- |
| リリース | `https://github.com/OWNER/REPO/releases.atom` | `https://atom2rss.<subdomain>.workers.dev/OWNER/REPO/releases.atom` |
| コミット | `https://github.com/OWNER/REPO/commits/main.atom` | `https://atom2rss.<subdomain>.workers.dev/OWNER/REPO/commits/main.atom` |
| タグ | `https://github.com/OWNER/REPO/tags.atom` | `https://atom2rss.<subdomain>.workers.dev/OWNER/REPO/tags.atom` |
| ユーザーの活動 | `https://github.com/USER.atom` | `https://atom2rss.<subdomain>.workers.dev/USER.atom` |

クエリ文字列はそのまま GitHub に渡されます(プライベートフィードの `?token=...` も利用可)。
取得先は `github.com` のパス(`.atom` で終わるもの)に固定しているため、オープンプロキシにはなりません。

## デプロイ(Cloudflare)

### 手動デプロイ

```bash
npm install
npx wrangler login   # ブラウザで Cloudflare にログイン
npm run deploy
```

デプロイ後に表示される `https://atom2rss.<あなたのsubdomain>.workers.dev` が公開 URL です。

### GitHub Actions で自動デプロイ

`main` ブランチへの push で自動デプロイされます(`.github/workflows/deploy.yml`)。
事前にリポジトリの **Settings → Secrets and variables → Actions** に
`CLOUDFLARE_API_TOKEN`(テンプレート「Edit Cloudflare Workers」で作成したトークン)を登録してください。

## Teams で購読する

1. Teams の対象チャネルで **「+」→ アプリから「Workflows」** を開く
   (または Workflows アプリで「フィード投稿が公開されたら通知する / Post to a channel when an RSS feed is published」テンプレートを選択)
2. RSS フィードの URL に Worker 経由の URL を入力
   例: `https://atom2rss.<subdomain>.workers.dev/cloudflare/workers-sdk/releases.atom`
3. 投稿先のチーム・チャネルを選んで保存

以降、GitHub 側の更新が RSS としてチャネルに投稿されます。

## 設定

- `wrangler.toml` の `CACHE_TTL_SECONDS`(既定 300 秒): GitHub への再フェッチ間隔。
  Cloudflare のキャッシュに載るため、GitHub のレート制限にはほぼかかりません。

## 開発

```bash
npm run dev        # http://127.0.0.1:8787 でローカル起動
npm test           # 変換ロジックのユニットテスト
npm run typecheck  # TypeScript 型チェック
```
