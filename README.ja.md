# Yomiroji

🌐 [English](README.md) · **日本語**

完全ローカル・オフラインで動作するポッドキャスト作成ツールです。話者タグ付きの台本
（LLM が生成したものなど）を貼り付け、話者ごとに別々のクローン音声を割り当て、会話全体を
**1 つのポッドキャスト WAV** と、タイムスタンプ付きの字幕（SRT / WebVTT / JSON）として
書き出します。字幕はあとで動画クリップと同期するのに使えます。

音声エンジンには日本語 **Irodori-TTS**（作者 **Aratako** 氏、MIT ライセンス）を利用します。
これは自分でインストールします（本リポジトリはモデルの重みを再配布しません）。セットアップ後は
実行時に API も外部ネットワークも使いません。主な対象は日本語ですが、英語も（話者ごとの言語
設定として）構造的に対応しています。

構成は小さな **React シングルページアプリ**（`web/`）と、TTS を実行するローカルの
**FastAPI バックエンド**（`server/`）です。バックエンドは Irodori-TTS の Python 環境を再利用
するため、独自の追加 Python 依存はありません。

> **ライセンス:** Yomiroji は MIT（[LICENSE](LICENSE)）。Irodori-TTS のコードとモデルの重みは
> いずれも Aratako 氏による MIT（商用利用可）です。モデルの倫理ガイドライン（本人の同意なき
> 声の模倣・ディープフェイク・誤情報の生成をしない）に従ってください。詳細は
> [CREDITS.md](CREDITS.md)。

---

## 前提条件

- **Windows**、PATH 上の **Python 3.12.x**、**git**。
- **NVIDIA GPU（CUDA 12.8 ドライバ）** を推奨。GPU がなくても CPU で動作します（かなり遅い。
  その場合は CPU 版 PyTorch を入れてください。手順 2 の注を参照）。

## セットアップ

**コマンドプロンプト（cmd）** で、プロジェクトを置きたいフォルダから実行します:

```cmd
:: 1. Yomiroji を取得
git clone https://github.com/Ryosaki123/Yomiroji.git
cd Yomiroji

:: 2. Irodori-TTS エンジン + モデルを用意（隣に ..\IrodoriTTS-offline\ を作成）
::    Aratako/Irodori-TTS（固定コミット）を clone し、オフライン用パッチを当て、venv を作り、
::    Hugging Face から MIT のモデルをダウンロードします。ネット接続が必要・数 GB（PyTorch + モデル）。
::    .bat はダブルクリックでも実行できます。
setup_irodori.bat

:: 3. フロントエンドのライブラリ/フォントをローカルに取得（一度だけ。UI をオフライン化）
vendor_fetch.bat
```

> `.bat` は対応する `.ps1` を PowerShell（実行ポリシー回避）で起動するだけです。
> **cmd で `.\setup_irodori.ps1` を直接打っても何も起きません** — `.bat` を使うか、
> PowerShell ウィンドウから `.ps1` を実行してください。
>
> CPU のみの場合：手順 2 のあと torch を CUDA なしで入れ直します。例:
> `..\IrodoriTTS-offline\.venv\Scripts\python -m pip install torch torchaudio`

## 起動

```cmd
run_podcast.bat
```
ブラウザで <http://127.0.0.1:7864> を開きます。セットアップ後は完全オフライン（Wi-Fi オフで可）。

### 手動セットアップ（`setup_irodori.ps1` が失敗した場合）

隣の `..\IrodoriTTS-offline\` に対して、スクリプトは次を自動化しているだけです:
1. `git clone https://github.com/Aratako/Irodori-TTS.git irodori-src` →
   `git checkout d2af4193ea172b4214433e72f24f3b0f13d2c1bd` →
   `git apply <Yomiroji>\setup\offline-local-patches.patch`
2. `python -m venv .venv`；`setup/requirements.txt` を導入
   （`--extra-index-url https://download.pytorch.org/whl/cu128`）し、
   `pip install --no-deps -e irodori-src`
