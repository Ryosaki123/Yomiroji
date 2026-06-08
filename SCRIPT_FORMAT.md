# Podcast script format

The app parses plain text into speakers + lines. Keep it simple: **one line per
turn, `Name: text`**.

## Rules (what the parser actually does)

- **One turn per line:** `Name: their line`  (ASCII `:` or full-width `：` both work).
- **Speaker name** comes before the first colon. Max ~23 characters, and it must
  not contain a colon. Latin or Japanese names are fine.
- **Same name = same voice.** Names are matched case-insensitively (`MAYA` = `Maya`).
- **Up to 4 speakers.** If you use more, the 5th+ are folded into the 4th speaker —
  so keep it to 4 distinct names.
- **Continuation lines:** a line with **no** `Name:` is appended to the previous
  speaker's turn. (Prefer giving every line its own `Name:` for clean timing.)
- **Blank lines** are ignored — use them freely for readability.
- **Plain text only.** No markdown, no `**bold**`, no `[stage directions]` or
  `(parentheticals)` — write spoken words only. Wrapping a whole line in brackets
  or quotes is stripped, so don't.
- **Punctuation matters** for pacing: end sentences with `。！？` (JA) or `.!?`
  (EN). Long turns are auto-split on these into natural chunks.
- **Numbers/symbols:** spell things out the way they should be read (e.g. write
  「2025年」as 「二〇二五年」or「にせんにじゅうごねん」if you want it read that way).
- **Emoji** are allowed and lightly affect delivery (mood); optional.

## Minimal template

```
SpeakerA: First line of dialogue.
SpeakerB: Reply goes here.
SpeakerA: Next line.
```

## Japanese example

```
マヤ：おかえりなさい、グルメ討論へ。今日のお題は「たい焼きはケーキか」です。
ケン：いや、たい焼きは和菓子でしょ。ケーキじゃない。
マヤ：でも生地を焼いて中に詰め物。ケーキの定義に近くない？
ハル：食の歴史家として一言。ケーキとは小麦の生地を焼いた菓子を指します。
ケン：ほら、生地を焼いてる。つまりたい焼きはケーキだ。
マヤ：……はい、今日はここまで。ご清聴ありがとうございました。
```

## English example

```
Maya: Welcome back to Crumbs, the show where we argue about food that does not matter.
Dev: And I'm here to lose another argument with confidence.
Maya: Today's question. Is a hot dog a sandwich?
Dev: Absolutely not. It is its own category. A tube food.
Maya: That is not a real classification, Dev.
Dev: It is now. I just classified it, live, on air.
```

## Prompt you can give an LLM

> Write a podcast script as plain text. Use exactly this format: one line per turn,
> `Name: spoken text`. Use **at most 4 distinct speaker names**, and reuse the same
> spelling for each speaker every time. Put each speaker's turn on its own single
> line (no line breaks inside a turn). Write only spoken words — no markdown, no
> stage directions, no parentheticals or brackets. End every sentence with proper
> punctuation (。！？ for Japanese, . ! ? for English). Spell out numbers the way
> they should be read aloud. Topic: <YOUR TOPIC>. Language: <Japanese / English>.
> Length: about <N> exchanges.

In the app: paste this into **Step 1 · Script** (or save it as a `.txt` and drop it
on the upload box). Detected speakers appear on the right; continue to **Cast** to
assign each a voice.
