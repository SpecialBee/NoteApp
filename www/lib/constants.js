// Static config data with no dependency on app state — safe to load before app.js.
// Pulled out of index.html as part of splitting the single-file app into pieces.

const ACCENT_PRESETS = ['#D97757','#4C7EFF','#6B8F52','#B3483A','#8E6CC7','#3AA6A6','#C79A3A','#565B66'];
const MARK_PRESETS = ['#FDE68A','#BBF7D0','#FBCFE8','#BFDBFE','#FED7AA','#E9D5FF'];
const FONT_OPTIONS = [
  { label: '기본 (Inter)', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: '시스템 UI', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
  { label: '맑은 고딕', value: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" },
  { label: '바탕 (명조체)', value: "'Batang', 'Apple SD Gothic Neo', Georgia, serif" },
  { label: '고정폭', value: "Consolas, Menlo, 'D2Coding', monospace" },
];
const FONT_SIZE_SCALES = { small: 0.85, normal: 1, large: 1.2 };

const CARD_COLORS = ['#FF6B6B','#FF9F45','#FFD166','#06D6A0','#4CC9F0','#7B2FBE','#F72585','#90E0EF','#B5E48C','#ADB5BD'];

const TAG_PALETTE = ['#D97757','#6B8F52','#4A7A9E','#B3483A','#8A6FB0','#C79A3A','#4A9490','#A65D8A'];

// fake-3D depth buckets for the global graph's depth-of-field effect
const DEPTH_BUCKETS = [
  { min:0.70, blurId:'',    scale:1.15, opacity:1    },
  { min:0.40, blurId:'gd1', scale:1.0,  opacity:0.82 },
  { min:0.15, blurId:'gd2', scale:0.85, opacity:0.6  },
  { min:0,    blurId:'gd3', scale:0.72, opacity:0.42 },
];

const PROP_TYPE_META = [
  { id:'text',     icon:'T',  label:'텍스트' },
  { id:'number',   icon:'#',  label:'숫자' },
  { id:'date',     icon:'📅', label:'날짜' },
  { id:'select',   icon:'◉',  label:'선택' },
  { id:'checkbox', icon:'☑',  label:'체크' },
  { id:'rollup',   icon:'Σ',  label:'롤업' },
];
const ROLLUP_AGG_LABEL = { sum:'합계', avg:'평균', count:'개수' };

const SEC_COLORS = ['#82C4F8','#85E09A','#FF9F9F','#FFE066','#C3B1E1','#FFB347'];

const TEV_TYPES = ['text','number','checkbox','date','select'];
const TEV_TYPE_LABELS = {text:'Aa', number:'12', checkbox:'☑', date:'📅', select:'▾'};

const CEV_CTX_COLORS = [null,'#FF9F9F','#FFE066','#85E09A','#82C4F8','#C3B1E1','#FFB347'];
const CEV_TEXT_COLORS = ['#3D3929','#DC2626','#2563EB','#16A34A','#CA8A04','#7C3AED','#ffffff'];
const CEV_CONN_COLORS = [null,'#DC2626','#2563EB','#16A34A','#CA8A04','#7C3AED'];
