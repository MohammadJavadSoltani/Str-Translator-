export type TextDirection = 'ltr' | 'rtl';

export type ToneId = 'natural' | 'formal' | 'casual' | 'literary' | 'concise';

export interface DialectOption {
  id: string;
  name: string;
  nativeName: string;
  region: string;
  summary: string;
  exampleSource: string;
  exampleTarget: string;
  promptDirectives: string;
}

export interface LanguageOption {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  dir: TextDirection;
  scriptFamily: 'persian' | 'arabic' | 'latin' | 'cjk' | 'cyrillic';
  needsTransliteration: boolean;
  defaultDialectId: string;
  dialects: DialectOption[];
}

export interface ToneOption {
  id: ToneId;
  label: string;
  description: string;
  promptDirective: string;
}

export interface SamplePhrase {
  id: string;
  category: string;
  title: string;
  text: string;
  recommendedLangId: string;
  recommendedDialectId: string;
  recommendedTone: ToneId;
}

export interface TranslationAlternative {
  style: string;
  text: string;
  explanation: string;
}

export interface KeyPhraseMapping {
  source: string;
  target: string;
  note: string;
}

export interface TranslationAnalysis {
  transliteration: string;
  registerNote: string;
  idiomNotes: string[];
  alternatives: TranslationAlternative[];
  keyPhrases: KeyPhraseMapping[];
}

export interface HistoryEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  transliteration?: string;
  languageId: string;
  dialectId: string;
  tone: ToneId;
  createdAt: number;
  starred: boolean;
}

export const TONES: ToneOption[] = [
  {
    id: 'natural',
    label: 'Natural',
    description: 'Balanced, idiomatic fluency as a native speaker would express it.',
    promptDirective:
      'Prioritize completely natural, idiomatic native phrasing. Avoid word-for-word translation calques; adapt sentence rhythm so it sounds originally composed in the target language.',
  },
  {
    id: 'formal',
    label: 'Formal',
    description: 'Polished, respectful register suited for publishing or correspondence.',
    promptDirective:
      'Use an elevated, courteous, and precise formal register appropriate for editorial publishing, diplomacy, or executive communication.',
  },
  {
    id: 'casual',
    label: 'Casual',
    description: 'Warm, relaxed everyday phrasing used among friends and peers.',
    promptDirective:
      'Use warm, approachable, everyday spoken rhythm with authentic natural contractions and relaxed phrasing.',
  },
  {
    id: 'literary',
    label: 'Literary',
    description: 'Eloquent, expressive prose with graceful cadence and rich diction.',
    promptDirective:
      'Craft eloquent, refined literary prose with rhythmic cadence, expressive vocabulary, and graceful imagery while remaining faithful to the original meaning.',
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Crisp, distilled wording without filler or redundancy.',
    promptDirective:
      'Deliver a tight, crystal-clear, concise rendering that preserves every core nuance using minimal, high-impact wording.',
  },
];

