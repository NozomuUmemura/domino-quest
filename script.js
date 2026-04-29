/* =========================================================
   DOMINO Quest - script.js
   ========================================================= */

/* ========== ASSETS (local files only) ========== */
const ASSETS = {
  titleLogo: "./domino.png",
  favicon:   "./favicon.png",
  faviconAway: "./heart.png",
  bgm: {
    home:  "./Home.m4a",
    kano:  "./Kano.m4a",
    kondo: "./Kondo.m4a",
    sten:  "./Sten.m4a",
    qcd:   "./QCD.m4a",
    kumon: "./Kumon.m4a",
    self:  "./Self.m4a"
  },
  /* Mech-themed parts used as 弾幕 obstacles in the self battle.
     Files load with onerror tolerance — if any are missing, the obstacle
     simply renders as a plain outlined square (handled at obstacle build time). */
  selfObstacleSprites: [
    "./Bolt.png",
    "./Spanner.png",
    "./Gear.png",
    "./Screw.png",
    "./Board.png"
  ]
};

const SOUND_PREF_KEY            = "domino-quest-sound-enabled";
const CLEARED_KEY               = "domino-quest-cleared";
const QCD_RESULT_KEY            = "domino-quest-qcd-result";
const SECRET_HINT_SHOWN_KEY     = "domino-quest-domino-hint-shown";
const KUMON_CLEARED_KEY         = "domino-quest-kumon-cleared";
const SELF_HINT_SHOWN_KEY       = "domino-quest-self-hint-shown";
const SELF_BATTLE_CLEARED_KEY   = "domino-quest-self-battle-cleared";
const SELF_BATTLE_LOSSES_KEY    = "domino-quest-self-battle-losses";

const BASE_TITLE = "DOMINO Quest";
const AWAY_TITLE = "Come Back!!";

/* ========== AudioManager ========== */
const AudioManager = {
  enabled: false,
  currentKey: null,
  tracks: {},
  volumes: { home: 0.35, kano: 0.4, kondo: 0.4, sten: 0.4, qcd: 0.4, kumon: 0.45, self: 0.45 },
  _fadeTimers: { out: null, in: null },

  init() {
    Object.keys(ASSETS.bgm).forEach(key => {
      const src = ASSETS.bgm[key];
      try {
        const a = new Audio(src);
        a.loop = true;
        a.preload = "auto";
        a.volume = this.volumes[key] || 0.35;
        a.onerror = () => console.warn("BGM load failed:", src);
        this.tracks[key] = a;
      } catch (e) {
        console.warn("Audio init error for", src, e);
      }
    });
  },

  setEnabled(value) {
    this.enabled = !!value;
    if (!this.enabled) this.stop();
  },

  _safePlay(audio) {
    if (!audio) return;
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => console.warn("BGM play failed:", err));
      }
    } catch (e) {
      console.warn("BGM play exception:", e);
    }
  },

  play(key) {
    if (!this.enabled) return;
    const a = this.tracks[key];
    if (!a) return;
    this._clearFades();
    Object.keys(this.tracks).forEach(k => {
      if (k !== key) {
        const t = this.tracks[k];
        try { t.pause(); t.currentTime = 0; } catch (e) {}
      }
    });
    try { a.currentTime = 0; } catch (e) {}
    a.volume = this.volumes[key] || 0.35;
    this.currentKey = key;
    this._safePlay(a);
  },

  stop() {
    this._clearFades();
    Object.keys(this.tracks).forEach(k => {
      const t = this.tracks[k];
      try { t.pause(); t.currentTime = 0; } catch (e) {}
    });
    this.currentKey = null;
  },

  _clearFades() {
    if (this._fadeTimers.out) { clearInterval(this._fadeTimers.out); this._fadeTimers.out = null; }
    if (this._fadeTimers.in)  { clearInterval(this._fadeTimers.in);  this._fadeTimers.in  = null; }
  },

  switchTo(key) {
    if (!this.enabled) return;
    if (this.currentKey === key) return;
    const next = this.tracks[key];
    if (!next) return;
    const cur = this.currentKey ? this.tracks[this.currentKey] : null;
    const targetVol = this.volumes[key] || 0.35;
    this._clearFades();

    const startNext = () => {
      try {
        next.currentTime = 0;
        next.volume = 0;
      } catch (e) {}
      this.currentKey = key;
      this._safePlay(next);
      this._fadeTimers.in = setInterval(() => {
        const v = (next.volume || 0) + 0.06;
        if (v >= targetVol) {
          next.volume = targetVol;
          clearInterval(this._fadeTimers.in);
          this._fadeTimers.in = null;
        } else {
          next.volume = v;
        }
      }, 40);
    };

    if (cur && cur !== next && !cur.paused) {
      this._fadeTimers.out = setInterval(() => {
        const v = (cur.volume || 0) - 0.08;
        if (v <= 0.01) {
          cur.volume = 0;
          try { cur.pause(); cur.currentTime = 0; } catch (e) {}
          clearInterval(this._fadeTimers.out);
          this._fadeTimers.out = null;
          startNext();
        } else {
          cur.volume = v;
        }
      }, 30);
    } else {
      startNext();
    }
  },

  resumeHome() {
    this.switchTo("home");
  }
};

/* ========== Character → BGM key mapping ========== */
function bgmKeyForChar(id) {
  if (id === "kanou")  return "kano";
  if (id === "kondou") return "kondo";
  if (id === "sten")   return "sten";
  return null;
}

/* ========== SFX (CC0, generated locally) ========== */
const SFX = {
  dialogueNormal: "./assets/audio/sfx/dialogue_normal.wav",
  dialogueDark:   "./assets/audio/sfx/dialogue_dark.wav",
  dialogueBright: "./assets/audio/sfx/dialogue_bright.wav",
  warning:        "./assets/audio/sfx/ui_warning.wav",
  cursor:         "./assets/audio/sfx/ui_cursor.wav",
  confirm:        "./assets/audio/sfx/ui_confirm.wav",
  cancel:         "./assets/audio/sfx/ui_cancel.wav"
};

/* Per-character dialogue blip variant — keys are the actual character IDs
   used in GAME_DATA.characters. Anything missing falls back to dialogueNormal. */
const SPEAKER_SFX_MAP = {
  /* dark / low */
  lee:        "dialogueDark",
  takahashi:  "dialogueDark",
  fukunishi:  "dialogueDark",
  /* bright / energetic */
  kondou:     "dialogueBright",
  hayashi:    "dialogueBright",
  tabuchi:    "dialogueBright",
  /* normal */
  mitsumoto:  "dialogueNormal",
  miwa:       "dialogueNormal",
  kanou:      "dialogueNormal",
  hariyama:   "dialogueNormal",
  ishida:     "dialogueNormal",
  mizutani:   "dialogueNormal",
  katou:      "dialogueNormal",
  sten:       "dialogueNormal",
  futureSelf: "dialogueNormal",
  kumon:      "dialogueBright",
  kondouIdle: "dialogueBright"
};

const SFXManager = {
  enabled: true,
  volume: 0.18,
  sounds: {},          /* key -> array of preloaded Audio elements (round-robin) */
  _rrIdx: {},          /* round-robin index per key */
  _lastPlayedAt: {},   /* per-key cooldown timestamp */
  _lastBlipAt: 0,
  _blipCharCount: 0,

  init() {
    Object.keys(SFX).forEach(key => {
      const src = SFX[key];
      const pool = [];
      for (let i = 0; i < 3; i++) {
        try {
          const a = new Audio(src);
          a.preload = "auto";
          a.volume = this.volume;
          a.onerror = () => console.warn("SFX load failed:", src);
          pool.push(a);
        } catch (e) {
          console.warn("SFX init error:", src, e);
        }
      }
      this.sounds[key] = pool;
      this._rrIdx[key] = 0;
      this._lastPlayedAt[key] = 0;
    });
  },

  setEnabled(value) {
    this.enabled = !!value;
  },

  play(key, opts) {
    if (!this.enabled) return;
    const pool = this.sounds[key];
    if (!pool || pool.length === 0) return;
    const now = performance.now();
    const cooldown = (opts && opts.cooldown) || 0;
    if (cooldown && (now - (this._lastPlayedAt[key] || 0)) < cooldown) return;
    this._lastPlayedAt[key] = now;
    const idx = this._rrIdx[key] % pool.length;
    this._rrIdx[key] = (this._rrIdx[key] + 1) % pool.length;
    const a = pool[idx];
    try {
      a.volume = (opts && typeof opts.volume === "number") ? opts.volume : this.volume;
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(err => console.warn("SFX play failed:", err));
      }
    } catch (e) {
      console.warn("SFX play exception:", e);
    }
  },

  /* Per-character blip; rate-limited to roughly every 2-3 chars worth of typing.
     Skips when char is whitespace / punctuation (caller should pre-filter). */
  playDialogueBlip(speakerId) {
    if (!this.enabled) return;
    const now = performance.now();
    /* hard rate limit — never more than 1 blip per ~55ms */
    if (now - this._lastBlipAt < 55) return;
    this._lastBlipAt = now;
    const key = SPEAKER_SFX_MAP[speakerId] || "dialogueNormal";
    this.play(key, { volume: this.volume * 0.9 });
  }
};

