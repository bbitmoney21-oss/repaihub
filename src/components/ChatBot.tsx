import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// REPAIHUB help assistant — answers common questions from approved company facts only.
// Rule-based on purpose: no AI service, no running cost, and it can never invent an answer.
// Owner of the wording: Content Writer agent (repaihub-agent-team). Keep facts in sync with
// repaihub-agent-team/knowledge/company-facts.md and the landing page.

type Intent = { id: string; keys: RegExp[]; answer: string }

const FOUNDER_STORY =
  'REPAIHUB was founded by Venkateswarlu Bhagi, who lives in Oshawa, Ontario, Canada. ' +
  'He studied computer science (B.Sc., 2009) and went on to earn a Master of Computer Applications (MCA) from NIT Durgapur in 2012. ' +
  'He has spent more than 13 years in enterprise technology, leading SAP quality assurance and testing — 14 of those years with Tata Consultancy Services, ' +
  'serving large retail and insurance clients — and today he leads SAP testing on a major Canadian financial-services program. ' +
  'That career is about one thing: making sure complex financial systems work correctly before real people depend on them. ' +
  'REPAIHUB brings the same discipline to a problem many Indian-origin Canadians know well — getting their own money out of an NRO account and home to Canada, legally and without the paperwork maze.'

const INTENTS: Intent[] = [
  { id: 'founder', keys: [/founder|bhagi|venkat|ceo|who (started|built|runs|owns|is behind)|behind (repaihub|this)|owner|education|qualif|where (does|do) (he|bhagi|the founder) live|\bhe live|\bhis\b|degree|studied|background|experience|career|nit|mca/],
    answer: FOUNDER_STORY },
  { id: 'about', keys: [/what is repaihub|what does repaihub|about (you|repaihub|the company)|what do you do|who are you|tell me about/],
    answer: 'REPAIHUB Remittance Inc. is a Canadian company that helps Indian-origin Canadians move money from their Indian NRO account to their Canadian bank account. We handle the paperwork that usually makes this slow — Form 145 and Form 146 (formerly 15CA/15CB), certified by our partner Chartered Accountant — and the transfer itself is executed by a regulated Indian partner bank.' },
  { id: 'how', keys: [/how (does it|it) work|how do i (send|start|transfer|use)|process|steps|get started/],
    answer: 'Three steps: 1) Verify your identity online (Canada and India checks). 2) Tell us the amount and upload your documents — our partner CA prepares and certifies Form 145/146 and checks TDS. 3) The regulated Indian partner bank sends the money from your NRO account to your Canadian bank account. You see the full fee and the exchange rate before you confirm anything.' },
  { id: 'fees', keys: [/fee|price|pricing|cost|charge|how much|commission|cheap|expensive/],
    answer: 'Proposed beta fees are flat, per transfer: CAD $79 for up to ₹5 lakh, CAD $199 for ₹5–25 lakh (CA certificate included), and CAD $499 above ₹25 lakh (lump-sum concierge). Final pricing is confirmed before launch, and you always see the full fee and the rate before you confirm a transfer. Try the calculator on our home page.' },
  { id: 'security', keys: [/secur|privacy|my data|data|encrypt|pipeda|personal information|safe with/],
    answer: 'We follow Canada\'s PIPEDA privacy rules, encrypt your data, and verify identity with bank-grade checks. We never sell your data. Our Privacy Policy is at repaihub.com/privacy.' },
  { id: 'regulated', keys: [/fintrac|regulat|licen[cs]|legit|legal|safe|trust|scam|registered|msb/],
    answer: 'Yes. REPAIHUB Remittance Inc. is registered with FINTRAC (Canada) as a Money Services Business, registration number N300002485. Transfers out of India are executed by a regulated Indian partner bank under FEMA rules. The site is a beta preview: live transfers begin once our partner bank agreement is in place.' },
  { id: 'launch', keys: [/when.*(launch|live|start|available|open)|beta|launch|go live|can i send (now|today)|available now|waitlist/],
    answer: 'We are in beta preview. Live transfers start once our agreement with an Indian Authorised Dealer (AD Category-I) partner bank is signed — no money can legally leave India without one. Join the waitlist on our home page and we will email you the day we open.' },
  { id: 'time', keys: [/how long|how fast|days|time|quick|speed|express/],
    answer: 'Our target is 1–2 business days after your documents are accepted. Exact timing depends on your Indian bank and our partner bank. Today, doing this through a bank branch often takes 2–4 weeks.' },
  { id: 'limit', keys: [/limit|maximum|max|1 million|million|how much can i/],
    answer: 'Under FEMA, an NRI can repatriate up to USD 1 million per financial year (April–March) from NRO balances, after applicable taxes and with Form 145/146 where required. REPAIHUB tracks your usage and alerts you as you approach the limit. Larger amounts, like a property sale, can be planned across financial years.' },
  { id: 'forms', keys: [/15ca|15cb|form 145|form 146|145|146|\bca\b|chartered accountant|certif|paperwork|document/],
    answer: 'Since 1 April 2026, Form 145 replaced Form 15CA and Form 146 replaced Form 15CB. Form 146 is a certificate from a Chartered Accountant confirming tax on the money has been handled. Our partner CA team in India prepares and certifies these for you as part of the service. You will typically need your PAN, NRO account details, and proof of the source of funds (for example a sale deed or rent records).' },
  { id: 'tax', keys: [/tax|tds|dtaa|capital gain|cra|income tax/],
    answer: 'Tax on the money (TDS in India) must be settled before it can be repatriated — that is what the CA certificate (Form 146) confirms. Our partner CA checks this for each transfer. For your personal tax position in India or Canada, please speak to a qualified tax adviser; this assistant does not give tax advice.' },
  { id: 'branch', keys: [/branch|visit|travel|fly|in person|go to india/],
    answer: 'The service is designed so you do not need to visit a branch in India: identity verification, the compliance forms and the transfer request are done online. Some banks may still contact you to confirm a request.' },
  { id: 'nre', keys: [/\bnre\b|nro vs|difference between|what is nro|\bnro\b/],
    answer: 'An NRO (Non-Resident Ordinary) account holds money earned in India — rent, pension, dividends, property-sale proceeds. Moving NRO money abroad needs Form 145/146 and is capped at USD 1 million per financial year. NRE money is already freely repatriable. REPAIHUB focuses on NRO, the harder case.' },
  { id: 'property', keys: [/property|flat|house|sale|sell|land|real estate|apartment/],
    answer: 'Selling a property in India is one of the most common reasons to repatriate. Sale proceeds in your NRO account can be moved with REPAIHUB within the USD 1M per year limit. A broker-free property-sale service is planned for Phase 2 — register your interest at repaihub.com/property.' },
  { id: 'wise', keys: [/wise|remitly|xe|western union|bank instead|compar|competit|why (you|repaihub)|better/],
    answer: 'Most money-transfer apps only send money into India, or cannot move NRO funds out. Indian banks can, but usually need branch visits and take weeks. REPAIHUB combines the compliance paperwork (CA-certified Form 145/146) with the transfer in one online flow, and shows the full fee and rate upfront.' },
  { id: 'reverse', keys: [/canada to india|send to india|send money to india|inward|other direction/],
    answer: 'Our first service is India → Canada: bringing NRO money home. Sending money from Canada to India is planned as a second service after launch.' },
  { id: 'where', keys: [/\busa\b|united states|america|\buk\b|australia|which countr|outside canada/],
    answer: 'REPAIHUB serves residents of Canada at launch, receiving into Canadian bank accounts. Other countries may follow later.' },
  { id: 'account', keys: [/sign ?up|register|create (an )?account|log ?in|password|forgot/],
    answer: 'You can create a beta account at repaihub.com/signup and explore the app. If you forget your password, use "Forgot password" on the login page. Live transfers open after launch.' },
  { id: 'contact', keys: [/contact|email|phone|call|talk to|human|support|help me|reach/],
    answer: 'You can reach the founder directly at founder@repaihub.com. We reply within one business day.' },
  { id: 'hello', keys: [/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/],
    answer: 'Hello! I can answer questions about REPAIHUB — how it works, fees, regulation, limits, the paperwork, and our founder. What would you like to know?' },
  { id: 'thanks', keys: [/thank|thanks|great|perfect|ok(ay)?$/],
    answer: 'You\'re welcome. If anything else comes up, ask here or email founder@repaihub.com.' },
]