export const LANGUAGES: LanguageOption[] = [
  {
    id: 'fa',
    code: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    dir: 'rtl',
    scriptFamily: 'persian',
    needsTransliteration: true,
    defaultDialectId: 'fa-tehrani',
    dialects: [
      {
        id: 'fa-tehrani',
        name: 'Tehrani Conversational',
        nativeName: 'تهرانی محاوره‌ای',
        region: 'Tehran, Iran',
        summary: 'Warm, natural everyday Iranian Persian with authentic spoken contractions and idiomatic flow.',
        exampleSource: "I'm heading out for a quick coffee—want me to grab you anything?",
        exampleTarget: 'دارم می‌رم یه قهوه سریع بگیرم؛ برات چیزی بیارم؟',
        promptDirectives:
          'Write in fluent, natural modern Tehrani conversational Persian (محاوره‌ای امروزی). Use authentic spoken forms where natural (e.g., می‌خوام، می‌رم، یه، برات، چی شده، نمی‌دونم، می‌تونی), natural Persian word order, and warm idiomatic expressions rather than stiff textbook structures. Use standard Persian characters (ی and ک, never Arabic ي or ك) and proper half-space/ZWNJ (نیم‌فاصله) in verb prefixes like می‌رم and می‌خوام.',
      },
      {
        id: 'fa-literary',
        name: 'Literary & Formal',
        nativeName: 'معیار و ادبی',
        region: 'Standard Iranian Persian',
        summary: 'Polished contemporary editorial Persian with exact ZWNJ orthography and natural syntax.',
        exampleSource: 'True clarity arrives when we remove everything that does not belong.',
        exampleTarget: 'شفافیتِ راستین زمانی پدید می‌آید که هر آنچه نابجاست را کنار بگذاریم.',
        promptDirectives:
          'Write in impeccable, eloquent standard contemporary Persian (فارسی معیار و ویراستاری‌شده). Strictly avoid awkward English-to-Persian calques (ترجمه‌زدگی). Use proper Persian half-space/ZWNJ (نیم‌فاصله) consistently (e.g., می‌شود، کتاب‌ها، خانه‌ای، بی‌تردید), standard Persian ی and ک, and idiomatic Persian verb choices instead of overusing کردن.',
      },
      {
        id: 'fa-poetic',
        name: 'Poetic & Classical',
        nativeName: 'شاعرانه و کهن',
        region: 'Classical Literary Register',
        summary: 'Lyrical, melodic Persian prose infused with subtle classical cadence and graceful imagery.',
        exampleSource: 'Even in the quietest winter night, a single candle remembers the sun.',
        exampleTarget: 'حتی در خاموش‌ترین شبِ زمستان، شمعی تنها یادِ خورشید را زنده نگه می‌دارد.',
        promptDirectives:
          'Render into graceful, lyrical Persian prose with subtle classical literary elegance (نثر ادبی و شاعرانه). Favor evocative Persian roots, balanced rhythmic phrasing, and refined imagery while remaining completely lucid and understandable to modern readers. Maintain strict Persian ی/ک and half-space (نیم‌فاصله) orthography.',
      },
      {
        id: 'fa-dari',
        name: 'Dari (Afghanistan)',
        nativeName: 'دری افغانستان',
        region: 'Kabul & Herat, Afghanistan',
        summary: 'Authentic Afghan Persian vocabulary, polite markers, and natural Kabul cadence.',
        exampleSource: 'Thank you so much for welcoming us to your home today.',
        exampleTarget: 'تشکر بسیار زیاد که امروز ما را به خانه‌تان خوش‌آمدید گفتید.',
        promptDirectives:
          'Write in natural, fluent Afghan Dari Persian (فارسی دری). Use authentic Dari lexical choices and phrasing where appropriate (e.g., تشکر، بسیار خوب، پوهنتون/دانشگاه، دفتر، موتر، رفیق، خوش‌آمدید) and clear standard Dari syntax, with proper Persian ی/ک and half-space orthography.',
      },
      {
        id: 'fa-tajik',
        name: 'Tajik Persian',
        nativeName: 'تاجیکی (فارسی)',
        region: 'Dushanbe, Tajikistan',
        summary: 'Tajik Persian phrasing rendered in clean Persian script with Central Asian nuance.',
        exampleSource: 'Our friendship has grown stronger with every passing season.',
        exampleTarget: 'دوستیِ ما با گذشتِ هر فصل استوارتر و صمیمی‌تر شده است.',
        promptDirectives:
          'Write in fluent Tajik Persian presented in clear Persian script (خط فارسی) reflecting authentic Tajik idioms, expressions, and courteous Central Asian phrasing (e.g., رحمت، بفرمایید، مهربان، استوار). Maintain clean Persian orthography.',
      },
      {
        id: 'fa-shirazi',
        name: 'Shirazi Warmth',
        nativeName: 'شیرازی محاوره‌ای',
        region: 'Shiraz, Fars',
        summary: 'Gentle, hospitable southern Iranian warmth with light melodic Shirazi flavor.',
        exampleSource: 'Slow down a little—there is always time for tea and good conversation.',
        exampleTarget: 'یه کم آروم‌تر کاکو؛ همیشه واسه یه چایی و گپِ خوب وقت هست.',
        promptDirectives:
          'Write in warm, hospitable conversational Persian with a tasteful, authentic Shirazi flavor (لهجه و حال‌وهوای شیرین شیرازی) without becoming unreadable caricature. Keep it genuinely charming, natural, and idiomatic with proper Persian script and half-spaces.',
      },
    ],
  },
  {
    id: 'ar',
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    scriptFamily: 'arabic',
    needsTransliteration: true,
    defaultDialectId: 'ar-msa',
    dialects: [
      {
        id: 'ar-msa',
        name: 'Modern Standard',
        nativeName: 'العربية الفصحى',
        region: 'Pan-Arab Standard',
        summary: 'Eloquent, broadcast-ready Modern Standard Arabic understood across the Arab world.',
        exampleSource: 'Clear communication builds lasting trust between teams.',
        exampleTarget: 'التواصل الواضح يبني ثقةً راسخةً بين فِرَق العمل.',
        promptDirectives:
          'Write in eloquent, crisp Modern Standard Arabic (الفصحى المعاصرة). Avoid literal English phrasing; use natural Arabic verbal sentence structures and precise diction.',
      },
      {
        id: 'ar-levantine',
        name: 'Levantine',
        nativeName: 'الشامية',
        region: 'Beirut, Damascus, Amman',
        summary: 'Warm, natural everyday Levantine Arabic.',
        exampleSource: 'Let us catch up over coffee whenever you are free this week.',
        exampleTarget: 'خلينا نلتقي على فنجان قهوة إيمتى ما كنت فاضي هالأسبوع.',
        promptDirectives:
          'Write in natural, authentic Levantine Arabic (اللهجة الشامية) using genuine spoken expressions and warm rhythm.',
      },
      {
        id: 'ar-egyptian',
        name: 'Egyptian',
        nativeName: 'المصرية',
        region: 'Cairo & Alexandria',
        summary: 'Expressive, widely understood Cairo colloquial Arabic.',
        exampleSource: 'Do not worry about it—we will figure it out together.',
        exampleTarget: 'ما تقلقش خالص، هنلاقي لها حل سوا.',
        promptDirectives:
          'Write in natural, expressive Egyptian Arabic (العامية المصرية) with authentic Cairo idiom and phrasing.',
      },
      {
        id: 'ar-gulf',
        name: 'Gulf (Khaleeji)',
        nativeName: 'الخليجية',
        region: 'Arabian Gulf',
        summary: 'Courteous, natural Khaleeji colloquial phrasing.',
        exampleSource: 'You are always welcome here whenever you visit.',
        exampleTarget: 'يا هلا ومرحبا فيك، المكان مكانك بأي وقت تزورنا.',
        promptDirectives:
          'Write in courteous, authentic Gulf Arabic (اللهجة الخليجية) with genuine regional phrasing.',
      },
    ],
  },
  {
    id: 'fr',
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'fr-metropolitan',
    dialects: [
      {
        id: 'fr-metropolitan',
        name: 'Metropolitan',
        nativeName: 'Français de France',
        region: 'Paris & France',
        summary: 'Crisp, idiomatic contemporary European French.',
        exampleSource: 'Small details quietly shape how people remember an experience.',
        exampleTarget: 'Les petits détails façonnent discrètement le souvenir que l’on garde d’une expérience.',
        promptDirectives:
          'Write in refined, natural contemporary Metropolitan French with idiomatic syntax and proper French typography (guillemets and apostrophes).',
      },
      {
        id: 'fr-quebecois',
        name: 'Québécois',
        nativeName: 'Français québécois',
        region: 'Québec, Canada',
        summary: 'Authentic, warm Canadian French phrasing and vocabulary.',
        exampleSource: 'I will send you the updated schedule right after lunch.',
        exampleTarget: 'Je t’envoie l’horaire mis à jour tout de suite après le dîner.',
        promptDirectives:
          'Write in natural, authentic Québec French (français québécois standard/courant) using genuine Canadian French vocabulary (e.g., dîner for lunch, fin de semaine, courriel) without exaggerated slang.',
      },
    ],
  },
  {
    id: 'es',
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'es-mx',
    dialects: [
      {
        id: 'es-mx',
        name: 'Mexican',
        nativeName: 'Español de México',
        region: 'Mexico',
        summary: 'Warm, fluid Latin American Spanish with natural Mexican phrasing.',
        exampleSource: 'Take your time—getting it right matters more than rushing.',
        exampleTarget: 'Tómate tu tiempo; hacerlo bien importa mucho más que correr.',
        promptDirectives:
          'Write in natural, fluid Mexican Spanish using authentic Latin American vocabulary and natural phrasing.',
      },
      {
        id: 'es-es',
        name: 'Castilian',
        nativeName: 'Español de España',
        region: 'Spain',
        summary: 'Crisp Peninsular Spanish with natural European idioms.',
        exampleSource: 'Let us review the draft together before sending it out.',
        exampleTarget: 'Repasemos el borrador juntos antes de enviarlo.',
        promptDirectives:
          'Write in crisp, idiomatic Castilian (Peninsular) Spanish using natural Spain vocabulary and vosotros where plural informal fits.',
      },
      {
        id: 'es-ar',
        name: 'Rioplatense',
        nativeName: 'Rioplatense',
        region: 'Argentina & Uruguay',
        summary: 'Expressive Buenos Aires Spanish with authentic voseo.',
        exampleSource: 'Tell me what you think whenever you get a moment.',
        exampleTarget: 'Contame qué te parece cuando tengas un ratito.',
        promptDirectives:
          'Write in authentic Rioplatense Spanish using natural voseo conjugations (vos tenés, contame, decime) and warm Argentine cadence.',
      },
    ],
  },
  {
    id: 'de',
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'de-standard',
    dialects: [
      {
        id: 'de-standard',
        name: 'High German',
        nativeName: 'Hochdeutsch',
        region: 'Germany',
        summary: 'Clear, precise contemporary Standard German.',
        exampleSource: 'Good design makes complex tools feel effortless.',
        exampleTarget: 'Gutes Design lässt komplexe Werkzeuge mühelos wirken.',
        promptDirectives:
          'Write in crisp, natural contemporary Standard German (Hochdeutsch) with clean clause structure and authentic compound phrasing.',
      },
      {
        id: 'de-austrian',
        name: 'Austrian',
        nativeName: 'Österreichisches Deutsch',
        region: 'Vienna & Austria',
        summary: 'Warm Austrian Standard German with regional elegance.',
        exampleSource: 'Shall we go over the notes tomorrow morning?',
        exampleTarget: 'Schauen wir uns die Notizen morgen in der Früh gemeinsam an?',
        promptDirectives:
          'Write in natural Austrian Standard German (Österreichisches Deutsch) incorporating tasteful Austrian lexical nuances where fitting.',
      },
    ],
  },
  {
    id: 'tr',
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'tr-istanbul',
    dialects: [
      {
        id: 'tr-istanbul',
        name: 'Istanbul Standard',
        nativeName: 'İstanbul Türkçesi',
        region: 'Istanbul, Turkey',
        summary: 'Fluent, natural modern Turkish with smooth agglutinative rhythm.',
        exampleSource: 'Every language carries its own way of seeing the world.',
        exampleTarget: 'Her dil, dünyaya bakmanın kendine özgü bir yolunu taşır.',
        promptDirectives:
          'Write in natural, idiomatic Istanbul Standard Turkish with proper Turkish word order and smooth, native-sounding suffixes.',
      },
      {
        id: 'tr-conversational',
        name: 'Everyday Colloquial',
        nativeName: 'Günlük Konuşma',
        region: 'Contemporary Turkey',
        summary: 'Warm, relaxed everyday spoken Turkish.',
        exampleSource: 'Let me know once you arrive safely.',
        exampleTarget: 'Sağ salim vardığında bana haber ver, olur mu?',
        promptDirectives:
          'Write in warm, natural everyday spoken Turkish using authentic colloquial warmth.',
      },
    ],
  },
  {
    id: 'ja',
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    dir: 'ltr',
    scriptFamily: 'cjk',
    needsTransliteration: true,
    defaultDialectId: 'ja-polite',
    dialects: [
      {
        id: 'ja-polite',
        name: 'Polite (Desu/Masu)',
        nativeName: '丁寧語',
        region: 'Standard Japan',
        summary: 'Clear, courteous everyday standard Japanese.',
        exampleSource: 'Thank you for taking the time to read this carefully.',
        exampleTarget: 'お時間を割いて丁寧にお読みいただき、ありがとうございます。',
        promptDirectives:
          'Write in natural, polite Japanese (丁寧語 / です・ます調) with authentic phrasing and appropriate cultural politeness.',
      },
      {
        id: 'ja-casual',
        name: 'Casual (Plain)',
        nativeName: 'タメ口',
        region: 'Everyday Conversational',
        summary: 'Relaxed, friendly plain-form Japanese.',
        exampleSource: 'That sunset looks incredible tonight.',
        exampleTarget: '今夜の夕焼け、すごくきれいだね。',
        promptDirectives:
          'Write in natural, warm casual Japanese (普通形・タメ口) as used between close friends.',
      },
      {
        id: 'ja-keigo',
        name: 'Formal Keigo',
        nativeName: '敬語・ビジネス',
        region: 'Executive & Formal',
        summary: 'Refined honorific Japanese for formal correspondence.',
        exampleSource: 'We look forward to collaborating with your team.',
        exampleTarget: '貴社の皆様とご一緒できますことを、心より楽しみにしております。',
        promptDirectives:
          'Write in impeccable formal honorific Japanese (敬語・ビジネス日本語) suitable for senior clients or formal letters.',
      },
    ],
  },
  {
    id: 'zh',
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    dir: 'ltr',
    scriptFamily: 'cjk',
    needsTransliteration: true,
    defaultDialectId: 'zh-cn',
    dialects: [
      {
        id: 'zh-cn',
        name: 'Simplified Mandarin',
        nativeName: '简体中文',
        region: 'Mainland China',
        summary: 'Fluid contemporary Mainland Mandarin in Simplified characters.',
        exampleSource: 'Patience turns small daily efforts into lasting craft.',
        exampleTarget: '耐心会把日复一日的微小努力，打磨成历久弥新的匠艺。',
        promptDirectives:
          'Write in natural, idiomatic Simplified Mandarin Chinese (简体中文) avoiding stiff English translation syntax.',
      },
      {
        id: 'zh-tw',
        name: 'Traditional (Taiwan)',
        nativeName: '繁體中文（臺灣）',
        region: 'Taiwan',
        summary: 'Natural Taiwanese Mandarin in Traditional characters and local phrasing.',
        exampleSource: 'This workspace feels calm and easy to focus in.',
        exampleTarget: '這個工作空間讓人覺得很平靜，也很容易專心。',
        promptDirectives:
          'Write in authentic Traditional Mandarin Chinese using natural Taiwanese vocabulary and phrasing (臺灣用語).',
      },
      {
        id: 'zh-yue',
        name: 'Cantonese',
        nativeName: '粵語（廣東話）',
        region: 'Hong Kong & Guangdong',
        summary: 'Natural written Cantonese with authentic Hong Kong nuance.',
        exampleSource: 'Do not rush—let us grab dim sum first.',
        exampleTarget: '唔使急，我哋去飲個茶先啦。',
        promptDirectives:
          'Write in authentic, natural Hong Kong Cantonese (粵語口語/白話) using genuine Cantonese characters and particles.',
      },
    ],
  },
  {
    id: 'it',
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'it-standard',
    dialects: [
      {
        id: 'it-standard',
        name: 'Standard Italian',
        nativeName: 'Italiano standard',
        region: 'Italy',
        summary: 'Melodic, expressive contemporary Italian.',
        exampleSource: 'Simplicity is often the hardest thing to achieve.',
        exampleTarget: 'La semplicità è spesso la cosa più difficile da raggiungere.',
        promptDirectives:
          'Write in graceful, natural contemporary Italian with authentic rhythm and idioms.',
      },
      {
        id: 'it-literary',
        name: 'Editorial & Literary',
        nativeName: 'Italiano letterario',
        region: 'Publishing & Culture',
        summary: 'Polished editorial Italian with refined cadence.',
        exampleSource: 'Architecture is frozen music shaped by light.',
        exampleTarget: 'L’architettura è musica sospesa nel tempo, scolpita dalla luce.',
        promptDirectives:
          'Write in refined editorial and literary Italian with rich precision and elegance.',
      },
    ],
  },
  {
    id: 'pt',
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    dir: 'ltr',
    scriptFamily: 'latin',
    needsTransliteration: false,
    defaultDialectId: 'pt-br',
    dialects: [
      {
        id: 'pt-br',
        name: 'Brazilian',
        nativeName: 'Português do Brasil',
        region: 'Brazil',
        summary: 'Warm, fluid Brazilian Portuguese.',
        exampleSource: 'It was wonderful catching up with you after so long.',
        exampleTarget: 'Foi maravilhoso colocar o papo em dia com você depois de tanto tempo.',
        promptDirectives:
          'Write in warm, natural Brazilian Portuguese using authentic Brazilian grammar, pronouns, and idioms.',
      },
      {
        id: 'pt-pt',
        name: 'European',
        nativeName: 'Português Europeu',
        region: 'Portugal',
        summary: 'Crisp, authentic Lisbon European Portuguese.',
        exampleSource: 'Please let me know if you need any further details.',
        exampleTarget: 'Por favor, diga-me se precisar de mais algum esclarecimento.',
        promptDirectives:
          'Write in authentic European Portuguese (Portugal) using European pronoun placement and lexical conventions.',
      },
    ],
  },
  {
    id: 'ko',
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    dir: 'ltr',
    scriptFamily: 'cjk',
    needsTransliteration: true,
    defaultDialectId: 'ko-polite',
    dialects: [
      {
        id: 'ko-polite',
        name: 'Polite (Haeyoche)',
        nativeName: '해요체',
        region: 'Standard Korea',
        summary: 'Warm, natural everyday polite Korean.',
        exampleSource: 'Even small changes can make a meaningful difference.',
        exampleTarget: '작은 변화라도 의미 있는 차이를 만들어 낼 수 있어요.',
        promptDirectives:
          'Write in natural, polite Korean (해요체) with fluid native phrasing.',
      },
      {
        id: 'ko-formal',
        name: 'Formal (Hapsyoche)',
        nativeName: '합쇼체',
        region: 'Business & Broadcast',
        summary: 'Crisp formal Korean for presentations and business.',
        exampleSource: 'We appreciate your continued trust and partnership.',
        exampleTarget: '변함없는 신뢰와 파트너십에 깊이 감사드립니다.',
        promptDirectives:
          'Write in formal Korean (합쇼체) suited for executive communication and formal announcements.',
      },
    ],
  },
  {
    id: 'ru',
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    dir: 'ltr',
    scriptFamily: 'cyrillic',
    needsTransliteration: true,
    defaultDialectId: 'ru-standard',
    dialects: [
      {
        id: 'ru-standard',
        name: 'Standard Literary',
        nativeName: 'Литературный русский',
        region: 'Standard Russian',
        summary: 'Expressive, grammatically rich standard Russian.',
        exampleSource: 'Quiet focus often accomplishes more than frantic effort.',
        exampleTarget: 'Спокойная сосредоточенность часто приносит больше плодов, чем суетливые усилия.',
        promptDirectives:
          'Write in fluent, natural standard Russian with authentic aspectual verb choices and natural word order.',
      },
      {
        id: 'ru-conversational',
        name: 'Conversational',
        nativeName: 'Разговорный',
        region: 'Everyday Spoken',
        summary: 'Warm, idiomatic everyday spoken Russian.',
        exampleSource: 'No rush at all—just drop me a line when you are ready.',
        exampleTarget: 'Никакой спешки — просто напиши, как будешь готов.',
        promptDirectives:
          'Write in natural, relaxed conversational Russian as spoken between peers.',
      },
    ],
  },
];