/* Helper: should this character produce a blip? */
function isBlipCharacter(ch) {
  if (!ch) return false;
  /* Skip whitespace, line breaks, punctuation — Japanese + ASCII */
  if (/\s/.test(ch)) return false;
  if (/[、。．，,.!?！？…・「」『』（）()\[\]【】"':;\-—~〜]/.test(ch)) return false;
  return true;
}

/* ========== GAME_DATA ========== */
const GAME_DATA = {};

/* ---------- Characters ---------- */
GAME_DATA.characters = {
  mitsumoto: {
    name: "三本さん", role: "Project Odin チームマネージャー",
    color: "#5aa9ff", initial: "三",
    normal: [
      "焦らなくていいよ。無理しすぎると、判断が雑になるからね。",
      "プロジェクトは一人で進めるプロジェクトじゃない。チームで前提をそろえていこう。",
      "メンタルも大事なリソースだよ。休むことも、プロジェクトを進める力になる。"
    ],
    hint: [
      "まずは全体の流れを見てみよう。部屋の奥の扉、光ってるね。",
      "優先順位は、あとから決めるより先に置く方が楽だよ。",
      "人に聞く勇気も技術のうち、だと思うよ。"
    ],
    trust: [
      "{name}さんは、前提をちゃんと置ける人だね。それは武器になるよ。",
      "全体を見れる人は少ない。続けていこう。"
    ],
    smallTalk: [
      "このフロアの照明、ちょっと青いよね。集中しやすくしてるらしい。",
      "ちゃんと水分補給してる？水分はチームより先に切れるから。"
    ],
    ng2: [
      "また来たね、{name}さん。前より少し迷いが少ない顔をしてる。",
      "同じ一年でも、二度目は少し肩の力が抜けて見えるよ。"
    ]
  },
  miwa: {
    name: "三輪さん", role: "DoDチームマネージャー / インク担当",
    color: "#8ad6ff", initial: "三",
    normal: [
      "インクは色だけでは見ません。粘度、乾き方、にじみ、読める距離まで含めて品質になります。",
      "印字がきれいでも、現場で読めなければ意味がありません。",
      "丁寧に見るというのは、細かく見ることではなく、判断できる形に分けることです。"
    ],
    hint: [
      "品質は一つの数字じゃなく、いくつかの切り口で揃うとき決まります。",
      "読める距離まで含めて仕様、という考え方、覚えておくといいですよ。"
    ],
    trust: [
      "{name}さんは、分けて考えることができる人ですね。"
    ],
    smallTalk: [
      "インクの匂い、慣れると落ち着くんですよ。"
    ],
    ng2: [
      "{name}さん、二度目ですね。前提を置く速さが、少し変わった気がします。"
    ]
  },
  kanou: {
    name: "加納さん", role: "GM / グループマネージャー",
    color: "#ff9f43", initial: "加",
    normal: [
      "その説明、イントロはいい。でもサビが弱い。何を判断したいのか、もう一度言ってみてくれ。",
      "Fenderのストラトも、ただ鳴ればいいわけじゃない。設計仕様には理由がある。近藤さんはよく理解してるはずだ、教えてもらうといい。",
      "遊星からの物体X、ハエ男、エイリアン、ムカデ人間は気持ち悪い映画だが名作。",
      "映画でも仕事でも、最初にテーマが見えないと観客は迷う。"
    ],
    hint: [
      "結論から言って、根拠は現物と数字で揃えろ。順番が逆だと刺さらん。",
      "QCDは最後の壁じゃない、物差しとして最初から持て。"
    ],
    trust: [
      "{name}、筋のいい説明を持ってきたな。続けろ。",
      "ストラトと同じだ。運指のように、設計も発表も、徐々に慣れてくるだろう。"
    ],
    smallTalk: [
      "BECKという漫画、読んだことあるか？バンドもチームも、合わせる軸が要るんだよ。"
    ],
    ng2: [
      "{name}、また来たな。同じ譜面でも、運指は変わるもんだ。"
    ]
  },
  hariyama: {
    name: "張山さん", role: "プロジェクトリーダー / ハードCM",
    color: "#b084ff", initial: "張",
    normal: [
      "今どこまで来ていて、何が残っているかを見よう。",
      "次のField Trialに持っていくなら、残課題を見える形にしておきたいですね。"
    ],
    hint: [
      "EMCは、発生源と対策を切り離して考えるのがコツです。"
    ],
    trust: [
      "{name}さんのまとめ方は追いやすい。それは安心感になるよ。"
    ],
    smallTalk: [
      "今日の空、ちょっと湿度高いですね。計測、気をつけようね。"
    ],
    ng2: [
      "{name}さん、おかえり。残課題の見え方、少し違うかもしれませんね。"
    ]
  },
  lee: {
    name: "李さん", role: "PAD / Creo / CAD メンター",
    color: "#666a8c", initial: "李",
    normal: [
      "Creoは形を作るソフトじゃない。意図を残す場所。",
      "寸法の置き方に、設計者の考え方が出る。",
      "この造形、悪くない。"
    ],
    hint: [
      "モデルは、誰が見ても意図が追える状態にしておくと強い。"
    ],
    trust: [
      "無理に話さなくても、モデルがちゃんと語ってくれる時もある。",
      "{name}さん、寸法の置き方が丁寧になってきた。"
    ],
    smallTalk: [
      "……新しいフィギュア、かわいい。"
    ],
    ng2: [
      "……{name}さん。同じCreoでも、毎回違うものが見えるんだ。"
    ]
  },
  tabuchi: {
    name: "田渕さん", role: "デザイン / レンダリング",
    color: "#ff86c8", initial: "田",
    normal: [
      "レンダリングは飾りじゃない。相手の判断時間を減らすための設計です。",
      "このフィギュア、いい造形ですね！最終回扉絵の孫悟空ですか。",
    ],
    hint: [
      "資料の一枚目は、相手の目線を案内する入口です。",
      "色は三色以内に抑えると伝わりやすいですよ。"
    ],
    trust: [
      "{name}さんの資料、最初の一枚で話の筋が見えるようになってきた。"
    ],
    smallTalk: [
      "机のフィギュア、いい造形ですね！"
    ],
    ng2: [
      "{name}さん、お久しぶりです。同じ資料を作っても、二度目は構図が変わるんですよね。"
    ]
  },
  ishida: {
    name: "石田さん", role: "先輩 / 図面と試作の橋渡し",
    color: "#77e2b1", initial: "石",
    normal: [
      "速い人は、手が速いだけではありません。迷うポイントを先に減らしています。",
      "そのトラックボール、同じですね。MX Ergo、いいですよね。",
      "図面とCADと現物がずれた時、どこでずれたか追えるようにしておきましょう。"
    ],
    hint: [
      "試作で詰まったら、図面・CAD・現物のどこでズレたか見に行くのが早いです。",
      "PAD吸着は、条件を一つずつ分けて見ていきましょう。"
    ],
    trust: [
      "{name}さんのやり方、追いやすくて助かります。"
    ],
    smallTalk: [
      "このトラックボール、慣れると戻れないですよね、疲れないし。",
      "PAD吸着……正直、何とかなるんだろうか状態。"
    ],
    ng2: [
      "{name}さん、また来ましたね。前のループの記憶、図面に残ってるかもしれません。"
    ]
  },
  hayashi: {
    name: "林さん", role: "恒温室 / 評価",
    color: "#ffc978", initial: "林",
    normal: [
      "数字も大事だけど、現物が出す違和感も大事だよ。",
      "恒温室に入れると、普段見えない癖が出ることがあるんだよね。",
      "町工場だとさ、図面通りでも“これ組みにくいな”ってすぐ分かるんだよ。"
    ],
    hint: [
      "まあ焦らずいこう。評価は急ぐほど、あとで戻ってくるからね。",
      "違和感は、忘れないうちにメモっとくといいよ。"
    ],
    trust: [
      "{name}くん、現物の見方が良くなってきたね。"
    ],
    smallTalk: [
      "恒温槽の音、今日ちょっと静かだな。調子いいのかも。"
    ],
    ng2: [
      "この会話、どこかで一度やった気がするねぇ。"
    ]
  },
  kondou: {
    name: "近藤さん", role: "スーパーバイザー / 実機 / 公差",
    color: "#ff7a7a", initial: "近",
    normal: [
      "お、いいとこ見てるね。流石です(｀･ω･´)",
      "押忍。まず安全確認から( ^)o(^ )",
      "筋トレも評価も同じなんですわ(^_-)-☆フォームが崩れたら結果が信用できないんだよ。"
    ],
    hint: [
      "図面上では問題なくても、実機で動かすと見え方が変わるんだよー。",
      "公差はロジカルで考えて。図面はお絵かきじゃないと過去に上司に言われたよ(´・ω・`)"
    ],
    trust: [
      "{name}ちゃん、現場の目が育ってきたねぇ、押忍!(^^)!"
    ],
    smallTalk: [
      "昨日ベンチプレス多めに入れた。見てくれこの肩メロン(∩´∀｀)∩！"
    ],
    ng2: [
      "押忍、{name}ちゃん！今回は二度目やね、脳に経験値積んできた感じ(=ﾟωﾟ)ﾉ"
    ]
  },
  mizutani: {
    name: "水谷さん", role: "製造 / 工程設計",
    color: "#a0e0c8", initial: "水",
    normal: [
      "作る人が毎回考えなくて済む形が、良い工程に近いです。",
      "工程は、うまくいった時より、詰まった時に本性が出ます。",
      "この順番で組むなら、手の逃げ場を先に見ておきたいですね。"
    ],
    hint: [
      "量産では、一回できることより、何度も同じ品質でできることが大事です。",
      "作業者の動線を先に書いてみると、工程の粗が見えます。"
    ],
    trust: [
      "{name}さんは、作る側の目線を持ってくれるのが有難いです。"
    ],
    smallTalk: [
      "工程フロー、今朝一枚書き直しました。"
    ],
    ng2: [
      "{name}さん、二度目の量産試作。手の逃げ場、最初から見えていますか？"
    ]
  },
  katou: {
    name: "加藤さん", role: "熱評価",
    color: "#ff9a9a", initial: "加",
    normal: [
      "熱の評価は、平均だけ見ても危ないです。",
      "条件を変えた時に再現するか。まずはそこからですね。",
      "暫定策は必要。でも真因を見失うと、後で戻ってきます。"
    ],
    hint: [
      "“たまたま動いた”と“安定して動く”は、まったく別物だよ。",
      "再現条件を先に書いてから試すと、ぶれないです。"
    ],
    trust: [
      "{name}さん、条件の切り分けが丁寧になってきた。"
    ],
    smallTalk: [
      "今日は恒温槽の昇温、早めに仕掛けました。"
    ],
    ng2: [
      "{name}さん、また会いましたね。再現性って、人にも当てはまる言葉なんだよね。"
    ]
  },
  fukunishi: {
    name: "福西さん", role: "モーター / プロファイル",
    color: "#c9a0ff", initial: "福",
    normal: [
      "モーターは動けばいいわけじゃない。余裕がどれだけあるかが重要です。",
      "音が変わったね。今のはちょっと嫌な感じがします。",
      "条件を一つずつ変えないと、何が効いたのか分からなくなります。"
    ],
    hint: [
      "脱調が“想定していた状況”と違うのが厄介なんだよ。",
      "今のままプロファイルを作ると、レートを落とすことになりそう。"
    ],
    trust: [
      "{name}さん、条件分けがきれいになってきましたね。",
      "{name}さん、最近李さんと仲良くやれてる？"
    ],
    smallTalk: [
      "昨日の夜、ログだけ先に整理しました。"
    ],
    ng2: [
      "2週目の新人は、だいたい扉の場所を覚えている気がします。"
    ]
  },
  takahashi: {
    name: "髙橋さん", role: "EMC / ノイズ",
    color: "#9ab0c8", initial: "髙",
    normal: [
      "このケーブルの引き回し、評価条件によっては効いてくると思います。",
      "ノイズは目に見えないから、ログと条件管理が命ですね。",
      "対策を入れたら、副作用も見ます。そこを飛ばすと危ないです。"
    ],
    hint: [
      "またノイズが出た。GNDの取り回し、もう一回疑った方がいいかもしれない。",
      "EMCは、原因が見えたと思った瞬間に別の要因が出てくるんだよね。"
    ],
    trust: [
      "{name}さん、ログの残し方、読みやすくなりました。"
    ],
    smallTalk: [
      "今日は雨だから、湿度計も一緒に見ておこう。"
    ],
    ng2: [
      "{name}さん、また来ましたね。同じ一年でも、見え方は少し変わるものですね。"
    ]
  },
  sten: {
    name: "Sten", role: "Domino Global",
    color: "#ffd166", initial: "S",
    normal: [
      "The prototype looks good, but I need to understand what happens in the real customer line.",
      "If the load path is clear, the shape feels intentional, not decorative.",
      "Clear remaining risks make the next decision easier."
    ],
    hint: [
      "Field Trial is where assumptions become real.",
      "Write the risks down. Memory is not a tool."
    ],
    trust: [
      "Good, {name}. You keep your assumptions visible. That helps all of us."
    ],
    smallTalk: [
      "Coffee here is surprisingly strong.",
      "Back home, the line speed is higher. You would see different things."
    ],
    ng2: [
      "Welcome back, {name}. Same project, different eyes."
    ]
  },
  futureSelf: {
    name: "未来の自分", role: "Year 2 Gate",
    color: "#ffffff", initial: "?",
    normal: ["……ここまで、よく歩いてきたね。"],
    hint: [], trust: [], smallTalk: []
  },
  kumon: {
    name: "公文", role: "開発者のメカ同期 / 自由人",
    color: "#5ab8ff", initial: "公",
    normal: [], hint: [], trust: [], smallTalk: []
  }
};

/* ---------- Chapter events (chapter-advancing dialogues) ---------- */
GAME_DATA.events = {
  1: { char: "mitsumoto", room: "lobby", lines: [
    { t: "ようこそ、{name}さん。ここはDomino事業開発部の入口だよ。" },
    { t: "まずは目の前の作業だけでなく、全体の流れを見てみよう。" },
    { t: "Odinは、1年を通して形を作っていくプロジェクト。キックオフから、量産試作、QCDまで。" },
    { c: [
      { t: "全体像を先に理解したい", e: { design: 2, trust: 2 }, n: "前提をそろえてから判断する",
        r: "いい選択だよ。焦らないで、流れを見ていこう。" },
      { t: "とにかく手を動かす", e: { proto: 2, mental: -8 }, n: "焦りは判断を雑にする",
        r: "気持ちは分かる。ただ、手を動かす前に一度だけ全体を見ておこう。" },
      { t: "先輩に相談してから決める", e: { trust: 2, explain: 1 }, n: "相談は最短距離になる",
        r: "うん、それが一番早い時も多いよ。" }
    ]}
  ]},
  2: { char: "kanou", room: "kickoff", lines: [
    { t: "よく来たな、{name}。ここがキックオフ会議室だ。" },
    { t: "QCDは後から出てくる壁ではない。最初から置いておく物差しだ。" },
    { t: "今年の優先順位を決めて、試作で何を確かめるか、一枚で言ってみて。" },
    { c: [
      { t: "品質の物差しを先に定義する", e: { design: 2, explain: 2 },
        n: "QCDは最後の壁ではなく、最初から置く物差し",
        r: "それだ。物差しが先。数字はあとからでいい。" },
      { t: "日程を最優先にする", e: { proto: 2, mental: -6 },
        r: "日程は大事。ただ、日程だけだと、あとで品質で戻ってくるぞ。" },
      { t: "全員で前提をそろえる", e: { trust: 3, explain: 1 },
        n: "前提をそろえてから判断する",
        r: "筋がいい。チームで話を合わせるのは、最強のショートカットだ。" }
    ]}
  ]},
  3: { char: "lee", room: "odin_room", lines: [
    { t: "……{name}さん。" },
    { t: "PADの詳細設計と、ラベルセンサ誤検知対策が並行で走ってる、頭パンクしそう。" },
    { t: "Creoは形を作るソフトじゃない、意図を残す場所。" },
    { c: [
      { t: "設計意図を先にモデルに残す", e: { design: 3, explain: 1 },
        n: "図面はお絵かきじゃない",
        r: "……うん。その順番でいい。" },
      { t: "見た目から整える", e: { proto: 1 },
        r: "……悪くはない。ただ、意図が先だと、直しが減る。" },
      { t: "田渕さんに見せ方を相談する", e: { trust: 2, explain: 1 },
        r: "田渕さんは、目線の入口を作るのが上手い。……任せていいと思うよ。" }
    ]}
  ]},
  4: { char: "ishida", room: "proto_func", lines: [
    { t: "{name}さん、機能試作フロアへようこそ。" },
    { t: "試作で一番怖いのは、止まった理由が誰にも分からなくなることです。小さな判断でも、後で追える形にしておくと助かります。" },
    { t: "PAD吸着……正直、何とかなるんだろうか状態。摩擦、ファン、振動、、大きいPADほど厄介ですね。" },
    { c: [
      { t: "判断の記録を残すフォーマットを作る", e: { explain: 2, trust: 2 },
        n: "止まった理由を後で追える形にする",
        r: "助かります。それ一つで、後から入る人が迷わなくなります。" },
      { t: "とりあえず動かしてみる", e: { proto: 2, mental: -5 },
        n: "“たまたま動いた”と“安定して動く”は別物",
        r: "動いたのは事実。ただ、再現条件はあとで要ります。" },
      { t: "現物と図面を並べて確認", e: { design: 1, eval: 1, trust: 1 },
        n: "現物と数字の両方を見る",
        r: "図面とCADと現物、三つ並べると、ズレた場所が見えやすいです。" }
    ]}
  ]},
  5: { char: "kondou", room: "product_proto", lines: [
    { t: "押忍、{name}ちゃん(*'▽')" },
    { t: "今週中に、動く貨物へのタンプ動作まで行きたいね(';')" },
    { t: "図面上では問題なくても、実機で動かすと見え方が変わるんだよ(･`д･´)" },
    { c: [
      { t: "実機で組み立てを観察する", e: { proto: 2, eval: 1, trust: 1 },
        n: "現物と数字の両方を見る",
        r: "お、いいとこ見てるね。実機は正直だから。流石天才(^_-)-☆" },
      { t: "公差を先にロジカルに詰める", e: { design: 2, explain: 1 },
        n: "公差はロジカルで考えてね、図面はお絵かきじゃない(-_-メ)",
        r: "押忍。そこ詰めとくと、あとで現場が助かるっす。" },
      { t: "作業者の動きを先に観察する", e: { design: 1, trust: 2 },
        n: "作る人が毎回考えなくて済む形が、良い工程に近い",
        r: "それ。動線から設計見ると、違うんだなこれが。" }
    ]}
  ]},
  6: { char: "katou", room: "eval_room", lines: [
    { t: "{name}さん、評価室へ。" },
    { t: "熱の評価は、平均だけ見ても危ないです。条件を変えた時に再現するか。まずはそこからだよね～。" },
    { t: "“たまたま動いた”と“安定して動く”は、まったく別物だからね～。" },
    { c: [
      { t: "再現性を先に確認する", e: { eval: 3, trust: 1 },
        n: "“たまたま動いた”と“安定して動く”は別物",
        r: "そこから入れると、後の判断が軽くなります。" },
      { t: "暫定策で先に進める", e: { proto: 1, mental: -4 },
        r: "暫定は必要。ただ、真因のメモだけは残しておこう。" },
      { t: "評価条件を書き出してから試す", e: { eval: 2, explain: 2 },
        n: "評価条件を先にそろえる",
        r: "それ、あとで他の誰かが再評価する時に効きます。" }
    ]}
  ]},
  7: { char: "hariyama", room: "field_trial", lines: [
    { t: "{name}さん、Field Trial準備室です。" },
    { t: "EMCは正直、難航してる。発生源は見えてきたけど、対策に落とすところが勝負だね。" },
    { t: "次のField Trialに持っていくなら、残課題を見える形にしておきたいですね。" },
    { c: [
      { t: "残課題を一枚に整理する", e: { explain: 3, trust: 2 },
        n: "Field Trialでは、評価室で見えない前提が出る",
        r: "助かります。一枚あるだけで、現場での判断が速くなります。" },
      { t: "対策を全部やりきる", e: { proto: 1, mental: -8 },
        r: "気持ちは分かります。ただ、優先順位は先に置きましょう。" },
      { t: "現場の前提を先に聞く", e: { design: 1, trust: 2 },
        n: "前提をそろえてから判断する",
        r: "それが一番早いです。現場の前提が見えると、評価が変わります。" }
    ]}
  ]},
  8: { char: "mizutani", room: "mass_proto", lines: [
    { t: "{name}さん、量産試作エリアです。" },
    { t: "作る人が毎回考えなくて済む形が、良い工程に近いです。" },
    { t: "量産では、一回できることより、何度も同じ品質でできることが大事です。" },
    { c: [
      { t: "繰り返し作業の手順を設計する", e: { design: 2, eval: 1, trust: 2 },
        n: "繰り返しできて初めて工程",
        r: "そこが固まると、工程は強くなります。" },
      { t: "作業者の手の逃げ場を先に確認", e: { design: 1, trust: 2 },
        n: "手の逃げ場を先に見ておく",
        r: "細かいけど、後で効く視点です。" },
      { t: "気合いで量産を回す", e: { proto: 1, mental: -8 },
        r: "気合いは尊い。ただ、量産は仕組みで回したいですね。" }
    ]}
  ]}
};

/* ---------- Rooms ---------- */
GAME_DATA.rooms = {
  lobby: {
    name: "配属ロビー", floor: "2F", mm: { f: 2, slot: 0 },
    desc: "開発フロアの入口。ホログラム案内と受付端末。",
    colors: ["#1d3a5c", "#3a6fa3"],
    npcs: [
      { id: "mitsumoto", x: 420, y: 280 },
      { id: "miwa",      x: 620, y: 320 }
    ],
    objects: [
      { id: "welcome_board", name: "Welcomeボード", x: 160, y: 200,
        desc: "『ようこそ、ドミノ事業開発部へ』と書かれている。",
        note: "無理しすぎないことも仕事の一部", color: "#6bd" },
      { id: "vending", name: "自販機", x: 820, y: 380,
        desc: "ブラックコーヒー、水、麦茶。開発フロアの標準装備。地味に嬉しいポイント。", color: "#a85" }
    ],
    doors: [
      { x: 880, y: 200, w: 60, h: 100, to: "kickoff", label: "キックオフ\n会議室", unlock: 1 }
    ],
    decor: [
      { type: "desk", x: 80, y: 380, w: 240, h: 40, label: "RECEPTION" },
      { type: "console", x: 380, y: 400, w: 200, h: 30, label: "PROJECT BOARD" }
    ]
  },

  kickoff: {
    name: "キックオフ会議室", floor: "2F", mm: { f: 2, slot: 1 },
    desc: "年間ロードマップと優先順位を一枚で置く、長机の会議室。",
    colors: ["#5c3e1c", "#c58a3a"],
    npcs: [
      { id: "kanou",    x: 400, y: 280 },
      { id: "hariyama", x: 580, y: 320 }
    ],
    objects: [
      { id: "whiteboard", name: "ホワイトボード", x: 160, y: 180,
        desc: "『Q1: 機能試作 / Q2: 商品試作 / Q3: FT / Q4: 量産試作』のロードマップ。",
        note: "QCDは最後の壁ではなく、最初から置く物差し", color: "#ccb" },
      { id: "coffee", name: "コーヒー", x: 800, y: 380,
        desc: "深煎りの香り。時々飲むと、集中力が上がる。1日400mgまで。", color: "#974" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "lobby",     label: "← ロビー",     unlock: 1 },
      { x: 880, y: 220, w: 60, h: 100, to: "odin_room", label: "Project\nOdin", unlock: 2 }
    ],
    decor: [
      { type: "table", x: 260, y: 380, w: 440, h: 40, label: "MEETING TABLE" }
    ]
  },

  odin_room: {
    name: "Project Odinルーム", floor: "2F", mm: { f: 2, slot: 2 },
    desc: "Creo端末が並ぶ設計ラボ。モデルが形に変わっていく場所。",
    colors: ["#2c1a4d", "#6b4bb0"],
    npcs: [
      { id: "lee",     x: 360, y: 280 },
      { id: "tabuchi", x: 560, y: 300 },
      { id: "ishida",  x: 720, y: 340 }
    ],
    objects: [
      { id: "creo_term", name: "Creo端末", x: 180, y: 220,
        desc: "画面にはPADアセンブリ。寸法の置き方から、意図が読み取れる。",
        note: "図面はお絵かきじゃない", color: "#9ae" },
      { id: "figurine", name: "机上のフィギュア", x: 260, y: 360,
        desc: "最近仕事で楽しむために、フィギュアをモニター上に飾ったり、机上に置いたりしてる。",
        color: "#d8a" },
      { id: "render_st", name: "レンダリングステーション", x: 820, y: 220,
        desc: "光源の向きを少し変えるだけで、仕様の見え方がまったく変わる。",
        note: "資料の一枚目は、相手の目線を案内する入口", color: "#fb8" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "kickoff",    label: "← キックオフ", unlock: 1 },
      { x: 880, y: 400, w: 70, h: 80,  to: "proto_func", label: "↓ 1F 階段\n機能試作", unlock: 3 }
    ],
    decor: [
      { type: "desk", x: 140, y: 300, w: 120, h: 40, label: "CAD-01" },
      { type: "desk", x: 500, y: 360, w: 120, h: 40, label: "CAD-02" },
      { type: "desk", x: 740, y: 400, w: 140, h: 40, label: "RENDER" }
    ]
  },

  proto_func: {
    name: "機能試作フロア", floor: "1F", mm: { f: 1, slot: 0 },
    desc: "3Dプリンタ、部品棚、図面ボード。試作の現場。",
    colors: ["#1c4a2c", "#3f9c5e"],
    npcs: [
      { id: "ishida",  x: 340, y: 300 },
      { id: "hayashi", x: 540, y: 330 },
      { id: "sten",    x: 720, y: 280 }
    ],
    objects: [
      { id: "trackball", name: "トラックボールマウス", x: 180, y: 200,
        desc: "石田さんと同じモデル。細かいCAD操作に意外と効く、あと疲れにくい。",
        note: "迷うポイントを先に減らす", color: "#fa8" },
      { id: "proto_part", name: "PAD試作部品", x: 220, y: 380,
        desc: "吸着のテストピース。条件を分けて並んでいる。",
        note: "条件を分けて見る", color: "#adf" },
      { id: "drawing", name: "図面ボード", x: 820, y: 220,
        desc: "図面とCADと現物、三点で追えるように並べてある。", color: "#ecb" }
    ],
    doors: [
      { x: 20, y: 40, w: 60, h: 70, to: "odin_room",    label: "↑ 2F 階段\nProject Odin", unlock: 3 },
      { x: 880, y: 220, w: 60, h: 100, to: "product_proto", label: "商品試作\nスタジオ",  unlock: 4 }
    ],
    decor: [
      { type: "rack", x: 80, y: 340, w: 140, h: 50, label: "PARTS" },
      { type: "desk", x: 400, y: 400, w: 200, h: 30, label: "TEST BENCH" }
    ]
  },

  product_proto: {
    name: "商品試作スタジオ", floor: "1F", mm: { f: 1, slot: 1 },
    desc: "現物を組み、使われ方を確認する作業台。",
    colors: ["#1c4a4a", "#3fa0a0"],
    npcs: [
      { id: "hayashi",  x: 360, y: 300 },
      { id: "kondou",   x: 560, y: 320 },
      { id: "mizutani", x: 720, y: 330 }
    ],
    objects: [
      { id: "assembled", name: "組立済み試作機", x: 200, y: 220,
        desc: "ほぼ製品の姿。組み立てやすさの違和感が少しある。",
        note: "組み立て性は、早く見るほど安い", color: "#fbd" },
      { id: "tamp", name: "タンプ機構", x: 240, y: 380,
        desc: "動く貨物に対する印字動作の心臓部。音にも癖が出る。",
        note: "実機で動かすと、図面の線が現実になる", color: "#c9b" },
      { id: "bench", name: "作業台", x: 820, y: 380,
        desc: "手順書と工具。整理されているほど、工程のミスが減る。", color: "#b87" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "proto_func", label: "← 機能試作",  unlock: 4 },
      { x: 880, y: 220, w: 60, h: 100, to: "eval_room",  label: "評価室",      unlock: 5 }
    ],
    decor: [
      { type: "table", x: 420, y: 400, w: 240, h: 30, label: "ASSEMBLY" }
    ]
  },

  eval_room: {
    name: "評価室", floor: "1F", mm: { f: 1, slot: 2 },
    desc: "恒温槽、EMC試験装置、モーターリグ。条件を分けて評価する部屋。",
    colors: ["#5c2b1c", "#c56b44"],
    npcs: [
      { id: "kondou",    x: 340, y: 300 },
      { id: "katou",     x: 500, y: 320 },
      { id: "fukunishi", x: 660, y: 300 },
      { id: "takahashi", x: 800, y: 330 }
    ],
    objects: [
      { id: "thermal", name: "恒温槽", x: 180, y: 200,
        desc: "扉の中で、温度と湿度が静かに管理されている。",
        note: "評価室と現場は別の前提を持つ", color: "#c97" },
      { id: "emc", name: "EMC試験装置", x: 200, y: 380,
        desc: "ノイズ源が見えた瞬間、別の要因が顔を出す装置。",
        note: "EMCは原因が見えた瞬間に別の要因が出る", color: "#9ac" },
      { id: "motor_rig", name: "モーター試験リグ", x: 820, y: 380,
        desc: "プロファイルを変えると音の質が変わる。レートの余裕が鍵。",
        note: "脱調は“想定していた状況”と違う時に起きる", color: "#ca9" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "product_proto", label: "← 商品試作",   unlock: 5 },
      { x: 880, y: 220, w: 60, h: 100, to: "field_trial",  label: "FT準備室",     unlock: 6 }
    ],
    decor: [
      { type: "rack", x: 380, y: 400, w: 260, h: 30, label: "DATA LOGGER" }
    ]
  },

  field_trial: {
    name: "Field Trial準備室", floor: "1F", mm: { f: 1, slot: 3 },
    desc: "実ラインを模したモックアップと、残課題の一覧。",
    colors: ["#1c3a5c", "#4a8cd4"],
    npcs: [
      { id: "hariyama", x: 340, y: 300 },
      { id: "sten",     x: 520, y: 320 },
      { id: "mitsumoto",x: 720, y: 300 }
    ],
    objects: [
      { id: "ft_check", name: "Field Trialチェックリスト", x: 180, y: 220,
        desc: "現場で確認する項目が、目的ごとに並んでいる。",
        note: "Field Trialでは、評価室で見えない前提が出る", color: "#adf" },
      { id: "mockup", name: "実ラインモックアップ", x: 220, y: 380,
        desc: "想定ラインを小さく再現。速度と姿勢が現場寄りに作られている。",
        note: "現場の前提は、評価室の前提と違う", color: "#dcb" },
      { id: "pack_box", name: "梱包箱", x: 820, y: 380,
        desc: "現地に持っていく工具と治具。忘れ物が一番怖い。", color: "#b96" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "eval_room",  label: "← 評価室",      unlock: 6 },
      { x: 880, y: 220, w: 60, h: 100, to: "mass_proto", label: "量産試作",      unlock: 7 }
    ],
    decor: [
      { type: "table", x: 400, y: 400, w: 240, h: 30, label: "LINE MOCK" }
    ]
  },

  mass_proto: {
    name: "量産試作エリア", floor: "1F", mm: { f: 1, slot: 4 },
    desc: "工程フロー、治具、作業者の動線。量産の再現性が問われる場所。",
    colors: ["#5c5c1c", "#c6c63a"],
    npcs: [
      { id: "mizutani", x: 340, y: 300 },
      { id: "kondou",   x: 520, y: 320 },
      { id: "ishida",   x: 720, y: 300 }
    ],
    objects: [
      { id: "flow", name: "量産工程フロー表", x: 180, y: 220,
        desc: "作業が手順に落ちている。詰まる箇所には赤ピン。",
        note: "繰り返しできて初めて工程", color: "#ddb" },
      { id: "jig", name: "量産治具", x: 220, y: 380,
        desc: "手の逃げ場が考えられた治具。作る側の目線が入っている。",
        note: "手の逃げ場を先に見ておく", color: "#bdb" },
      { id: "line_log", name: "作業ログ端末", x: 820, y: 380,
        desc: "1サイクルごとの作業時間。ばらつきが、工程の本性を映す。", color: "#9ac" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "field_trial",   label: "← FT準備",    unlock: 7 },
      { x: 880, y: 40, w: 70, h: 80,  to: "global_review", label: "↑ 2F 階段\nGlobal",   unlock: 8 }
    ],
    decor: [
      { type: "bench", x: 400, y: 400, w: 240, h: 30, label: "ASSY LINE" }
    ]
  },

  global_review: {
    name: "Globalレビュー室", floor: "2F", mm: { f: 2, slot: 3 },
    desc: "世界のライン目線を持ち込むレビュー室。QCD Hallの手前。",
    colors: ["#1c2a5c", "#4a5cd4"],
    npcs: [
      { id: "sten",  x: 400, y: 300 },
      { id: "kanou", x: 600, y: 320 }
    ],
    objects: [
      { id: "risk_sheet", name: "残課題シート", x: 200, y: 220,
        desc: "Q / C / D ごとに、残課題と打ち手が一枚にまとまっている。",
        note: "残課題を見える形にしておく", color: "#acf" }
    ],
    doors: [
      { x: 20, y: 400, w: 60, h: 80,  to: "mass_proto", label: "↓ 1F 階段\n量産試作",  unlock: 8 },
      { x: 880, y: 220, w: 60, h: 100, to: "qcd_hall",   label: "QCD Hall",     unlock: 9 }
    ],
    decor: [
      { type: "console", x: 400, y: 400, w: 240, h: 30, label: "GLOBAL UPLINK" }
    ]
  },

  qcd_hall: {
    name: "QCD Hall", floor: "2F", mm: { f: 2, slot: 4 },
    desc: "Quality / Cost / Delivery を一枚でつなぐ、検討会の場。",
    colors: ["#3a1c5c", "#8a3ac5"],
    npcs: [
      { id: "kanou", x: 480, y: 280 }
    ],
    objects: [
      { id: "qcd_docs", name: "QCDレビュー資料", x: 200, y: 220,
        desc: "仕様・現物・評価結果・残課題・打ち手が、順番に並んでいる。",
        note: "QCDは最初から置く物差し", color: "#fca" }
    ],
    doors: [
      { x: 20, y: 220, w: 50, h: 100, to: "global_review", label: "← Global", unlock: 9 }
    ],
    decor: [
      { type: "table", x: 340, y: 400, w: 280, h: 30, label: "REVIEW TABLE" }
    ]
  }
};

/* Minimap layout */
GAME_DATA.minimap = {
  f2: ["lobby", "kickoff", "odin_room", "global_review", "qcd_hall"],
  f1: ["proto_func", "product_proto", "eval_room", "field_trial", "mass_proto"]
};

/* ---------- QCD Battle ---------- */
GAME_DATA.battle = {
  phases: [
    { name: "Quality", q: "この仕様は、品質や評価の安定性にどう効きますか？",
      choices: [
        { t: "評価条件と基準を先にそろえる", meter: 28, e: { explain: 2, trust: 2, eval: 1 },
          n: "評価条件を先にそろえる",
          r: "加納: いいね。物差しが先にあると、数字の意味が通る。" },
        { t: "現物と数字を並べて説明する", meter: 25, e: { explain: 2, design: 1 },
          n: "現物と数字の両方を見る",
          r: "加納: それなら、相手の判断時間が短くなる。" },
        { t: "とりあえず気合いで通す", meter: 6, e: { mental: -6 },
          n: "“気合い”は品質の物差しにならない",
          r: "加納: それは根拠じゃなくて、覚悟だ。順番が違う。" }
      ]},
    { name: "Cost", q: "部品点数、加工、手戻りをどう抑えますか？",
      choices: [
        { t: "共通化できる部分を示す", meter: 26, e: { design: 2, explain: 1 },
          n: "共通化は最初の設計判断",
          r: "加納: 共通化は設計の時点で効く。正解。" },
        { t: "組み立て順を見直す", meter: 24, e: { design: 1, trust: 1 },
          n: "組み立て順は原価に効く",
          r: "加納: 作る側の目線、入ってるな。" },
        { t: "今回は品質優先と言い切る", meter: 10, e: { mental: -4 },
          r: "加納: 品質優先は嘘じゃない。でもCの説明になってない。" }
      ]},
    { name: "Delivery", q: "量産試作まで時間がありません。どこを先に固めますか？",
      choices: [
        { t: "長納期部品と治具を先に固める", meter: 28, e: { proto: 2, explain: 1 },
          n: "長納期と治具は、先に置くほど効く",
          r: "加納: 段取りが見えてる。進められる。" },
        { t: "評価項目を目的に合わせて絞る", meter: 24, e: { eval: 2, explain: 1 },
          n: "評価項目は目的で選ぶ",
          r: "加納: 全部やろうとしない判断、いいな。" },
        { t: "全員で残業して回す", meter: 4, e: { mental: -10 },
          n: "残業でDを守る案は再現性がない",
          r: "加納: 一回はできる。次は誰がやる？" }
      ]},
    { name: "Final Decision", q: "最後に、この仕様を通す価値を一言で説明してください。",
      choices: [
        { t: "品質・原価・日程の前提を一枚でつなげる", meter: 30, e: { explain: 3, trust: 2 },
          n: "QCDを一枚でつなげて語る",
          r: "加納: それが一番強い。通っていい。" },
        { t: "現物と評価結果を並べて説明する", meter: 26, e: { explain: 2, eval: 1 },
          n: "現物と数字を並べる",
          r: "加納: 納得感が違うな。いい。" },
        { t: "残課題と次の打ち手を示す", meter: 24, e: { explain: 2, trust: 1 },
          n: "残課題と打ち手をセットで置く",
          r: "加納: 不安を抱えたまま渡さないのが、信頼を呼ぶ。" }
      ]}
  ]
};

/* ---------- Default stats ---------- */
GAME_DATA.defaultStats = {
  design: 0, proto: 0, eval: 0, explain: 0, trust: 0, mental: 100
};
GAME_DATA.statLabels = {
  design: "設計理解", proto: "試作推進", eval: "評価力",
  explain: "説明力", trust: "信頼度", mental: "メンタル余裕"
};

/* =========================================================
   STATE
========================================================= */
const state = {
  screen: "title",
  name: "",
  soundScreen: { idx: 1, mode: null }, /* idx 0=ON, 1=OFF; mode: "new" | "continue" */
  chapter: 1,
  stats: { ...GAME_DATA.defaultStats },
  notes: [],
  eventsDone: {},
  currentRoom: "lobby",
  player: { x: 200, y: 360 },
  visited: { lobby: true },

  dialog: { active: false, queue: [], line: 0, typing: false, typedIdx: 0, fullText: "", speaker: "", waitingChoice: false, choices: [], choiceIdx: 0, onDone: null, replyPending: null, seq: 0, advanceLockUntil: 0 },
  menu: { active: false, idx: 0, detail: "" },
  notebookOpen: false,
  helpOpen: false,
  battle: null,
  endingOpen: false,

  keys: {},
  zHeldSince: 0,
  lastInteract: 0,

  /* random-talk tracking */
  talkCount: {},
  lastLine: {},

  /* 2nd-playthrough mode (set at game start from CLEARED_KEY) */
  isNG2: false,

  /* Kumon mode */
  kumonMode: false,
  kumonActive: false,
  kumonEnded: false,

  /* Self battle ("自分自身との戦い") — completely separate from QCD battle */
  selfBattleMode: false,    /* requested via title input "自分" / "jibun" */
  selfBattleActive: false,  /* overlay & loop currently running */
  selfBattleTurn: 0,        /* 1..5 */
  selfPlayerHp: 100,
  selfEnemyHp: 100,
  selfBattlePhase: null,    /* "intro" | "enemyTaunt" | "enemy" | "playerCommand" | "attackMeter" | "result" */
  selfKeys: {},             /* arena movement keys, kept separate from main keys */
  selfObstacles: [],        /* live obstacle objects with x,y,w,h,vx,vy,sprite */
  selfAnimationFrame: 0,    /* requestAnimationFrame id (0 when stopped) */
  selfAttackMeterActive: false,
  selfHeart: { x: 220, y: 96, hitUntil: 0 },
  selfArenaSize: { w: 480, h: 220 },
  selfTurnEndAt: 0,         /* timestamp when current enemy phase ends */
  selfNextSpawnAt: 0,
  selfMeterT: 0,            /* 0..1, drives sm-cursor position */
  selfMeterDir: 1,
  selfCommandIdx: 0,
  selfLastTickAt: 0,
  selfTimers: [],           /* setTimeout ids tracked for cleanup */

  /* Idle event */
  lastActivityAt: 0,
  lastIdleEventAt: 0
};

const SAVE_KEY = "domino_quest_save_v1";

/* Random note bank — small chance drop on repeat NPC chats */
const NOTE_BANK = [
  "前提をそろえてから判断する",
  "現物と数字の両方を見る",
  "止まった理由を後で追える形にする",
  "“たまたま動いた”と“安定して動く”は別物",
  "図面はお絵かきじゃない",
  "QCDは最後の壁ではなく、最初から置く物差し",
  "相談は最短距離になる",
  "EMCは原因が見えた瞬間に別の要因が出る",
  "Field Trialでは、評価室で見えない前提が出る",
  "繰り返しできて初めて工程"
];

/* Door arrow by position */
function doorArrow(d) {
  if (d.x <= 60)  return "\u25C0"; /* ◀ */
  if (d.x >= 860) return "\u25B6"; /* ▶ */
  if (d.y <= 80)  return "\u25B2"; /* ▲ */
  if (d.y >= 380) return "\u25BC"; /* ▼ */
  return "\u25CF";
}

/* =========================================================
   UTIL
========================================================= */
const $ = id => document.getElementById(id);
function fmt(s) { return (s || "").replace(/\{name\}/g, state.name || "新人"); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add("hidden"), 1800);
}
function addNote(text) {
  if (!text) return;
  if (state.notes.includes(text)) return;
  state.notes.push(text);
  SFXManager.play("confirm", { cooldown: 200 });
  showToast("ノートに追加: " + text);
}
function applyEffect(e) {
  if (!e) return;
  for (const k in e) {
    state.stats[k] = (state.stats[k] || 0) + e[k];
    if (k === "mental") state.stats.mental = clamp(state.stats.mental, 0, 100);
  }
  updateStatsMini();
}

/* =========================================================
   SCREEN SWITCH
========================================================= */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(name + "-screen").classList.add("active");
  state.screen = name;
}

