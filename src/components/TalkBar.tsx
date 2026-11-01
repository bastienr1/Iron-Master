/**
 * The "Tell Claude what you ate or lifted" bar: a text field and a mic button.
 * Dictation uses the browser's Web Speech API when it exists; otherwise the
 * mic focuses the field so the phone keyboard's own dictation can take over.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

function speechCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function TalkBar({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = 'Bench 75 for 10, 6, 7, 8…',
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  busy?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canSpeak = speechCtor() !== null

  useEffect(() => () => recRef.current?.stop(), [])

  function toggleMic() {
    const Ctor = speechCtor()
    if (!Ctor) {
      inputRef.current?.focus()
      return
    }
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    const base = value
    rec.onresult = e => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      onChange(`${base}${base && !base.endsWith(' ') ? ' ' : ''}${text}`.trim())
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!busy && value.trim()) onSubmit()
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-ink pl-[18px] pr-2 py-2">
      <label htmlFor="say" className="sr-only">
        Message Claude
      </label>
      <input
        ref={inputRef}
        id="say"
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="send"
        className="flex-1 min-w-0 bg-transparent font-sans text-[15px] text-ground placeholder:text-[#4a5654] outline-none"
      />
      {value.trim() ? (
        <button type="submit" disabled={busy} aria-label="Send" className="w-11 h-11 rounded-full bg-plate-green grid place-items-center disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d1f15" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? 'Stop listening' : canSpeak ? 'Speak' : 'Type'}
          aria-pressed={listening}
          className={`w-11 h-11 rounded-full grid place-items-center ${listening ? 'bg-plate-red animate-pulse' : 'bg-plate-red'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      )}
    </form>
  )
}