export const SAMPLE_PHRASES: SamplePhrase[] = [
  {
    id: 'sample-conversation',
    category: 'Everyday',
    title: 'Warm catch-up',
    text: "It's been ages since we last sat down for tea. Whenever you have a quiet evening this week, let's catch up properly—I have so much to tell you.",
    recommendedLangId: 'fa',
    recommendedDialectId: 'fa-tehrani',
    recommendedTone: 'casual',
  },
  {
    id: 'sample-editorial',
    category: 'Editorial',
    title: 'Craft & clarity',
    text: 'True elegance in design rarely announces itself loudly. It lives in thoughtful spacing, honest materials, and the quiet ease with which people accomplish what matters.',
    recommendedLangId: 'fa',
    recommendedDialectId: 'fa-literary',
    recommendedTone: 'formal',
  },
  {
    id: 'sample-poetic',
    category: 'Poetic',
    title: 'Autumn twilight',
    text: 'As the autumn breeze brushed through the courtyard pomegranates, the twilight lingered like an unfinished verse written in amber and shadow.',
    recommendedLangId: 'fa',
    recommendedDialectId: 'fa-poetic',
    recommendedTone: 'literary',
  },
  {
    id: 'sample-idiom',
    category: 'Idiomatic',
    title: 'Silver lining',
    text: 'Missing that train turned out to be a blessing in disguise—otherwise we would never have stumbled upon that little bookshop by the river.',
    recommendedLangId: 'fa',
    recommendedDialectId: 'fa-tehrani',
    recommendedTone: 'natural',
  },
];