/* =========================================================
   RENDER ROOM
========================================================= */
function renderRoom() {
  const room = GAME_DATA.rooms[state.currentRoom];
  if (!room) return;
  state.visited[state.currentRoom] = true;

  $("room-label").textContent = room.name;
  $("floor-label").textContent = room.floor;
  $("chapter-label").textContent = "Chapter " + state.chapter;
  $("room-description").textContent = room.desc;

  const bg = $("room-bg");
  bg.style.setProperty("--room-a", room.colors[0]);
  bg.style.setProperty("--room-b", room.colors[1]);

  /* Decor */
  const decor = $("decor-layer");
  decor.innerHTML = "";
  (room.decor || []).forEach(d => {
    const el = document.createElement("div");
    el.className = "decor " + (d.type || "");
    el.style.left = d.x + "px";
    el.style.top = d.y + "px";
    el.style.width = d.w + "px";
    el.style.height = d.h + "px";
    el.textContent = d.label || "";
    decor.appendChild(el);
  });

  /* Doors */
  const dl = $("door-layer");
  dl.innerHTML = "";
  (room.doors || []).forEach(d => {
    const el = document.createElement("div");
    const locked = state.chapter < d.unlock;
    el.className = "door" + (locked ? " locked" : "");
    el.style.left = d.x + "px";
    el.style.top = d.y + "px";
    el.style.width = d.w + "px";
    el.style.height = d.h + "px";
    el.innerHTML =
      `<div class="door-arrow">${doorArrow(d)}</div>` +
      `<div>${d.label.replace(/\n/g, "<br>")}</div>` +
      (locked ? `<div><small>LOCKED</small></div>` : "");
    el.onclick = () => tryUseDoor(d);
    el.dataset.door = d.to;
    dl.appendChild(el);
  });

  /* Objects */
  const ol = $("object-layer");
  ol.innerHTML = "";
  (room.objects || []).forEach(o => {
    const el = document.createElement("div");
    el.className = "object";
    el.style.left = o.x + "px";
    el.style.top = o.y + "px";
    if (o.color) el.style.setProperty("--obj-color", o.color);
    el.innerHTML = `<span class="tag">${o.name}</span>`;
    el.onclick = () => inspectObject(o);
    el.dataset.id = o.id;
    ol.appendChild(el);
  });

  /* NPCs */
  const nl = $("npc-layer");
  nl.innerHTML = "";
  (room.npcs || []).forEach(n => {
    const c = GAME_DATA.characters[n.id];
    const el = document.createElement("div");
    el.className = "npc";
    el.style.left = n.x + "px";
    el.style.top = n.y + "px";
    el.style.setProperty("--npc-color", c.color);
    el.dataset.initial = c.initial;
    el.innerHTML = `<span class="tag">${c.name}</span>`;
    el.onclick = () => talkToNPC(n.id);
    el.dataset.id = n.id;
    nl.appendChild(el);
  });

  placePlayer();
  updateObjective();
  updateMinimap();
  updateStatsMini();
  resizeStage();
}