3. `models\` 配下へダウンロード：`Aratako/Irodori-TTS-500M-v3`→`base\model.safetensors`、
   `Aratako/Irodori-TTS-500M-v2-VoiceDesign`→`voicedesign\model.safetensors`、
   `Aratako/Semantic-DACVAE-Japanese-32dim`→`codec\weights.pth`、
   `llm-jp/llm-jp-3-150m` のトークナイザ各ファイル→`tokenizers\llm-jp__llm-jp-3-150m\`。

> コードを変更したら、**サーバーを再起動**（`run_podcast.bat` のウィンドウを閉じて再実行）し、
> **ブラウザを更新**してください。バックエンドは `Cache-Control: no-store` を返すので、
> 通常の更新でフロントエンドの変更が反映されます。

---

## 操作の流れ：台本 → キャスト → スタジオ

左の**サイドバー**にセッション（ポッドキャストの案件）が並びます。**＋ 新しいポッドキャスト**
で新規作成、名前の変更は上部バーのタイトル（✎）、サイドバー行の **✎** ボタン、または
ダブルクリックで行えます。すべて端末内に保存されます。

### 1 · 台本（Script）
台本を貼り付けるか `.txt` をドロップします。各行は `名前：セリフ` の形式です（半角 `:` も可）。
判別された話者が右側に表示されます。**話者は最大 4 人**で、各話者には毎回まったく同じ表記の
名前を使ってください。台本の詳しい書式と、台本生成用に LLM へ渡せるプロンプトは
**`SCRIPT_FORMAT.md`** を参照してください。

### 2 · キャスト（Cast）
各話者に**声**を割り当て、調整します。
- **速さ（Pace）**、**声の強さ（Voice strength）**、**デフォルトの感情**（**🚫 絵文字なし**を含む）、言語。
- **ライブラリ**から保存済みの声を選ぶか、**＋ 新規**で作成します。
- **キャラクターとして保存**で、現在の設定を再利用可能な声として保存します。

### 3 · スタジオ（Studio）
- **✨ すべての声を生成** — まだ生成されていない行を合成します。
- **🔄 すべての声を再生成** — 現在の設定で**すべての行**を強制的に作り直します（声や調整を
  変更したあと、または全部やり直したいときに使用）。各行のシードを保持するので、変更が確定的に
  反映されます。
- 各行ごとに：テキストを編集、**感情**を設定（または 🚫 なし）、その行だけ **↻ 再生成**
  （新しいテイク）、行の後の **⏸ 間（ま）** を設定、**⚙ 行の設定**で **シード**（🎲 振り直し）、
  **速さ**、**強さ**、**品質（ステップ）** をその行だけ上書きできます。
- **最終出力**パネル — 完成したポッドキャスト全体に適用されます（再構成／再生／ダウンロードで
  反映）：**テンポ**（音程を保ったまま速度変更）、**前の無音**、**音量ピーク**。
- **🔁 ポッドキャストを再構成** — 現在の各行のテイクから最終ミックスを組み直します。
- **▶ プレイヤー**で完成版を再生、**⬇ ダウンロード**で `.wav` を保存。**字幕**
  （SRT / WebVTT / JSON）はその隣に表示されます。

---

## 声のライブラリとキャラクター管理

声はバックエンドの `data/voices/<id>/`（参照音声 `voice.wav` と `profile.json`）に保存され、
**すべてのセッションで再利用**できます。**🎭 キャラクター**管理（サイドバーまたは上部バー）を
いつでも開いて、セッションとは独立に声を**作成・試聴・編集・削除**できます。

声の作り方は 3 通り：
- **プロンプトで作成** — 声を文章で説明すると VoiceDesign モデルが生成します。**再生成**
  ボタンを押すたびにシードが振り直され、別の声になります。
- **参照音声をアップロード** — 短いクリップ（wav/mp3 など、30 秒以内）をドロップしてクローン。
- **自動（シード）** — 参照なしで固定シードから再現可能な声を生成。

ポッドキャストの各行は、保存した参照音声を Base v3 が**クローン**して読み上げます。

> 注意：キャストでキャラクターを割り当てると、その調整値が話者に**コピー**されます。あとで
> 管理画面でそのキャラクターを編集した場合は、キャスト画面で再度選び直して新しい設定を取り込み、
> **すべての声を再生成**してください。

---

## UI と Irodori パラメータの対応

各コントロールはモデルの実機能に対応づけています（モデルには音程調整や学習済みの感情軸は
ありません）。

| UI コントロール   | Irodori パラメータ                                       |
| ----------------- | -------------------------------------------------------- |
| 速さ（Pace）      | `duration_scale`（= 1 / 速さ）                            |
| 声の強さ          | `cfg_scale_speaker`                                       |
| 品質              | `num_steps`（既定 **45**、スライダーは最大 120）          |
| 声の同一性        | クローン元の**参照音声** + 声ごとの固定シード             |
| 感情（絵文字）    | 行のテキスト末尾に任意で絵文字を付与；**🚫 = なし**       |
| テンポ（出力）    | 最終ミックスの音程を保ったままの速度変更                 |
| （音程・ピッチ）  | 非対応 — Base v3 にピッチ調整機能はありません            |

長い発話は自動で文単位に分割（1 回の生成あたり 256 トークン / 30 秒以内）して連結します。
字幕のタイムスタンプは正確です（既知のテキストと実測した音声長から算出）。完成したポッドキャストと
ぴったり一致します。

---

## ディレクトリ構成

```
server/            irodori_tts をラップする FastAPI バックエンド
  main.py          REST API + 静的配信（no-store）+ uvicorn のエントリ
  runtime_pool.py  Base v3 + VoiceDesign のランタイム、free_all()
  synth.py         行ごとの合成：分割 → クローン → 連結（速さ/強さ/ステップ/シード/感情）
  voicedesign.py   プロンプト / 自動 による声の作成
  voices.py        声ライブラリの保存（作成 / 読込 / 更新 / 削除）
  chunker.py       文分割 + トークン量に応じたパッキング
  stitch.py        各行 + 間 + テンポ + ピーク → podcast.wav
  transcript.py    SRT / WebVTT / JSON
