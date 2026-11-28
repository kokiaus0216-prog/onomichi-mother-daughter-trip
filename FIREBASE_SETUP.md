# かえでとゆかの母娘旅行 in尾道 — ログイン不要の共有旅程

サイト: https://kokiaus0216-prog.github.io/onomichi-mother-daughter-trip/

**方式:** Firebase Authentication「匿名」の自動ログイン ＋ Cloud Firestore リアルタイム同期。

Googleアカウントへのログイン操作もUID登録も不要です。URLを知っている訪問者は誰でも旅程を閲覧・編集・追加・削除できます。写真は共有アルバムに同期可能です。写真の元データ・旅費・持ち物は従来どおり各端末にも保存されます。

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

このルールは、匿名認証された人に既存の **旅行の旅程文書1件** と、新しい **写真の共有コレクション** の読み書きを許可します。ほかのデータパスは許可しません。旅程文書自体は一般公開に近い状態となり、荒らしや削除のリスクがあります。秘密・住所・予約番号・パスワードなどを旅程に含めないでください。個人の旅行情報がすでにHTMLソースに含まれている点にも注意してください。

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
- 写真アルバムはFirestoreへの圧縮JPEG共有に対応済み。**LINEグループ通知はまだ未実装**です。
- 公開URLを知る匿名訪問者は共有写真を閲覧できます。旅程の編集データを維持したまま、写真のみを別コレクションに保存します。
- Firebaseの利用量には無料枠と制限があり、公開編集は第三者の利用による費用・データ改変リスクがあります。必要ならFirebase App Checkや編集可能な相手を限定する方式を検討してください。

公式:
- https://firebase.google.com/docs/auth/web/anonymous-auth
- https://firebase.google.com/docs/firestore/security/get-started

## ④ 写真の共有を有効にする（2026年11月28日追加）

GitHubの `firestore.rules` を更新済みです。**過去に公開したルールでは写真を許可していないので、もう一度最新ルールをFirebase Consoleへコピーして「公開」してください。**

1. [GitHubの最新 firestore.rules](./firestore.rules) を開き、全文をコピーする
2. [FirebaseのFirestoreルール画面](https://console.firebase.google.com/project/onomichi-trip-2026/firestore/rules) で貼り付け、「公開」する
3. スマホの旅行しおりをSafariなどで開き直す
4. 「アルバム」画面に「☁️ 共有アルバム」と表示されることを確認する
5. 新しく撮った写真は各スポットの「ここでの思い出」とアルバムにリアルタイムで表示される。以前に撮った写真は「このスマホの未共有写真を共有」ボタンで送る

**大切：** 今回の更新では既存の旅程ドキュメントを変更していません。かえで・ゆかが編集した現在の旅程はそのまま維持します。

補足：LINE通知は別途LINE Messaging API連携が必要で、現時点ではありません。