function placePlayer() {
  const p = $("player");
  p.style.left = state.player.x + "px";
  p.style.top = state.player.y + "px";
}

/* =========================================================
   OBJECTIVE / MINIMAP / STATS
========================================================= */
function updateObjective() {
  const ch = state.chapter;
  let goals = {
    1: "三本さんと話す（配属ロビー）",
    2: "加納さんと話す（キックオフ会議室）",
    3: "李さんと話す（Project Odinルーム）",
    4: "石田さんと話す（機能試作フロア）",
    5: "近藤さんと話す（商品試作スタジオ）",
    6: "加藤さんと話す（評価室）",
    7: "張山さんと話す（Field Trial準備室）",
    8: "水谷さんと話す（量産試作エリア）",
    9: "QCD Hallへ進む（Globalレビュー室 経由）",
    10: "Year 2 Gate"
  };
  $("objective-label").textContent = "目的: " + (goals[ch] || "—");
}

function updateMinimap() {
  const mm = $("minimap");
  const build = (floor, label) => {
    const rooms = GAME_DATA.minimap["f" + floor];
    let h = `<div class="mm-floor-label">${label}</div><div class="mm-floor f${floor}">`;
    rooms.forEach(rid => {
      const r = GAME_DATA.rooms[rid];
      const cur = state.currentRoom === rid;
      const v = state.visited[rid];
      const cls = cur ? "current" : (v ? "visited" : "");
      h += `<div class="mm-cell ${cls}" title="${r.name}">${r.name}</div>`;
    });
    h += "</div>";
    return h;
  };
  mm.innerHTML = `<div class="mm-title">MAP</div>` + build(2, "2F") + build(1, "1F");
}

function updateStatsMini() {
  const el = $("stats-mini");
  const s = state.stats;
  const l = GAME_DATA.statLabels;
  el.innerHTML = Object.keys(l).map(k =>
    `<div class="stat-row"><span>${l[k]}</span><span>${s[k]}</span></div>`).join("");
}

/* =========================================================
   MOVEMENT / INTERACTION
========================================================= */
const BOUNDS = { minX: 10, maxX: 920, minY: 120, maxY: 490 };

function updatePlayerMovement() {
  if (state.screen !== "game") return;
  if (state.dialog.active || state.menu.active || state.notebookOpen || state.helpOpen || state.battle || state.endingOpen) return;

  const k = state.keys;
  let dx = 0, dy = 0;
  const speed = 4;
  if (k.ArrowLeft)  dx -= speed;
  if (k.ArrowRight) dx += speed;
  if (k.ArrowUp)    dy -= speed;
  if (k.ArrowDown)  dy += speed;
  const pl = $("player");
  if (dx || dy) {
    state.player.x = clamp(state.player.x + dx, BOUNDS.minX, BOUNDS.maxX);
    state.player.y = clamp(state.player.y + dy, BOUNDS.minY, BOUNDS.maxY);
    placePlayer();
    if (pl) pl.classList.add("moving");
    checkAutoDoor();
    checkInteractHint();
  } else {
    if (pl) pl.classList.remove("moving");
  }
}

function checkInteractHint() {
  const hint = $("interact-hint");
  const pl = $("player");
  const near = findNearInteractable();
  if (near) {
    hint.textContent = near.kind === "npc" ? "Zで話す" :
                       near.kind === "object" ? "Zで調べる" : "Zで扉へ";
    hint.style.left = (near.x + near.w / 2) + "px";
    hint.style.top = near.y + "px";
    hint.classList.remove("hidden");
    if (pl) pl.classList.add("near");
  } else {
    hint.classList.add("hidden");
    if (pl) pl.classList.remove("near");
  }
}

function findNearInteractable() {
  const room = GAME_DATA.rooms[state.currentRoom];
  const px = state.player.x + 14, py = state.player.y + 18;
  const maxD = 54;

  const candidates = [];
  (room.npcs || []).forEach(n => {
    const cx = n.x + 16, cy = n.y + 20;
    const d = Math.hypot(cx - px, cy - py);
    if (d < maxD) candidates.push({ kind: "npc", id: n.id, x: n.x, y: n.y, w: 32, dist: d });
  });
  (room.objects || []).forEach(o => {
    const cx = o.x + 18, cy = o.y + 18;
    const d = Math.hypot(cx - px, cy - py);
    if (d < maxD) candidates.push({ kind: "object", obj: o, x: o.x, y: o.y, w: 36, dist: d });
  });
  (room.doors || []).forEach(d => {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    const dist = Math.hypot(cx - px, cy - py);
    if (dist < maxD + 10) candidates.push({ kind: "door", door: d, x: d.x, y: d.y, w: d.w, dist: dist });
  });
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

function checkAutoDoor() {
  const room = GAME_DATA.rooms[state.currentRoom];
  const px = state.player.x + 14, py = state.player.y + 18;
  for (const d of room.doors || []) {
    const inside = px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h;
    if (inside) {
      if (state.chapter < d.unlock) { SFXManager.play("warning", { cooldown: 600 }); showToast("まだ開かない（LOCKED）"); return; }
      transitionRoom(d.to);
      return;
    }
  }
}

function tryUseDoor(d) {
  if (state.chapter < d.unlock) { SFXManager.play("warning", { cooldown: 200 }); showToast("まだ開かない（LOCKED）"); return; }
  SFXManager.play("confirm");
  transitionRoom(d.to);
}

function transitionRoom(to) {
  /* Defensive: never carry dialog state across rooms */
  if (state.dialog && state.dialog.active) resetDialogUI();
  $("dialog").classList.add("hidden");
  state.currentRoom = to;
  const room = GAME_DATA.rooms[to];
  /* Place player at appropriate entry */
  const doors = room.doors || [];
  /* Spawn roughly at middle, avoiding doors */
  state.player.x = 200;
  state.player.y = 360;
  renderRoom();
  if (to === "qcd_hall" && state.chapter === 9 && !state.eventsDone.qcd) {
    setTimeout(startBattle, 500);
  }
}

/* =========================================================
   INTERACT (Z)
========================================================= */
function interactZ() {
  if (Date.now() - state.lastInteract < 120) return;
  state.lastInteract = Date.now();
  const near = findNearInteractable();
  if (!near) return;
  if (near.kind === "npc") talkToNPC(near.id);
  else if (near.kind === "object") inspectObject(near.obj);
  else if (near.kind === "door") tryUseDoor(near.door);
}

/* =========================================================
   NPC DIALOG
========================================================= */
function talkToNPC(id) {
  const c = GAME_DATA.characters[id];
  if (!c) return;

  /* BGM switching for designated characters */
  const bgmKey = bgmKeyForChar(id);
  if (bgmKey) AudioManager.switchTo(bgmKey);
  else AudioManager.resumeHome();

  /* Chapter event? */
  const ev = GAME_DATA.events[state.chapter];
  if (ev && ev.char === id && ev.room === state.currentRoom && !state.eventsDone[state.chapter]) {
    const prevChapter = state.chapter;
    runDialog(c.name, ev.lines.map(L => ({ ...L, speaker: c.name })), () => {
      state.eventsDone[state.chapter] = true;
      state.chapter += 1;
      showChapterStamp(prevChapter);
      renderRoom();
      if (state.chapter === 10) triggerEnding();
    }, id);
    return;
  }

  /* Random talk pool — varies with talkCount and trust */
  state.talkCount[id] = (state.talkCount[id] || 0) + 1;
  const talks = state.talkCount[id];
  const trust = state.stats.trust || 0;

  /* Build pool: normal is always in; smallTalk after 2nd chat; hint after 3rd; trust at high trust */
  let pool = [];
  if (c.normal && c.normal.length) pool = pool.concat(c.normal, c.normal);
  if (talks >= 2 && c.smallTalk && c.smallTalk.length) pool = pool.concat(c.smallTalk);
  if (talks >= 3 && c.hint && c.hint.length) pool = pool.concat(c.hint);
  if (trust >= 8 && c.trust && c.trust.length) pool = pool.concat(c.trust);
  /* 2nd-playthrough: mix in a small set of meta lines */
  if (state.isNG2 && c.ng2 && c.ng2.length) pool = pool.concat(c.ng2);
  if (pool.length === 0) pool = ["……"];

  /* Avoid repeating the previous line for this character */
  let line = rand(pool);
  for (let i = 0; i < 8 && pool.length > 1 && line === state.lastLine[id]; i++) {
    line = rand(pool);
  }
  state.lastLine[id] = line;

  /* Small chance of dropping a note from the bank on repeat chats */
  const onDone = () => {
    if (talks >= 3 && Math.random() < 0.15) {
      addNote(rand(NOTE_BANK));
    }
  };
  runDialog(c.name, [{ t: line }], onDone, id);
}

function inspectObject(o) {
  const lines = [{ t: `『${o.name}』を調べた。` }, { t: o.desc || "……特に気になるものはない。" }];
  const onDone = () => {
    if (o.note && Math.random() < 0.9) addNote(o.note);
  };
  runDialog(o.name, lines, onDone);
}

/* =========================================================
   DIALOG ENGINE
========================================================= */
/* Hard reset of all dialog state + DOM. Called at start AND end
   of every dialog so nothing from a prior conversation can leak. */
function resetDialogUI() {
  const d = state.dialog;
  d.seq = (d.seq || 0) + 1; /* invalidates pending typeTick callbacks */
  d.active = false;
  d.queue = [];
  d.line = 0;
  d.typing = false;
  d.typedIdx = 0;
  d.fullText = "";
  d.speaker = "";
  d.waitingChoice = false;
  d.choices = [];
  d.choiceIdx = 0;
  d.replyPending = null;
  d.advanceLockUntil = 0;
  /* DOM: clear text/speaker/choice containers fully */
  const txt = $("dialog-text"); if (txt) txt.textContent = "";
  const sp  = $("dialog-speaker"); if (sp) sp.textContent = "";
  const ce  = $("dialog-choices");
  if (ce) { ce.innerHTML = ""; ce.classList.add("hidden"); }
  const nx  = $("dialog-next"); if (nx) nx.classList.remove("hidden");
}

function runDialog(speaker, queue, onDone, speakerId) {
  /* Always start from a clean slate — kills any leftover state/DOM */
  resetDialogUI();
  const d = state.dialog;
  d.active = true;
  d.queue = Array.isArray(queue) ? queue.slice() : [];
  d.line = 0;
  d.speaker = speaker || "";
  d.speakerId = speakerId || null;
  d.onDone = onDone || null;
  $("dialog").classList.remove("hidden");
  $("dialog-speaker").textContent = d.speaker;
  showDialogLine();
}

function writeDialogText(text) {
  const rendered = fmt(text || "");
  const d = state.dialog;
  d.fullText = rendered;
  d.typedIdx = rendered.length;
  d.typing = false;

  const txtEl = $("dialog-text");
  if (txtEl) {
    txtEl.textContent = rendered;
    if (!txtEl.textContent && rendered) {
      try { txtEl.innerText = rendered; } catch (e) {}
    }
    txtEl.style.display = "";
    txtEl.style.visibility = "visible";
    txtEl.style.opacity = "1";
    txtEl.style.color = "#fff";
  }

  /* Best-effort dialogue blip:
     We render text synchronously (existing behaviour, kept for safety),
     but emit a few rate-limited blips as if typed. This avoids touching the
     dialog state machine while still giving the audible blip effect. */
  emitDialogueBlips(rendered, d.speakerId || null);
}

function emitDialogueBlips(text, speakerId) {
  if (!text) return;
  if (!AudioManager.enabled) return; /* respect global sound on/off */
  let blipCount = 0;
  let charSinceLast = 0;
  const startSeq = state.dialog.seq;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!isBlipCharacter(ch)) continue;
    charSinceLast += 1;
    if (charSinceLast < 2) continue; /* every 2-3 visible chars */
    charSinceLast = 0;
    blipCount += 1;
    const delay = blipCount * 55; /* matches SFXManager rate limit */
    if (blipCount > 8) break;     /* don't queue forever */
    setTimeout(() => {
      /* If a new dialog started in between, drop pending blips */
      if (state.dialog.seq !== startSeq) return;
      SFXManager.playDialogueBlip(speakerId);
    }, delay);
  }
}