const FALLBACK = 'I don\'t have an approved answer for that yet. Please email founder@repaihub.com and you\'ll get a reply within one business day.'

export function answerFor(raw: string): string {
  const q = ' ' + raw.toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  let best: Intent | null = null
  let bestScore = 0
  for (const it of INTENTS) {
    let score = 0
    for (const k of it.keys) { const m = q.trim().match(new RegExp(k.source, 'g')); if (m) score += m.length }
    if (score > bestScore) { best = it; bestScore = score }
  }
  return best ? best.answer : FALLBACK
}

const SUGGESTED = ['How does it work?', 'What are the fees?', 'Is REPAIHUB regulated?', 'Who is the founder?']
const C = { navy: '#0B1C2C', card: '#132233', gold: '#C9963A', goldLight: '#E8B86D', cream: '#FAF6F0', slate: '#8BA0B4', line: 'rgba(201,150,58,0.25)' }

type Msg = { from: 'bot' | 'you'; text: string }

export default function ChatBot() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'Hi, I\'m the REPAIHUB assistant. Ask me about moving money from your NRO account to Canada, our fees, regulation, or our founder.' }])
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'start' }) }, [msgs, open])

  // Public pages only — keep it out of the signed-in app and the CA portal.
  if (pathname.startsWith('/app') || pathname.startsWith('/ca') || pathname.startsWith('/onboarding')) return null

  const ask = (text: string) => {
    const t = text.trim()
    if (!t) return
    setMsgs(m => [...m, { from: 'you', text: t }, { from: 'bot', text: answerFor(t) }])
    setInput('')
  }

  return (
    <>
      {open && (
        <div role="dialog" aria-label="REPAIHUB assistant" style={{ position: 'fixed', right: 16, bottom: 84, width: 'min(370px, calc(100vw - 32px))', maxHeight: 'min(560px, calc(100vh - 120px))', display: 'flex', flexDirection: 'column', background: C.navy, border: `1px solid ${C.line}`, boxShadow: '0 12px 40px rgba(0,0,0,0.45)', zIndex: 1000, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', borderBottom: `1px solid ${C.line}`, background: C.card }}>
            <span style={{ color: C.goldLight, fontWeight: 600, letterSpacing: '0.05em' }}>REPAIHUB Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" style={{ background: 'none', border: 'none', color: C.slate, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'grid', gap: '0.6rem', alignContent: 'start' }}>
            {msgs.map((m, i) => (
              <div key={i} ref={i === msgs.length - 1 ? end : undefined} data-from={m.from} style={{ justifySelf: m.from === 'you' ? 'end' : 'start', maxWidth: '88%', background: m.from === 'you' ? C.gold : C.card, color: m.from === 'you' ? C.navy : C.cream, padding: '0.6rem 0.8rem', fontSize: '0.88rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
            ))}
            {msgs.length <= 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {SUGGESTED.map(s => (
                  <button key={s} onClick={() => ask(s)} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.goldLight, padding: '0.35rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={e => { e.preventDefault(); ask(input) }} style={{ display: 'flex', borderTop: `1px solid ${C.line}` }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question…" aria-label="Your question" maxLength={300} style={{ flex: 1, minWidth: 0, background: '#1C3147', border: 'none', color: '#FFF', padding: '0.85rem', fontSize: '16px', outline: 'none' }} />
            <button type="submit" style={{ background: C.gold, color: C.navy, border: 'none', padding: '0 1rem', fontWeight: 700, cursor: 'pointer' }}>Send</button>
          </form>
          <p style={{ margin: 0, padding: '0.4rem 0.9rem 0.6rem', fontSize: '0.68rem', color: C.slate }}>Automated answers from REPAIHUB's published information. Not financial, legal or tax advice.</p>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Close assistant' : 'Ask REPAIHUB a question'} style={{ position: 'fixed', right: 16, bottom: 16, width: 56, height: 56, borderRadius: '50%', background: C.gold, color: C.navy, border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', cursor: 'pointer', zIndex: 1000, fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {open ? '×' : '?'}
      </button>
    </>
  )
}