export const INITIAL_HISTORY: HistoryEntry[] = [
  {
    id: 'seed-1',
    sourceText: 'Home is not merely a place on a map, but the calm you feel when someone speaks your language with kindness.',
    translatedText: 'خانه تنها نقطه‌ای بر روی نقشه نیست، بلکه آرامشی است که وقتی کسی با مهربانی به زبان تو سخن می‌گوید، در دل می‌نشیند.',
    transliteration: 'Khāneh tanhā noqte-ī bar rū-ye naqsheh nīst, balkeh ārāmesh-ī ast keh vaqt-ī kasī bā mehrabānī beh zabān-e to sokhan mī-gūyad, dar del mī-neshīnad.',
    languageId: 'fa',
    dialectId: 'fa-literary',
    tone: 'literary',
    createdAt: Date.now() - 1000 * 60 * 42,
    starred: true,
  },
  {
    id: 'seed-2',
    sourceText: "Don't stress about tomorrow's presentation—you know this material inside out, and you're going to do great.",
    translatedText: 'اصلاً بابت ارائه فردا استرس نداشته باش؛ تو به کلِ این موضوع مسلطی و مطمئنم عالی از پسش برمیای.',
    transliteration: 'Aslan bābat-e erā’eh-ye fardā estres nadāshteh bāsh; to beh koll-e īn mowzū’ mosallatī va motma’ennam ālī az pasesh bar-miyāy.',
    languageId: 'fa',
    dialectId: 'fa-tehrani',
    tone: 'casual',
    createdAt: Date.now() - 1000 * 60 * 185,
    starred: false,
  },
  {
    id: 'seed-3',
    sourceText: 'Thank you for your thoughtful note. I have reviewed the draft and will share my comments by Thursday morning.',
    translatedText: 'بابت یادداشتِ دقیق و سنجیده‌تان سپاسگزارم. پیش‌نویس را بررسی کردم و دیدگاه‌هایم را تا صبح پنج‌شنبه با شما در میان خواهم گذاشت.',
    transliteration: 'Bābat-e yāddāsht-e daqīq va sanjīdeh-tān sepāsgozāram. Pīsh-nevīs rā barresī kardam va dīdgāh-hāyam rā tā sobh-e panj-shanbeh bā shomā dar miyān khāham gozāsht.',
    languageId: 'fa',
    dialectId: 'fa-literary',
    tone: 'formal',
    createdAt: Date.now() - 1000 * 60 * 60 * 14,
    starred: true,
  },
];

export const DEFAULT_COMPARE_TARGETS: Array<{ languageId: string; dialectId: string }> = [
  { languageId: 'fa', dialectId: 'fa-tehrani' },
  { languageId: 'fa', dialectId: 'fa-literary' },
  { languageId: 'fr', dialectId: 'fr-metropolitan' },
  { languageId: 'es', dialectId: 'es-mx' },
];