function showDialogLine() {
  const d = state.dialog;
  if (d.line >= d.queue.length) { endDialog(); return; }
  const item = d.queue[d.line];

  /* Choice block — show only when actual choices exist */
  if (item && item.c && Array.isArray(item.c) && item.c.length > 0) {
    d.waitingChoice = true;
    d.choices = item.c;
    d.choiceIdx = 0;
    const txtEl0 = $("dialog-text");
    if (txtEl0) txtEl0.textContent = "";
    const ce0 = $("dialog-choices");
    if (ce0) {
      ce0.innerHTML =
        `<div class="choice-head">&#9660; 選択してください</div>` +
        d.choices.map((c, i) =>
          `<div class="choice ${i === 0 ? "active" : ""}" data-i="${i}"><span class="heart-cursor"></span>${c.t}</div>`
        ).join("");
      ce0.querySelectorAll(".choice").forEach(el => {
        el.onclick = () => { d.choiceIdx = +el.dataset.i; renderChoiceFocus(); pickChoice(); };
      });
      ce0.classList.remove("hidden");
    }
    const nx0 = $("dialog-next"); if (nx0) nx0.classList.add("hidden");
    return;
  }

  /* Normal text line — make sure choices UI is gone */
  const ce = $("dialog-choices");
  if (ce) { ce.innerHTML = ""; ce.classList.add("hidden"); }
  const nx = $("dialog-next"); if (nx) nx.classList.remove("hidden");
  if (item && item.speaker) {
    const sp = $("dialog-speaker"); if (sp) sp.textContent = item.speaker;
  }
  d.waitingChoice = false;

  writeDialogText((item && item.t) || "");
}

/* Typewriter is currently disabled in favour of immediate full-text
   render (showDialogLine writes the line synchronously). Stub kept so
   any stray reference is harmless. */
function typeTick(_mySeq) {
  /* no-op */
}

function advanceDialog() {
  const d = state.dialog;
  if (!d.active) return;
  /* If a typewriter were running, snap it. Now we render full text up
     front, so this branch is mostly defensive. */
  if (d.typing) { d.typedIdx = d.fullText.length; $("dialog-text").textContent = d.fullText; d.typing = false; return; }
  if (d.waitingChoice) { pickChoice(); return; }
  if (d.replyPending) {
    const r = d.replyPending; d.replyPending = null;
    /* Same defence as showDialogLine: write to multiple paths and force
       the element to be visible so the reply can't go missing. */
    writeDialogText(r);
    /* Make sure the choices block can't be hiding the body */
    const ce = $("dialog-choices");
    if (ce) { ce.innerHTML = ""; ce.classList.add("hidden"); }
    const nx = $("dialog-next"); if (nx) nx.classList.remove("hidden");
    return;
  }
  d.line += 1;
  showDialogLine();
}

function renderChoiceFocus() {
  const d = state.dialog;
  document.querySelectorAll("#dialog-choices .choice").forEach((el, i) => {
    el.classList.toggle("active", i === d.choiceIdx);
  });
}

function pickChoice() {
  const d = state.dialog;
  const currentLine = d.line;
  const c = d.choices[d.choiceIdx];
  if (!c) return;
  applyEffect(c.e);
  if (c.n) addNote(c.n);
  d.waitingChoice = false;
  d.choices = [];
  d.choiceIdx = 0;
  /* Wipe the choice DOM completely so the prompt header can't linger */
  const ce = $("dialog-choices");
  if (ce) { ce.innerHTML = ""; ce.classList.add("hidden"); }
  const nx = $("dialog-next");
  if (nx) nx.classList.remove("hidden");
  if (c.r) {
    d.queue[currentLine] = { t: c.r, speaker: d.speaker };
    d.line = currentLine;
    d.replyPending = null;
    /* Brief lockout so the same Z keypress (or auto-repeat) can't
       immediately advance past the reply we are about to show. */
    d.advanceLockUntil = Date.now() + 400;
    showDialogLine();
  } else {
    d.line = currentLine + 1;
    showDialogLine();
  }
}

function endDialog() {
  const onDone = state.dialog.onDone;
  state.dialog.onDone = null;
  $("dialog").classList.add("hidden");
  /* Wipe state and DOM so the next conversation starts truly clean */
  resetDialogUI();
  /* Resume Home BGM if a character-specific track was playing
     (but not during the QCD battle / Kumon mode / Self battle, which have their own tracks) */
  if (!state.battle && !state.kumonActive && !state.selfBattleActive &&
      AudioManager.currentKey &&
      AudioManager.currentKey !== "home" &&
      AudioManager.currentKey !== "qcd" &&
      AudioManager.currentKey !== "kumon" &&
      AudioManager.currentKey !== "self") {
    AudioManager.resumeHome();
  }
  if (typeof onDone === "function") onDone();
}

/* =========================================================
   MENU
========================================================= */
function openMenu() {
  state.menu.active = true;
  state.menu.idx = 0;
  $("menu").classList.remove("hidden");
  renderMenu();
}
function closeMenu() {
  state.menu.active = false;
  $("menu").classList.add("hidden");
}
function renderMenu() {
  const lis = document.querySelectorAll("#menu-list li");
  lis.forEach((li, i) => li.classList.toggle("active", i === state.menu.idx));
  $("menu-detail").textContent = describeMenu(lis[state.menu.idx].dataset.menu);
}
function describeMenu(key) {
  const s = state.stats, l = GAME_DATA.statLabels;
  switch (key) {
    case "status":
      return Object.keys(l).map(k => `${l[k]}: ${s[k]}`).join("\n") + `\n名前: ${state.name}`;
    case "notebook":
      return state.notes.length ? state.notes.map(n => "▸ " + n).join("\n") : "まだノートは空。";
    case "objective": return $("objective-label").textContent;
    case "help": return "Z: 決定 / X: 戻る / C: ノート / 矢印: 移動";
    case "save": return "Zでセーブ。localStorageに保存されます。";
    case "title": return "Zでタイトルへ戻る。未保存の進行は失われます。";
  }
  return "";
}
function pickMenu() {
  const lis = document.querySelectorAll("#menu-list li");
  const key = lis[state.menu.idx].dataset.menu;
  switch (key) {
    case "status": case "notebook": case "objective": case "help":
      renderMenu();
      break;
    case "save": saveGame(); SFXManager.play("confirm"); showToast("セーブしました"); break;
    case "title":
      closeMenu();
      AudioManager.stop();
      setBaseTitle(BASE_TITLE);
      showScreen("title");
      break;
  }
}

/* =========================================================
   NOTEBOOK
========================================================= */
function openNotebook() {
  state.notebookOpen = true;
  $("notebook").classList.remove("hidden");
  const list = $("notebook-list");
  if (state.notes.length === 0) {
    list.innerHTML = '<li class="empty-note">まだノートは空です。会話や物体から言葉が積まれていきます。</li>';
  } else {
    /* Terminal-log style: [DAY NNN] / [NOTE] tag prefix.
       The first entry is the system seed; everything after is a NOTE.
       The underlying state.notes array is unchanged. */
    list.innerHTML = state.notes.map((n, i) => {
      if (i === 0) {
        return `<li class="log-line tag-system"><span class="log-tag">[SYS]</span><span>${escapeText(n)}</span></li>`;
      }
      const day = String(i * 7).padStart(3, "0"); /* visual only */
      return `<li class="log-line tag-note"><span class="log-tag">[DAY ${day}]</span><span>${escapeText(n)}</span></li>`;
    }).join("");
  }
}
function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function closeNotebook() { state.notebookOpen = false; $("notebook").classList.add("hidden"); }

/* =========================================================
   HELP
========================================================= */
function openHelp() { state.helpOpen = true; $("help").classList.remove("hidden"); }
function closeHelp() { state.helpOpen = false; $("help").classList.add("hidden"); }

/* =========================================================
   BATTLE
========================================================= */
function startBattle() {
  state.battle = { phase: 0, meter: 0, choiceIdx: 0, resultShown: false, scores: [] };
  $("battle").classList.remove("hidden");
  $("battle-result").classList.add("hidden");
  AudioManager.switchTo("qcd");
  renderBattle();
}
function renderBattle() {
  const b = state.battle;
  const p = GAME_DATA.battle.phases[b.phase];
  $("battle-phase").textContent = `Phase ${b.phase + 1} / 4  ${p.name}`;
  $("battle-question").textContent = p.q;
  $("meter-inner").style.width = b.meter + "%";
  $("meter-value").textContent = b.meter;
  const cc = $("battle-choices");
  cc.innerHTML = p.choices.map((c, i) =>
    `<div class="battle-choice ${i === b.choiceIdx ? "active" : ""}" data-i="${i}"><span class="heart-cursor"></span>${i + 1}. ${c.t}</div>`
  ).join("");
  cc.querySelectorAll(".battle-choice").forEach(el => {
    el.onclick = () => { b.choiceIdx = +el.dataset.i; renderBattle(); pickBattleChoice(); };
  });
}
function pickBattleChoice() {
  const b = state.battle;
  const p = GAME_DATA.battle.phases[b.phase];
  const c = p.choices[b.choiceIdx];
  b.meter = clamp(b.meter + c.meter, 0, 100);
  applyEffect(c.e);
  if (c.n) addNote(c.n);
  b.scores.push({ phase: p.name, reply: c.r, choice: c.t, meterAdd: c.meter });
  b.phase += 1;
  if (b.phase < GAME_DATA.battle.phases.length) {
    renderBattle();
    showToast(`${p.name}: ${c.r || ""}`);
  } else {
    finishBattle();
  }
}
function finishBattle() {
  const b = state.battle;
  const pass = b.meter >= 60;
  const summary = b.scores.map(s => `【${s.phase}】 ${s.reply || ""}`).join("\n\n");
  $("battle-result").classList.remove("hidden");
  $("battle-result").innerHTML =
    `<b>${pass ? "QCD検討会 突破" : "QCD検討会: 学びを持ち帰る"}</b><br>` +
    `納得度: ${b.meter} / 100<br><br>` +
    summary.replace(/\n/g, "<br>") +
    `<br><br><small>Zで先へ進む</small>`;
  $("battle-choices").innerHTML = "";
  state.battle.done = true;
  state.eventsDone.qcd = true;
  if (pass) addNote("QCDは、物差し・現物・残課題を一枚でつなぐ");
  else addNote("QCDは、気合いではなく物差しで語る");
  /* Persist battle result for Kumon mode comments */
  try {
    const payload = { meter: b.meter, pass: pass, scores: b.scores, ts: Date.now() };
    localStorage.setItem(QCD_RESULT_KEY, JSON.stringify(payload));
  } catch (e) {}
}
function closeBattle() {
  $("battle").classList.add("hidden");
  state.battle = null;
  state.chapter = 10;
  AudioManager.resumeHome();
  renderRoom();
  triggerEnding();
}

/* =========================================================
   ENDING
========================================================= */
function triggerEnding() {
  state.endingOpen = true;
  $("ending").classList.remove("hidden");
  const s = state.stats;
  const text =
`{name}は、1年間の現場を歩き終えた。

キックオフで引いた物差し。Creoに残した設計意図。機能試作での“止まった理由”の残し方。
実機と恒温槽とField Trialで見えた前提の違い。量産試作で分かった、繰り返しの重み。
そして、QCD Hallで自分の言葉でつないだQ・C・D。

未来の自分: 「よくここまで来たね。次に進むときは、この物差しを少しだけ短くしていこう。」
未来の自分: 「全部を抱え込まなくていい。前提をそろえて、相談して、記録を残す。それで十分進めるよ。」

-- Stats --
${Object.keys(GAME_DATA.statLabels).map(k => `${GAME_DATA.statLabels[k]}: ${s[k]}`).join(" / ")}

Year 2 Gate — 次の1年へ。`;
  $("ending-text").textContent = fmt(text);
}
function closeEnding() {
  state.endingOpen = false;
  $("ending").classList.add("hidden");
  AudioManager.stop();
  /* Show the domino hint after the first clear. Use a separate shown flag so
     players who cleared before a broken hint build can still receive it. */
  const wasCleared = isCleared();
  const shouldShowSecretHint = !wasCleared || !isSecretHintShown();
  try { localStorage.setItem(CLEARED_KEY, "true"); } catch (e) {}
  setBaseTitle(BASE_TITLE);
  showScreen("title");
  if (shouldShowSecretHint) {
    setTimeout(() => openSecretHint({ force: true }), 160);
    return;
  }
}

function openSecretHint(options) {
  const ov = $("secret-hint");
  if (!ov) { showScreen("title"); return; }
  if (isSecretHintShown() && !(options && options.force)) { showScreen("title"); return; }
  ov.classList.remove("hidden");
  SFXManager.play("confirm", { cooldown: 200 });
}
function closeSecretHint() {
  const ov = $("secret-hint");
  if (ov) ov.classList.add("hidden");
  SFXManager.play("cancel");
  try { localStorage.setItem(SECRET_HINT_SHOWN_KEY, "true"); } catch (e) {}
  showScreen("title");
}

function isCleared() {
  try { return localStorage.getItem(CLEARED_KEY) === "true"; }
  catch (e) { return false; }
}

function isSecretHintShown() {
  try { return localStorage.getItem(SECRET_HINT_SHOWN_KEY) === "true"; }
  catch (e) { return false; }
}

function isKumonCleared() {
  try { return localStorage.getItem(KUMON_CLEARED_KEY) === "true"; }
  catch (e) { return false; }
}

function isSelfHintShown() {
  try { return localStorage.getItem(SELF_HINT_SHOWN_KEY) === "true"; }
  catch (e) { return false; }
}

function isSelfBattleCleared() {
  try { return localStorage.getItem(SELF_BATTLE_CLEARED_KEY) === "true"; }
  catch (e) { return false; }
}

function getSelfBattleLosses() {
  try {
    const v = parseInt(localStorage.getItem(SELF_BATTLE_LOSSES_KEY) || "0", 10);
    return isNaN(v) ? 0 : v;
  } catch (e) { return 0; }
}

function bumpSelfBattleLosses() {
  try {
    const v = getSelfBattleLosses() + 1;
    localStorage.setItem(SELF_BATTLE_LOSSES_KEY, String(v));
  } catch (e) {}
}

