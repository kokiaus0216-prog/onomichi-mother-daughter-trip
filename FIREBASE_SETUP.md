# かえでとゆかの母娘旅行 in尾道 — ログイン不要の共有旅程

サイト: https://kokiaus0216-prog.github.io/onomichi-mother-daughter-trip/

**方式:** Firebase Authentication「匿名」の自動ログイン ＋ Cloud Firestore リアルタイム同期。

Googleアカウントへのログイン操作もUID登録も不要です。URLを知っている訪問者は誰でも旅程を閲覧・編集・追加・削除できます。写真・旅費・持ち物は従来どおり端末ごとの保存です。

GitHubのコードは実装済みですが、Firebase管理画面で次の **2つの設定** を公開するまでは、同期は開始されません。

## ① Firebase Authenticationで匿名認証を有効化

1. [Firebase認証・ログイン方法](https://console.firebase.google.com/project/onomichi-trip-2026/authentication/providers) を開く
2. 「新しいプロバイダを追加」→「匿名（Anonymous）」を選ぶ
3. 「有効にする」をオン →「保存」

既に有効にした「Google」プロバイダはそのままでもOK。アプリはログイン画面を表示せず匿名認証を行います。

## ② Firestoreにアクセスルールを公開

1. [Firestoreルール](https://console.firebase.google.com/project/onomichi-trip-2026/firestore/rules) を開く
2. 既存の内容を **[firestore.rules](./firestore.rules)** のテキストに置き換える
3. 「公開（Publish）」を押す

**注意:** GitHub上の `firestore.rules` の更新だけでは、Firestore本体のルールは変わりません。Consoleで公開する必要があります。

このルールは、匿名認証された人に **旅行の旅程文書1件のみ** 読み書きを許可します。ほかのデータパスは許可しません。旅程文書自体は一般公開に近い状態となり、荒らしや削除のリスクがあります。秘密・住所・予約番号・パスワードなどを旅程に含めないでください。個人の旅行情報がすでにHTMLソースに含まれている点にも注意してください。

## ③ 旅行しおりで操作

1. サイトをSafari/Chromeで開き、更新（リロード）する
2. 「旅程」タブに、開いた状態の **「✏️ 旅程を追加・編集する」** が表示される
3. Firebaseに自動で接続し「共有中・編集できます」に変わる
4. 各予定の「✎ 編集」から修正。「＋予定を追加」で新しいスポットを追加する
5. 反映された内容は別のスマホにも自動で表示される
6. 最初のアクセス時には既存の旅程を自動でFirestoreに保存する

「ゲスト接続ができません」なら匿名認証、「共有旅程へアクセスできません」ならFirestoreルールを確認してください。最新ルールの反映には時間がかかる場合があります。

## 安全に使うための注意

- 公開URLを知っている人は全員編集可能。URLは信頼できる相手にのみ送る。ただし、**リンクを秘密にするだけでは安全なアクセス制限にはなりません**。
- 編集前にしおりサイトのバックアップ機能で写真・メモなどを保存することをおすすめします。共有旅程自体の変更履歴からの復元機能は未実装です。
- 鉄道の予約情報をサイト上で変更しても、実際の切符・予約内容は変わりません。
- 写真アルバムのFirebase共有・LINE通知はまだ未実装。写真は端末内にのみ保存されます。
- Firebaseの利用量には無料枠と制限があり、公開編集は第三者の利用による費用・データ改変リスクがあります。必要ならFirebase App Checkや編集可能な相手を限定する方式を検討してください。

公式:
- https://firebase.google.com/docs/auth/web/anonymous-auth
- https://firebase.google.com/docs/firestore/security/get-started