web/               React SPA（ライブラリ・フォントは web/vendor/ に同梱）
data/
  voices/<id>/     voice.wav + profile.json   （再利用できるライブラリ）
  outputs/<id>/    seg_*.wav, podcast.wav + podcast.srt/.vtt/.json
SCRIPT_FORMAT.md   台本の書式と、台本生成用の LLM プロンプト
```

## ヘッドレス動作確認

オフライン環境（`run_podcast.bat` が設定する環境）で：
```cmd
..\IrodoriTTS-offline\.venv\Scripts\python.exe -m server.smoke_test
```

## トラブルシューティング

- **変更が反映されない** → サーバーを再起動してからブラウザを更新してください。
- **「ポート 7864 が使用中」**（古いサーバーが残っている）→ 解放します：
  ```powershell
  Get-NetTCPConnection -LocalPort 7864 -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
  ```
- **生成が遅い** → **品質（ステップ）** を上げると遅くなります（ほぼ比例）。多くの行は低めにして、
  必要な行だけ上げるとよいです。

## 備考

- Base v3 と VoiceDesign を同時に常駐させると約 4 GB の VRAM を使います。モデルは初回使用時に
  遅延読み込みされ、バックエンド（`POST /api/models/free`）で解放できます。
- 上流の SilentCipher 透かしはオフラインモードでは無効です（ベース配布と同様）。

## ライセンス・クレジット

- **Yomiroji**（本リポジトリ）: MIT — [LICENSE](LICENSE)。
- **Irodori-TTS** エンジン・モデル: © **Aratako** 氏、MIT —
  <https://github.com/Aratako/Irodori-TTS>。重みは再配布せず、`setup_irodori.ps1` が
  Hugging Face から取得します。
- 完全な帰属表示と**倫理ガイドライン**（声の無断模倣・ディープフェイク・誤情報の禁止）は
  [CREDITS.md](CREDITS.md) を参照してください。