function loadQcdResult() {
  try {
    const raw = localStorage.getItem(QCD_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

/* =========================================================
   SAVE / LOAD
========================================================= */
function saveGame() {
  const payload = {
    name: state.name, chapter: state.chapter, stats: state.stats,
    notes: state.notes, eventsDone: state.eventsDone,
    currentRoom: state.currentRoom, player: state.player,
    visited: state.visited,
    talkCount: state.talkCount, lastLine: state.lastLine,
    ts: Date.now()
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); }
  catch (e) { SFXManager.play("warning"); showToast("セーブ失敗"); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    state.name = p.name; state.chapter = p.chapter;
    state.stats = { ...GAME_DATA.defaultStats, ...(p.stats || {}) };
    state.notes = p.notes || [];
    state.eventsDone = p.eventsDone || {};
    state.currentRoom = p.currentRoom || "lobby";
    state.player = p.player || { x: 200, y: 360 };
    state.visited = p.visited || { lobby: true };
    state.talkCount = p.talkCount || {};
    state.lastLine = p.lastLine || {};
    return true;
  } catch (e) { return false; }
}
function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

/* =========================================================
   INPUT
========================================================= */
function isZHeld() {
  return state.keys.z && (Date.now() - state.zHeldSince > 350);
}

document.addEventListener("keydown", e => {
  const k = e.key;
  /* Prevent arrow scroll */
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();

  if (document.activeElement && document.activeElement.tagName === "INPUT") return;

  const wasDown = state.keys[k];
  state.keys[k] = true;
  if ((k === "z" || k === "Z") && !wasDown) state.zHeldSince = Date.now();

  /* Priority order of overlays */
  /* Self-hint popup (after kumon clear) — close on Z/X/Enter/Escape */
  const selfHintEl = document.getElementById("self-hint");
  if (selfHintEl && !selfHintEl.classList.contains("hidden")) {
    if (k === "z" || k === "Z" || k === "x" || k === "X" || k === "Enter" || k === "Escape") closeSelfHint();
    return;
  }
  /* Self battle takes priority over everything else when active */
  if (state.selfBattleActive) {
    /* Track arena keys for the loop (case-insensitive WASD + arrows) */
    state.selfKeys[k] = true;
    if (state.selfBattlePhase === "playerCommand") {
      const lis = document.querySelectorAll("#self-command-list .self-command");
      const len = lis.length || 1;
      if (k === "ArrowUp")   { state.selfCommandIdx = (state.selfCommandIdx - 1 + len) % len; selfRenderCommandFocus(); SFXManager.play("cursor", { cooldown: 60 }); }
      if (k === "ArrowDown") { state.selfCommandIdx = (state.selfCommandIdx + 1) % len; selfRenderCommandFocus(); SFXManager.play("cursor", { cooldown: 60 }); }
      if ((k === "z" || k === "Z") && !wasDown) selfPickCommand();
    } else if (state.selfBattlePhase === "attackMeter") {
      if ((k === "z" || k === "Z") && !wasDown) selfCommitAttackMeter();
    }
    /* During "enemy" / "intro" / "result", arrow keys are silently consumed
       above. We never expose ESC-to-quit so the player must see the round
       through (per spec: "敗北/勝利まで進む設計でOK"). */
    return;
  }
  /* Secret-hint popup (after first clear) */
  const hintEl = document.getElementById("secret-hint");
  if (hintEl && !hintEl.classList.contains("hidden")) {
    if (k === "z" || k === "Z" || k === "x" || k === "X" || k === "Enter" || k === "Escape") closeSecretHint();
    return;
  }
  if (state.endingOpen) {
    if (k === "z" || k === "Z" || k === "x" || k === "X") closeEnding();
    return;
  }
  if (state.battle) {
    const b = state.battle;
    if (b.done) {
      if (k === "z" || k === "Z" || k === "x" || k === "X") closeBattle();
      return;
    }
    const phases = GAME_DATA.battle.phases;
    const clen = phases[b.phase].choices.length;
    if (k === "ArrowUp")   { b.choiceIdx = (b.choiceIdx - 1 + clen) % clen; renderBattle(); SFXManager.play("cursor", { cooldown: 60 }); }
    if (k === "ArrowDown") { b.choiceIdx = (b.choiceIdx + 1) % clen; renderBattle(); SFXManager.play("cursor", { cooldown: 60 }); }
    if ((k === "z" || k === "Z") && !wasDown) { SFXManager.play("confirm"); pickBattleChoice(); }
    return;
  }
  if (state.helpOpen) {
    if (k === "x" || k === "X" || k === "Escape") { SFXManager.play("cancel"); closeHelp(); }
    return;
  }
  if (state.notebookOpen) {
    if (k === "x" || k === "X" || k === "c" || k === "C" || k === "Escape") { SFXManager.play("cancel"); closeNotebook(); }
    return;
  }
  if (state.menu.active) {
    const lis = document.querySelectorAll("#menu-list li");
    if (k === "ArrowUp")   { state.menu.idx = (state.menu.idx - 1 + lis.length) % lis.length; renderMenu(); SFXManager.play("cursor", { cooldown: 60 }); }
    if (k === "ArrowDown") { state.menu.idx = (state.menu.idx + 1) % lis.length; renderMenu(); SFXManager.play("cursor", { cooldown: 60 }); }
    if ((k === "z" || k === "Z") && !wasDown) { SFXManager.play("confirm"); pickMenu(); }
    if (k === "x" || k === "X" || k === "Escape") { SFXManager.play("cancel"); closeMenu(); }
    return;
  }
  if (state.dialog.active) {
    if (state.dialog.waitingChoice) {
      const cs = state.dialog.choices;
      if (k === "ArrowUp")   { state.dialog.choiceIdx = (state.dialog.choiceIdx - 1 + cs.length) % cs.length; renderChoiceFocus(); SFXManager.play("cursor", { cooldown: 60 }); }
      if (k === "ArrowDown") { state.dialog.choiceIdx = (state.dialog.choiceIdx + 1) % cs.length; renderChoiceFocus(); SFXManager.play("cursor", { cooldown: 60 }); }
      /* Reject auto-repeats: only act on initial press */
      if ((k === "z" || k === "Z") && !wasDown) { SFXManager.play("confirm"); pickChoice(); }
    } else {
      /* Block immediate advance right after pickChoice (lets the
         reply text actually be read), and reject auto-repeat. */
      const lock = state.dialog.advanceLockUntil || 0;
      if ((k === "z" || k === "Z") && !wasDown && Date.now() >= lock) advanceDialog();
    }
    return;
  }
  /* Sound selection screen */
  if (state.screen === "sound") {
    if (k === "ArrowUp" || k === "ArrowLeft") {
      state.soundScreen.idx = (state.soundScreen.idx - 1 + 2) % 2;
      renderSoundScreen();
      SFXManager.play("cursor", { cooldown: 60 });
    }
    if (k === "ArrowDown" || k === "ArrowRight") {
      state.soundScreen.idx = (state.soundScreen.idx + 1) % 2;
      renderSoundScreen();
      SFXManager.play("cursor", { cooldown: 60 });
    }
    if ((k === "z" || k === "Z") && !wasDown) { SFXManager.play("confirm"); confirmSoundScreen(); }
    if (k === "x" || k === "X" || k === "Escape") { SFXManager.play("cancel"); cancelSoundScreen(); }
    return;
  }
  /* Game screen normal controls */
  if (state.screen === "game") {
    if (k === "z" || k === "Z") interactZ();
    if (k === "x" || k === "X") openMenu();
    if (k === "c" || k === "C") openNotebook();
  }
});

document.addEventListener("keyup", e => {
  state.keys[e.key] = false;
  if (state.selfBattleActive) state.selfKeys[e.key] = false;
});

/* Lose all held arrow keys when the tab loses focus — otherwise the
   self heart can drift forever after an alt-tab. */
window.addEventListener("blur", () => {
  state.selfKeys = {};
});

/* =========================================================
   TITLE BUTTONS
========================================================= */
$("btn-start").addEventListener("click", () => {
  const raw = ($("player-name").value || "").trim();
  const name = raw || "新人";
  state.name = name.substring(0, 10);
  SFXManager.play("confirm");
  /* Hidden command #2: name = "自分" / "jibun" + kumon cleared → Self battle */
  if (isKumonCleared() && isSelfName(raw)) {
    state.selfBattleMode = true;
    state.kumonMode = false;
    enterSoundScreen("self");
    return;
  }
  /* Hidden command #1: name = "domino" + cleared once → Kumon mode (skip normal play) */
  if (isCleared() && isDominoName(raw)) {
    state.kumonMode = true;
    state.selfBattleMode = false;
    enterSoundScreen("kumon");
    return;
  }
  state.kumonMode = false;
  state.selfBattleMode = false;
  enterSoundScreen("new");
});

/* Live `??` hint while typing the secret name on title */
const _nameInput = $("player-name");
if (_nameInput) {
  _nameInput.addEventListener("input", () => {
    if (state.screen !== "title") return;
    /* Self battle hint takes priority when both are unlocked */
    if (isKumonCleared() && isSelfName(_nameInput.value)) {
      showSelfToast("……自分？");
      return;
    }
    if (isCleared() && isDominoName(_nameInput.value)) showToast("??");
  });
}

$("btn-continue").addEventListener("click", () => {
  if (!loadGame()) { SFXManager.play("warning"); showToast("セーブがありません"); return; }
  SFXManager.play("confirm");
  enterSoundScreen("continue");
});

/* ========== SOUND SCREEN ========== */
function loadSoundPref() {
  try {
    const v = localStorage.getItem(SOUND_PREF_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch (e) {}
  return null; /* unset → default OFF */
}
function saveSoundPref(enabled) {
  try { localStorage.setItem(SOUND_PREF_KEY, enabled ? "true" : "false"); } catch (e) {}
}

function enterSoundScreen(mode) {
  state.soundScreen.mode = mode;
  /* Initial selection: previous pref if set, otherwise OFF */
  const pref = loadSoundPref();
  state.soundScreen.idx = (pref === true) ? 0 : 1;
  renderSoundScreen();
  showScreen("sound");
}

function renderSoundScreen() {
  const opts = document.querySelectorAll("#sound-options .sound-opt");
  opts.forEach((el, i) => el.classList.toggle("active", i === state.soundScreen.idx));
}

function confirmSoundScreen() {
  const enabled = state.soundScreen.idx === 0;
  saveSoundPref(enabled);
  AudioManager.setEnabled(enabled);
  SFXManager.setEnabled(enabled);

  const mode = state.soundScreen.mode;
  if (mode === "kumon") {
    /* Hidden Kumon ending — skip normal play entirely */
    startKumonMode();
    return;
  }
  if (mode === "self") {
    /* Hidden Self battle — skip normal play entirely */
    startSelfBattle();
    return;
  }
  if (mode === "new") {
    state.chapter = 1;
    state.stats = { ...GAME_DATA.defaultStats };
    state.notes = ["新人として、Odinプロジェクトに配属された"];
    state.eventsDone = {};
    state.currentRoom = "lobby";
    state.player = { x: 200, y: 360 };
    state.visited = { lobby: true };
    state.talkCount = {};
    state.lastLine = {};
  }
  /* Refresh NG2 flag (set after first ending) */
  state.isNG2 = isCleared() && (mode === "new");
  state.lastActivityAt = Date.now();
  state.lastIdleEventAt = Date.now();
  showScreen("game");
  setBaseTitle(BASE_TITLE);
  renderRoom();
  requestAnimationFrame(() => { resizeStage(); requestAnimationFrame(resizeStage); });
  if (enabled) AudioManager.play("home");
  else AudioManager.stop();
}

function cancelSoundScreen() {
  state.soundScreen.mode = null;
  state.kumonMode = false;
  state.selfBattleMode = false;
  showScreen("title");
}

document.querySelectorAll("#sound-options .sound-opt").forEach((el, i) => {
  el.addEventListener("click", () => {
    state.soundScreen.idx = i;
    renderSoundScreen();
    SFXManager.play("confirm");
    confirmSoundScreen();
  });
});

$("btn-help").addEventListener("click", () => { SFXManager.play("confirm"); openHelp(); });

$("ending-back").addEventListener("click", closeEnding);

const _hintBack = $("hint-back");
if (_hintBack) _hintBack.addEventListener("click", closeSecretHint);

/* Menu list click */
document.querySelectorAll("#menu-list li").forEach((li, i) => {
  li.addEventListener("click", () => { state.menu.idx = i; renderMenu(); pickMenu(); });
});

/* =========================================================
   BOOT SEQUENCE
========================================================= */
function showBootSequence(onDone) {
  const ov = $("boot-overlay");
  if (!ov) { if (onDone) onDone(); return; }
  ov.classList.remove("hidden");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    ov.classList.add("hidden");
    document.removeEventListener("keydown", onSkipKey, true);
    ov.removeEventListener("click", onSkipClick, true);
    if (onDone) onDone();
  };
  const onSkipKey = (e) => {
    const k = e.key;
    if (k === "z" || k === "Z" || k === "x" || k === "X" ||
        k === "Enter" || k === " " || k === "Escape") {
      e.preventDefault();
      finish();
    }
  };
  const onSkipClick = () => finish();
  document.addEventListener("keydown", onSkipKey, true);
  ov.addEventListener("click", onSkipClick, true);
  setTimeout(finish, 1900);
}

/* =========================================================
   CHAPTER CLEAR STAMP
========================================================= */
function showChapterStamp(prevChapter) {
  const el = $("chapter-stamp");
  if (!el) return;
  el.classList.remove("hidden");
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  SFXManager.play("confirm", { cooldown: 200 });
  clearTimeout(showChapterStamp._t);
  showChapterStamp._t = setTimeout(() => el.classList.add("hidden"), 1500);
}

/* =========================================================
   STAGE SCALING (responsive)
========================================================= */
function resizeStage() {
  const wrap = $("stage-wrap");
  const stage = $("stage");
  if (!wrap || !stage) return;
  const rect = wrap.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const sx = rect.width / 960;
  const sy = rect.height / 540;
  const s = Math.min(sx, sy);
  if (!isFinite(s) || s <= 0) return;
  stage.style.transform = `scale(${s})`;
}
window.addEventListener("resize", resizeStage);

/* =========================================================
   MAIN LOOP
========================================================= */
function loop() {
  updatePlayerMovement();
  requestAnimationFrame(loop);
}

/* =========================================================
   TAB VISIBILITY — favicon + title swap
========================================================= */
let _baseTitle = BASE_TITLE;
function setBaseTitle(t) {
  _baseTitle = t || BASE_TITLE;
  if (!document.hidden) document.title = _baseTitle;
}
function setFavicon(href) {
  const link = document.getElementById("favicon");
  if (link) link.setAttribute("href", href);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    document.title = AWAY_TITLE;
    setFavicon(ASSETS.faviconAway);
  } else {
    document.title = _baseTitle || BASE_TITLE;
    setFavicon(ASSETS.favicon);
  }
});

/* =========================================================
   IDLE EVENT — 30s no-input → Kondou message
========================================================= */
const IDLE_THRESHOLD_MS  = 30 * 1000;
const IDLE_COOLDOWN_MS   = 60 * 1000;

function noteActivity() {
  state.lastActivityAt = Date.now();
}
["keydown", "mousedown", "click", "mousemove", "touchstart", "touchmove", "wheel"]
  .forEach(ev => document.addEventListener(ev, noteActivity, { passive: true }));

function idleTick() {
  /* Only consider triggering when player is in normal field exploration */
  if (state.screen !== "game") return;
  if (state.dialog.active || state.menu.active || state.notebookOpen ||
      state.helpOpen || state.battle || state.endingOpen ||
      state.kumonActive) return;
  const now = Date.now();
  if (now - state.lastActivityAt < IDLE_THRESHOLD_MS) return;
  if (now - state.lastIdleEventAt < IDLE_COOLDOWN_MS) return;
  state.lastIdleEventAt = now;
  state.lastActivityAt = now; /* reset so we don't re-fire next tick */
  /* Kondou pops up with the requested line */
  runDialog("近藤", [{ t: "お疲れかな(。´･ω･)?" }], null, "kondou");
}
setInterval(idleTick, 1000);

/* =========================================================
   TITLE-SCREEN HIDDEN HINT (`domino`)
========================================================= */
function isDominoName(v) {
  return ((v || "") + "").trim().toLowerCase() === "domino";
}
function updateTitleHint() {
  /* Show the small `??` hint only if the player has cleared once
     and the name input is exactly "domino". */
  const input = $("player-name");
  if (!input) return;
  if (state.screen !== "title") return;
  if (!isCleared()) return;
  if (isDominoName(input.value)) {
    showToast("??");
  }
}

/* =========================================================
   KUMON MODE
========================================================= */
function buildKumonQueue() {
  const qcd = loadQcdResult();
  const speaker = "公文";
  /* Kumon never calls the player by name (the entry name is "domino"). */
  const lines = [
    "ふぇ〜、久しぶりやな。",
    "なんやその顔、緊張しとんの？まぁ気楽にやりなはれ。",
    "1週目クリアしたんやって？ガンバレ言うたやろ、ちゃんと最後まで歩いたやんけ。"
  ];

  /* Battle result branching */
  if (!qcd) {
    lines.push("QCDの方はまだなんやな。まぁ、機会あったら覗いてみ。");
  } else {
    const meter = qcd.meter || 0;
    if (meter >= 80) {
      lines.push("QCDの納得度" + meter + "か。ええやん。ちゃんとQもCもDも見てる。");
      lines.push("こういう人は、あとで効いてくるんよ。");
    } else if (meter >= 60) {
      lines.push("QCDの納得度" + meter + "やな。悪くないな。");
      lines.push("でも、迷ったところに本音が出るんよ。");
    } else {
      lines.push("QCDの納得度" + meter + "か。ふぇ〜。");
      lines.push("まぁでも、失敗ログが一番強い資料になる時あるからな。");
    }
    /* Per-phase leaning detection (excluding Final) */
    const ratio = {};
    (qcd.scores || []).forEach(s => {
      if (s.phase === "Final Decision") return;
      const max = phaseMaxMeter(s.phase);
      if (max > 0) ratio[s.phase] = (s.meterAdd || 0) / max;
    });
    const phases = Object.keys(ratio);
    if (phases.length) {
      phases.sort((a, b) => ratio[b] - ratio[a]);
      const top = phases[0];
      if (top === "Cost") lines.push("お金の話だけで勝つと、あとで品質が取り立てに来るで。");
      else if (top === "Delivery") lines.push("急ぐのはええけど、急いだ理由を説明できるようにしとき。");
      else if (top === "Quality") lines.push("品質を見る目はええ。でも、作れへん正しさは現場で迷子になる時ある。");
    }
  }

  /* 雑談 (株・車・自由奔放) */
  lines.push("最近な、株のチャート眺めとった。下振れも上振れもあるけど、最後は設計思想やと思うで。");
  lines.push("車？ああ、相変わらず乗っとるよ。週末だけアクセル踏むのが、ちょうどええバランスや。");
  lines.push("自由にやっとるように見えるかもしれんけど、まぁ実際そうやな(笑)");
  /* 核心 + 締め */
  lines.push("せっかくやるなら、全部見た方がいいか。寄り道も、たぶん本筋や。");
  lines.push("終わりというか、始まった感の方が強いな。ええ顔しとるで。");
  lines.push("ほな、またな。じゃあな。");

  return lines.map(t => ({ t, speaker }));
}

function phaseMaxMeter(name) {
  const ph = (GAME_DATA.battle.phases || []).find(p => p.name === name);
  if (!ph) return 0;
  return ph.choices.reduce((m, c) => Math.max(m, c.meter || 0), 0);
}

function startKumonMode() {
  state.kumonActive = true;
  state.kumonEnded = false;
  document.body.classList.add("kumon-active");
  /* Show the Kumon stage with both hearts */
  const ov = $("kumon-mode");
  if (ov) ov.classList.remove("hidden");
  const lbl = $("kumon-player-label");
  if (lbl) lbl.textContent = (state.name || "YOU").toUpperCase();
  const endTag = $("kumon-end");
  if (endTag) endTag.classList.add("hidden");
  /* Title flair */
  setBaseTitle("DOMINO Quest — another ending");
  /* BGM */
  AudioManager.switchTo("kumon");
  /* Run the dialog queue */
  const queue = buildKumonQueue();
  runDialog("公文", queue, finishKumonMode, "kumon");
}

function finishKumonMode() {
  state.kumonEnded = true;
  /* Mark kumon as fully cleared so the self-battle gate can open */
  try { localStorage.setItem(KUMON_CLEARED_KEY, "true"); } catch (e) {}
  /* Show ending tag, then return to title shortly */
  const endTag = $("kumon-end");
  if (endTag) endTag.classList.remove("hidden");
  setTimeout(() => {
    const ov = $("kumon-mode");
    if (ov) ov.classList.add("hidden");
    document.body.classList.remove("kumon-active");
    state.kumonActive = false;
    state.kumonMode = false;
    AudioManager.stop();
    setBaseTitle(BASE_TITLE);
    showScreen("title");
    /* Show this hint at the end of Kumon even if an earlier broken build
       already wrote the "shown" flag before the popup was actually seen. */
    setTimeout(() => openSelfHint({ force: true }), 320);
  }, 2400);
}

/* =========================================================
   SELF BATTLE — "自分自身との戦い"
   ---------------------------------------------------------
   A self-contained 弾幕避け + ターン制 mini-battle, isolated from
   the main game loop, the QCD battle, and the Kumon ending.
   Triggered by NAME = "自分" / "jibun" once Kumon mode has been
   seen to its end (KUMON_CLEARED_KEY === "true").
========================================================= */

/* Match either the kanji "自分" or the romanised "jibun".
   Trim and lowercase so casing/whitespace don't matter. */
function isSelfName(v) {
  const s = ((v || "") + "").trim().toLowerCase();
  return s === "自分" || s === "jibun";
}

/* Toast variant for the self-name detection on the title screen. */
function showSelfToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.remove("toast-hint");
  t.classList.add("toast-self");
  clearTimeout(showSelfToast._t);
  showSelfToast._t = setTimeout(() => {
    t.classList.add("hidden");
    t.classList.remove("toast-self");
  }, 1800);
}

/* ---------- Self hint popup ---------- */
function openSelfHint(options) {
  const ov = $("self-hint");
  if (!ov) return;
  if (isSelfHintShown() && !(options && options.force)) return;
  ov.classList.remove("hidden");
  SFXManager.play("confirm", { cooldown: 200 });
}
function closeSelfHint() {
  const ov = $("self-hint");
  if (ov) ov.classList.add("hidden");
  SFXManager.play("cancel");
  /* Mark it only after the player closes it, not when it first opens. */
  try { localStorage.setItem(SELF_HINT_SHOWN_KEY, "true"); } catch (e) {}
}

/* ---------- Self battle: setup, run, teardown ---------- */
const SELF_BATTLE_CFG = {
  arenaW: 480,
  arenaH: 220,
  heartW: 32,
  heartH: 28,
  /* Hit cushion: shrink hitbox a little so the player has fair iframes. */
  heartHitInset: 6,
  heartSpeed: 230,        /* px/s */
  hitDamage: 10,
  hitCooldownMs: 700,
  attackMinDamage: 20,
  attackMaxDamage: 42,
  watchDamage: 18,
  standDamage: 20,
  /* Per-turn enemy phase length (ms) — kept "難しいけど勝てる" shape */
  turnDurationMs: [9000, 9500, 10000, 10500, 11000],
  turns: 5
};

const SELF_BATTLE_LINES = {
  intro: [
    "最後に出てきたのは、誰でもない。",
    "自分自身だった。",
    "いちばん見たくなかった相手が、いちばん近くにいた。"
  ],
  enemyTaunt: [
    "まだ、言い訳を探す？",
    "できない理由なら、もう何回も聞いた。",
    "納期より、品質より、コストより、まず自分の設計思想だろ。",
    "逃げるな。ここは会議室じゃない。",
    "お前が一番、お前の足を止めてる。"
  ],
  turnLine: [
    "まずは避けてみろ。",
    "想定外？ いつもそう言ってるな。",
    "仕様変更は突然来る。",
    "焦ると、見えるものも見えなくなる。",
    "最後くらい、自分で決めろ。"
  ],
  command: [
    "向き合うか。決めるか。進めるか。",
    "迷っても、選んだ手だけが残る。",
    "ここで止まるな。",
    "深呼吸。フォームが崩れる前に。",
    "次の一手を、自分で押せ。"
  ],
  victory: [
    "自分自身に勝った、というより",
    "少しだけ、扱い方を覚えた。",
    "弱さも、迷いも、ログとして残していい。",
    "それでも、次の一歩は自分で押せる。",
    "DOMINO Quest — true self ending"
  ],
  defeat: [
    "倒された。",
    "でも、これは終わりではない。",
    "自分自身との戦いは、だいたい再戦できる。",
    "もう一度、NAME に『自分』と入力すればいい。"
  ],
  stalemate: [
    "削り切れなかった。",
    "今日のお前は、ここまでだ。",
    "5ターン。 設計思想が、まだ揺れてる。",
    "もう一度、NAME に『自分』と入力すればいい。"
  ]
};

function selfTrackTimer(id) { state.selfTimers.push(id); return id; }
function selfClearTimers() {
  while (state.selfTimers.length) {
    const id = state.selfTimers.pop();
    try { clearTimeout(id); } catch (e) {}
  }
}

function selfSetPhaseLabel(text) {
  const el = $("self-phase-label");
  if (el) el.textContent = text || "—";
}
function selfSetTurnLabel() {
  const el = $("self-turn-label");
  if (el) el.textContent = "TURN " + state.selfBattleTurn + " / " + SELF_BATTLE_CFG.turns;
}
function selfWriteNarration(text) {
  const el = $("self-narration");
  if (el) el.textContent = text || "";
}

/* Sequentially type a list of lines into the narration box.
   Lines are not actually typed character-by-character — to stay consistent
   with the existing dialog engine, we write them in full and pause between. */
function selfShowLines(lines, onDone, perLineMs) {
  const ms = perLineMs || 1500;
  let i = 0;
  const step = () => {
    if (!state.selfBattleActive) return; /* aborted */
    if (i >= lines.length) { if (onDone) onDone(); return; }
    selfWriteNarration(lines[i]);
    SFXManager.play("dialogueDark", { cooldown: 80 });
    i += 1;
    selfTrackTimer(setTimeout(step, ms));
  };
  step();
}

/* Update visible HP bars + numbers. */
function selfUpdateHpBars() {
  const pBar = $("self-player-hp-bar");
  const pNum = $("self-player-hp-num");
  const eBar = $("self-enemy-hp-bar");
  const eNum = $("self-enemy-hp-num");
  const ph = clamp(state.selfPlayerHp, 0, 100);
  const eh = clamp(state.selfEnemyHp, 0, 100);
  if (pBar) pBar.style.width = ph + "%";
  if (pNum) pNum.textContent = ph;
  if (eBar) eBar.style.width = eh + "%";
  if (eNum) eNum.textContent = eh;
}

function selfPlaceHeart() {
  const el = $("self-heart");
  if (!el) return;
  el.style.transform = `translate(${state.selfHeart.x}px, ${state.selfHeart.y}px)`;
}

/* Reset arena DOM + heart position for a fresh phase. */
function selfResetArena() {
  state.selfObstacles = [];
  const ob = $("self-obstacles");
  if (ob) ob.innerHTML = "";
  state.selfHeart.x = (SELF_BATTLE_CFG.arenaW - SELF_BATTLE_CFG.heartW) / 2;
  state.selfHeart.y = (SELF_BATTLE_CFG.arenaH - SELF_BATTLE_CFG.heartH) / 2;
  state.selfHeart.hitUntil = 0;
  selfPlaceHeart();
}

/* ---------- Obstacle factory per turn ----------
   Returns spawn config: { interval (ms), make() -> obstacle } */
function selfSpawnerForTurn(turn) {
  const W = SELF_BATTLE_CFG.arenaW;
  const H = SELF_BATTLE_CFG.arenaH;
  const sprites = ASSETS.selfObstacleSprites;
  const pick = (i) => sprites[i % sprites.length];

  if (turn === 1) {
    /* 横方向にボルトが流れてくる */
    return {
      interval: 620,
      make() {
        return {
          x: W + 8, y: 20 + Math.random() * (H - 40),
          w: 26, h: 26,
          vx: -(150 + Math.random() * 30), vy: 0,
          sprite: pick(0), spin: false
        };
      }
    };
  }
  if (turn === 2) {
    /* 上からレンチ(=Spanner)が落ちてくる */
    return {
      interval: 520,
      make() {
        return {
          x: 10 + Math.random() * (W - 30), y: -28,
          w: 26, h: 26,
          vx: 0, vy: 150 + Math.random() * 40,
          sprite: pick(1), spin: false
        };
      }
    };
  }
  if (turn === 3) {
    /* 歯車が斜めに移動する */
    return {
      interval: 700,
      make() {
        const fromLeft = Math.random() < 0.5;
        const dirX = fromLeft ? 1 : -1;
        const speedX = 110 + Math.random() * 40;
        const speedY = 50  + Math.random() * 50;
        return {
          x: fromLeft ? -28 : W + 8,
          y: 10 + Math.random() * (H - 60),
          w: 28, h: 28,
          vx: dirX * speedX,
          vy: (Math.random() < 0.5 ? -1 : 1) * speedY,
          sprite: pick(2), spin: true
        };
      }
    };
  }
  if (turn === 4) {
    /* ボルト(横) と ナット(=Screw 縦) が交差 */
    let toggle = 0;
    return {
      interval: 480,
      make() {
        toggle = (toggle + 1) % 2;
        if (toggle === 0) {
          return {
            x: W + 8, y: 20 + Math.random() * (H - 40),
            w: 26, h: 26,
            vx: -(170 + Math.random() * 30), vy: 0,
            sprite: pick(0), spin: false
          };
        }
        return {
          x: 10 + Math.random() * (W - 30), y: -28,
          w: 24, h: 24,
          vx: 0, vy: 170 + Math.random() * 30,
          sprite: pick(3), spin: true
        };
      }
    };
  }
  /* turn 5: 複数のメカパーツが少し速めに動く (mix all sprites) */
  return {
    interval: 420,
    make() {
      const mode = Math.floor(Math.random() * 4);
      const idx = Math.floor(Math.random() * sprites.length);
      const sprite = sprites[idx];
      if (mode === 0) {
        return { x: W + 8, y: 10 + Math.random() * (H - 30), w: 26, h: 26,
                 vx: -(180 + Math.random() * 40), vy: (Math.random() - 0.5) * 50,
                 sprite, spin: idx % 2 === 0 };
      }
      if (mode === 1) {
        return { x: -28, y: 10 + Math.random() * (H - 30), w: 26, h: 26,
                 vx: +(170 + Math.random() * 40), vy: (Math.random() - 0.5) * 50,
                 sprite, spin: idx % 2 === 0 };
      }
      if (mode === 2) {
        return { x: 10 + Math.random() * (W - 30), y: -28, w: 24, h: 24,
                 vx: (Math.random() - 0.5) * 60, vy: 180 + Math.random() * 40,
                 sprite, spin: idx % 2 === 0 };
      }
      /* diagonal sweep */
      const fromLeft = Math.random() < 0.5;
      return { x: fromLeft ? -28 : SELF_BATTLE_CFG.arenaW + 8,
               y: 10 + Math.random() * (SELF_BATTLE_CFG.arenaH - 60),
               w: 28, h: 28,
               vx: (fromLeft ? 1 : -1) * (140 + Math.random() * 50),
               vy: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50),
               sprite, spin: true };
    }
  };
}

/* Render a single new obstacle into the arena DOM.
   Position is driven by left/top so the optional .spin CSS animation
   (which owns `transform`) doesn't fight us. */
function selfAppendObstacleEl(ob) {
  const layer = $("self-obstacles");
  if (!layer) return;
  const el = document.createElement("img");
  el.className = "self-obstacle" + (ob.spin ? " spin" : "");
  el.src = ob.sprite;
  el.alt = "";
  el.style.width = ob.w + "px";
  el.style.height = ob.h + "px";
  el.style.left = ob.x + "px";
  el.style.top  = ob.y + "px";
  /* Graceful fallback: if sprite is missing, render as outlined block. */
  el.onerror = () => {
    el.removeAttribute("src");
    el.style.background = "#222";
    el.style.border = "2px solid #fff";
  };
  ob.el = el;
  layer.appendChild(el);
}

/* Tick the per-frame obstacle simulation. dt is in seconds. */
function selfTickObstacles(dt) {
  const W = SELF_BATTLE_CFG.arenaW;
  const H = SELF_BATTLE_CFG.arenaH;
  const live = [];
  for (const ob of state.selfObstacles) {
    ob.x += ob.vx * dt;
    ob.y += ob.vy * dt;
    /* Cull when fully off-screen with margin */
    if (ob.x < -60 || ob.x > W + 60 || ob.y < -60 || ob.y > H + 60) {
      if (ob.el && ob.el.parentNode) ob.el.parentNode.removeChild(ob.el);
      continue;
    }
    if (ob.el) {
      ob.el.style.left = ob.x + "px";
      ob.el.style.top  = ob.y + "px";
    }
    live.push(ob);
  }
  state.selfObstacles = live;
}

/* AABB overlap with shrunken heart hitbox. */
function selfCheckHits(now) {
  if (now < state.selfHeart.hitUntil) return; /* iframes */
  const inset = SELF_BATTLE_CFG.heartHitInset;
  const hx = state.selfHeart.x + inset;
  const hy = state.selfHeart.y + inset;
  const hw = SELF_BATTLE_CFG.heartW - inset * 2;
  const hh = SELF_BATTLE_CFG.heartH - inset * 2;
  for (const ob of state.selfObstacles) {
    if (hx < ob.x + ob.w && hx + hw > ob.x &&
        hy < ob.y + ob.h && hy + hh > ob.y) {
      selfApplyPlayerHit(now);
      return;
    }
  }
}

function selfApplyPlayerHit(now) {
  state.selfPlayerHp = clamp(state.selfPlayerHp - SELF_BATTLE_CFG.hitDamage, 0, 100);
  state.selfHeart.hitUntil = now + SELF_BATTLE_CFG.hitCooldownMs;
  selfUpdateHpBars();
  SFXManager.play("warning", { cooldown: 120 });
  const hEl = $("self-heart");
  if (hEl) {
    hEl.classList.remove("hurt");
    void hEl.offsetWidth; /* restart anim */
    hEl.classList.add("hurt");
  }
  const arena = $("self-battle-arena");
  if (arena) {
    arena.classList.remove("shake");
    void arena.offsetWidth;
    arena.classList.add("shake");
  }
  if (state.selfPlayerHp <= 0) {
    selfEndBattle("defeat");
  }
}

/* Main per-frame loop while overlay is up. */
function selfLoop(ts) {
  if (!state.selfBattleActive) { state.selfAnimationFrame = 0; return; }
  const last = state.selfLastTickAt || ts;
  let dt = (ts - last) / 1000;
  if (dt > 0.06) dt = 0.06; /* clamp big stalls (tab switch) */
  state.selfLastTickAt = ts;

  if (state.selfBattlePhase === "enemy") {
    /* Player movement */
    const k = state.selfKeys;
    let dx = 0, dy = 0;
    if (k.ArrowLeft  || k.a || k.A) dx -= 1;
    if (k.ArrowRight || k.d || k.D) dx += 1;
    if (k.ArrowUp    || k.w || k.W) dy -= 1;
    if (k.ArrowDown  || k.s || k.S) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
    const sp = SELF_BATTLE_CFG.heartSpeed * dt;
    state.selfHeart.x = clamp(state.selfHeart.x + dx * sp, 0, SELF_BATTLE_CFG.arenaW - SELF_BATTLE_CFG.heartW);
    state.selfHeart.y = clamp(state.selfHeart.y + dy * sp, 0, SELF_BATTLE_CFG.arenaH - SELF_BATTLE_CFG.heartH);
    selfPlaceHeart();

    /* Spawn */
    if (ts >= state.selfNextSpawnAt && state.selfSpawner) {
      const ob = state.selfSpawner.make();
      selfAppendObstacleEl(ob);
      state.selfObstacles.push(ob);
      state.selfNextSpawnAt = ts + state.selfSpawner.interval;
    }

    /* Move + collide */
    selfTickObstacles(dt);
    selfCheckHits(ts);

    /* End-of-phase check */
    if (ts >= state.selfTurnEndAt) {
      selfEnterPlayerCommand();
    }
  } else if (state.selfBattlePhase === "attackMeter" && state.selfAttackMeterActive) {
    /* Bounce a 0..1 cursor along the meter at a steady rate. */
    state.selfMeterT += state.selfMeterDir * dt * 1.4;
    if (state.selfMeterT >= 1) { state.selfMeterT = 1; state.selfMeterDir = -1; }
    if (state.selfMeterT <= 0) { state.selfMeterT = 0; state.selfMeterDir = 1; }
    const cur = $("self-meter-cursor");
    if (cur) {
      const trackW = (cur.parentNode && cur.parentNode.clientWidth) || 100;
      const px = state.selfMeterT * (trackW - 4);
      cur.style.transform = `translate(${px}px, 0)`;
    }
  }

  state.selfAnimationFrame = requestAnimationFrame(selfLoop);
}

/* ---------- Phase transitions ---------- */
function selfBeginEnemyPhase() {
  state.selfBattlePhase = "enemy";
  selfSetPhaseLabel("ENEMY ATTACK");
  /* Reset arena */
  selfResetArena();
  /* Hide command/meter */
  const cb = $("self-command-box"); if (cb) cb.classList.add("hidden");
  const am = $("self-attack-meter"); if (am) am.classList.add("hidden");
  /* Configure spawner + duration */
  state.selfSpawner = selfSpawnerForTurn(state.selfBattleTurn);
  const dur = SELF_BATTLE_CFG.turnDurationMs[Math.min(state.selfBattleTurn - 1, SELF_BATTLE_CFG.turnDurationMs.length - 1)];
  const now = performance.now();
  state.selfTurnEndAt = now + dur;
  state.selfNextSpawnAt = now + 350;
  selfWriteNarration(SELF_BATTLE_LINES.turnLine[state.selfBattleTurn - 1] || "");
}

function selfEnterPlayerCommand() {
  state.selfBattlePhase = "playerCommand";
  selfSetPhaseLabel("YOUR TURN");
  /* Clear any lingering obstacle from frame */
  state.selfObstacles.forEach(ob => { if (ob.el && ob.el.parentNode) ob.el.parentNode.removeChild(ob.el); });
  state.selfObstacles = [];
  /* Pick a random ターン中セリフ → command flavour */
  const cmdLine = SELF_BATTLE_LINES.command[(state.selfBattleTurn - 1) % SELF_BATTLE_LINES.command.length];
  selfWriteNarration(cmdLine);
  /* Show command box */
  state.selfCommandIdx = 0;
  selfRenderCommandFocus();
  const cb = $("self-command-box"); if (cb) cb.classList.remove("hidden");
  const am = $("self-attack-meter"); if (am) am.classList.add("hidden");
}

function selfRenderCommandFocus() {
  const lis = document.querySelectorAll("#self-command-list .self-command");
  lis.forEach((li, i) => li.classList.toggle("active", i === state.selfCommandIdx));
}

/* "むきあう" → attack meter; "みつめる" → small fixed dmg + read enemy;
   "にげない" → small fixed dmg + slight damage reduction this round.
   All three move the battle forward (no skip / no escape). */
function selfPickCommand() {
  const lis = document.querySelectorAll("#self-command-list .self-command");
  const li = lis[state.selfCommandIdx];
  const cmd = li ? li.dataset.cmd : "attack";
  SFXManager.play("confirm");
  if (cmd === "attack") {
    selfBeginAttackMeter();
  } else if (cmd === "watch") {
    /* みつめる: fixed small damage, but commit immediately */
    selfCommitFixedAttack(SELF_BATTLE_CFG.watchDamage);
  } else {
    /* にげない: stand-firm, small damage but quick */
    selfCommitFixedAttack(SELF_BATTLE_CFG.standDamage);
  }
}

function selfBeginAttackMeter() {
  state.selfBattlePhase = "attackMeter";
  selfSetPhaseLabel("TIMING");
  state.selfMeterT = 0;
  state.selfMeterDir = 1;
  state.selfAttackMeterActive = true;
  const cb = $("self-command-box"); if (cb) cb.classList.add("hidden");
  const am = $("self-attack-meter"); if (am) am.classList.remove("hidden");
}

function selfCommitAttackMeter() {
  if (!state.selfAttackMeterActive) return;
  state.selfAttackMeterActive = false;
  /* Damage curve: peak is now higher, and even a poor hit moves the fight. */
  const dist = Math.abs(state.selfMeterT - 0.5); /* 0..0.5 */
  const closeness = clamp(1 - dist * 2, 0, 1);   /* 1 at center */
  const dmg = Math.round(
    SELF_BATTLE_CFG.attackMinDamage +
    closeness * (SELF_BATTLE_CFG.attackMaxDamage - SELF_BATTLE_CFG.attackMinDamage)
  );
  selfCommitFixedAttack(dmg);
}

function selfCommitFixedAttack(dmg) {
  const am = $("self-attack-meter"); if (am) am.classList.add("hidden");
  const cb = $("self-command-box"); if (cb) cb.classList.add("hidden");
  state.selfEnemyHp = clamp(state.selfEnemyHp - dmg, 0, 100);
  selfUpdateHpBars();
  SFXManager.play("confirm", { cooldown: 80 });
  /* Enemy hit FX */
  const enemyBlock = document.querySelector(".self-enemy-block");
  if (enemyBlock) {
    enemyBlock.classList.remove("hit");
    void enemyBlock.offsetWidth;
    enemyBlock.classList.add("hit");
  }
  selfWriteNarration("「" + (state.name || "新人") + "」は自分自身に " + dmg + " のダメージを通した。");
  /* Decide next: end if enemy dead OR turns exhausted, else next turn */
  selfTrackTimer(setTimeout(() => {
    if (!state.selfBattleActive) return;
    if (state.selfEnemyHp <= 0) { selfEndBattle("victory"); return; }
    if (state.selfBattleTurn >= SELF_BATTLE_CFG.turns) {
      selfEndBattle("stalemate"); return;
    }
    state.selfBattleTurn += 1;
    selfSetTurnLabel();
    /* Brief enemy taunt before next dodge phase */
    const taunt = SELF_BATTLE_LINES.enemyTaunt[(state.selfBattleTurn - 1) % SELF_BATTLE_LINES.enemyTaunt.length];
    selfSetPhaseLabel("ENEMY");
    selfWriteNarration(taunt);
    selfTrackTimer(setTimeout(() => {
      if (!state.selfBattleActive) return;
      selfBeginEnemyPhase();
    }, 1400));
  }, 1100));
}

function selfEndBattle(outcome) {
  state.selfBattlePhase = "result";
  state.selfAttackMeterActive = false;
  /* Stop the per-frame loop */
  if (state.selfAnimationFrame) {
    try { cancelAnimationFrame(state.selfAnimationFrame); } catch (e) {}
    state.selfAnimationFrame = 0;
  }
  /* Hide interactive UI */
  const cb = $("self-command-box"); if (cb) cb.classList.add("hidden");
  const am = $("self-attack-meter"); if (am) am.classList.add("hidden");
  /* Clear obstacles */
  state.selfObstacles.forEach(ob => { if (ob.el && ob.el.parentNode) ob.el.parentNode.removeChild(ob.el); });
  state.selfObstacles = [];

  let lines, victoryAfter = null;
  if (outcome === "victory") {
    selfSetPhaseLabel("VICTORY");
    try { localStorage.setItem(SELF_BATTLE_CLEARED_KEY, "true"); } catch (e) {}
    lines = SELF_BATTLE_LINES.victory;
    victoryAfter = () => {
      /* Special toast on title return */
      selfTrackTimer(setTimeout(() => showSelfToast("TRUE SELF ENDING unlocked"), 600));
    };
  } else if (outcome === "defeat") {
    selfSetPhaseLabel("DEFEAT");
    bumpSelfBattleLosses();
    lines = SELF_BATTLE_LINES.defeat;
  } else {
    selfSetPhaseLabel("NOT YET");
    bumpSelfBattleLosses();
    lines = SELF_BATTLE_LINES.stalemate;
  }
  /* Sequentially reveal end lines, then return to title. */
  selfShowLines(lines, () => {
    selfTrackTimer(setTimeout(() => {
      selfCleanup();
      showScreen("title");
      setBaseTitle(BASE_TITLE);
      if (victoryAfter) victoryAfter();
    }, 1400));
  }, 1700);
}

function selfCleanup() {
  /* Defensive teardown — safe to call multiple times. */
  if (state.selfAnimationFrame) {
    try { cancelAnimationFrame(state.selfAnimationFrame); } catch (e) {}
    state.selfAnimationFrame = 0;
  }
  selfClearTimers();
  state.selfBattleActive = false;
  state.selfBattleMode = false;
  state.selfBattlePhase = null;
  state.selfAttackMeterActive = false;
  state.selfKeys = {};
  state.selfObstacles.forEach(ob => { if (ob.el && ob.el.parentNode) ob.el.parentNode.removeChild(ob.el); });
  state.selfObstacles = [];
  const ov = $("self-battle-mode");
  if (ov) ov.classList.add("hidden");
  const cb = $("self-command-box"); if (cb) cb.classList.add("hidden");
  const am = $("self-attack-meter"); if (am) am.classList.add("hidden");
  AudioManager.stop();
}

/* Entry point — called from confirmSoundScreen when mode === "self". */
function startSelfBattle() {
  /* Hard-reset state */
  state.selfBattleActive = true;
  state.selfBattleTurn = 1;
  state.selfPlayerHp = 100;
  state.selfEnemyHp = 100;
  state.selfBattlePhase = "intro";
  state.selfAttackMeterActive = false;
  state.selfKeys = {};
  state.selfObstacles = [];
  state.selfTimers = [];
  state.selfLastTickAt = 0;
  state.selfMeterT = 0;
  state.selfMeterDir = 1;

  const ov = $("self-battle-mode");
  if (ov) ov.classList.remove("hidden");
  selfSetTurnLabel();
  selfSetPhaseLabel("…");
  selfUpdateHpBars();
  selfResetArena();

  setBaseTitle("DOMINO Quest — 自分自身との戦い");
  AudioManager.switchTo("self");

  /* Start the per-frame loop right away — it idles when phase isn't "enemy". */
  state.selfAnimationFrame = requestAnimationFrame(selfLoop);

  /* Intro narration → first taunt → first enemy phase */
  selfShowLines(SELF_BATTLE_LINES.intro, () => {
    if (!state.selfBattleActive) return;
    const taunt = SELF_BATTLE_LINES.enemyTaunt[0];
    selfSetPhaseLabel("ENEMY");
    selfWriteNarration(taunt);
    selfTrackTimer(setTimeout(() => {
      if (!state.selfBattleActive) return;
      selfBeginEnemyPhase();
    }, 1500));
  }, 1700);
}

/* ---------- Self battle: input ---------- */
/* Click handlers (commands + meter commit) */
document.addEventListener("click", (e) => {
  if (!state.selfBattleActive) return;
  const cmd = e.target && e.target.closest && e.target.closest(".self-command");
  if (cmd && state.selfBattlePhase === "playerCommand") {
    const lis = Array.from(document.querySelectorAll("#self-command-list .self-command"));
    const i = lis.indexOf(cmd);
    if (i >= 0) {
      state.selfCommandIdx = i;
      selfRenderCommandFocus();
      selfPickCommand();
    }
    return;
  }
  if (state.selfBattlePhase === "attackMeter" &&
      e.target && e.target.closest &&
      e.target.closest("#self-attack-meter")) {
    selfCommitAttackMeter();
  }
});

/* Hint back button */
const _selfHintBack = $("self-hint-back");
if (_selfHintBack) _selfHintBack.addEventListener("click", () => {
  closeSelfHint();
});

/* =========================================================
   INIT
========================================================= */
function init() {
  AudioManager.init();
  SFXManager.init();
  /* SE follow the same enabled flag as BGM (saved in localStorage). */
  const pref = loadSoundPref();
  SFXManager.setEnabled(pref === true);

  /* CRT boot animation, then title (skippable). */
  showBootSequence(() => {
    showScreen("title");
    setBaseTitle(BASE_TITLE);
    setFavicon(ASSETS.favicon);
    resizeStage();
    requestAnimationFrame(resizeStage);
    if (!hasSave()) $("btn-continue").disabled = true;
  });

  loop();
}
init();
