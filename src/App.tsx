import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWorker, OEM, type Worker } from 'tesseract.js'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  Download,
  FileImage,
  FileText,
  Image as ImageIcon,
  Languages,
  LockKeyhole,
  Menu,
  MousePointer2,
  RotateCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'

type AppStatus = 'idle' | 'ready' | 'processing' | 'done' | 'error'

type HistoryItem = {
  id: string
  name: string
  text: string
  date: string
  language: string
  confidence: number
}

const LANGUAGES = [
  { code: 'fra', name: 'Français', short: 'FR' },
  { code: 'eng', name: 'Anglais', short: 'EN' },
  { code: 'spa', name: 'Espagnol', short: 'ES' },
  { code: 'deu', name: 'Allemand', short: 'DE' },
  { code: 'ita', name: 'Italien', short: 'IT' },
  { code: 'por', name: 'Portugais', short: 'PT' },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}

function languageName(code: string) {
  return LANGUAGES.find((language) => language.code === code)?.name ?? code
}

function cleanOcrText(text: string) {
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

async function rotateImage(file: File, degrees: number): Promise<Blob | File> {
  if (degrees % 360 === 0) return file

  const bitmap = await createImageBitmap(file)
  const radians = (degrees * Math.PI) / 180
  const swapSides = Math.abs(degrees % 180) === 90
  const canvas = document.createElement('canvas')
  canvas.width = swapSides ? bitmap.height : bitmap.width
  canvas.height = swapSides ? bitmap.width : bitmap.height
  const context = canvas.getContext('2d')

  if (!context) throw new Error("Impossible de préparer l'image.")

  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(radians)
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de préparer l'image."))),
      'image/png',
      1,
    )
  })
}

function createDemoImage(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 920
  const context = canvas.getContext('2d')

  if (!context) return Promise.reject(new Error("L'exemple n'a pas pu être créé."))

  context.fillStyle = '#f7f1e7'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#6f4b37'
  context.fillRect(78, 72, 8, 776)

  context.fillStyle = '#201f1d'
  context.font = '700 58px Arial, sans-serif'
  context.fillText('LE CAFÉ DES IDÉES', 140, 170)
  context.fillStyle = '#d65f45'
  context.font = '600 24px Arial, sans-serif'
  context.fillText('ATELIER CRÉATIF · PARIS', 143, 220)

  context.strokeStyle = '#cfc4b4'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(140, 265)
  context.lineTo(1250, 265)
  context.stroke()

  context.fillStyle = '#292725'
  context.font = '36px Arial, sans-serif'
  const lines = [
    'Les meilleures idées commencent souvent',
    'par une simple conversation.',
    '',
    'Imaginez. Échangez. Créez.',
    '',
    'Rendez-vous jeudi 24 septembre à 18h30',
    '12, rue des Fleurs — 75003 Paris',
  ]
  let y = 350
  lines.forEach((line) => {
    context.fillText(line, 143, y)
    y += 70
  })

  context.fillStyle = '#ece0d0'
  context.fillRect(140, 790, 1110, 2)
  context.fillStyle = '#725f51'
  context.font = '24px Arial, sans-serif'
  context.fillText('ENTRÉE LIBRE · clairtext.app/exemple', 143, 834)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("L'exemple n'a pas pu être créé."))
      resolve(new File([blob], 'affiche-cafe-des-idees.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [language, setLanguage] = useState('fra')
  const [status, setStatus] = useState<AppStatus>('idle')
  const [result, setResult] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Préparation de votre image…')
  const [rotation, setRotation] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('clairtext-history') ?? '[]') as HistoryItem[]
    } catch {
      return []
    }
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem('clairtext-history', JSON.stringify(history.slice(0, 4)))
    } catch {
      // L'application reste utilisable lorsque le stockage local est désactivé ou saturé.
    }
  }, [history])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      void workerRef.current?.terminate()
    }
  }, [previewUrl])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const showToast = (message: string) => setToast(message)

  const selectFile = useCallback((newFile: File) => {
    setError('')

    if (!ACCEPTED_TYPES.includes(newFile.type)) {
      setError('Format non pris en charge. Choisissez une image JPG, PNG, WebP ou BMP.')
      setStatus('error')
      return
    }

    if (newFile.size > MAX_FILE_SIZE) {
      setError("L'image dépasse la taille maximale de 10 Mo.")
      setStatus('error')
      return
    }

    setPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      return URL.createObjectURL(newFile)
    })
    setFile(newFile)
    setResult('')
    setConfidence(0)
    setRotation(0)
    setProgress(0)
    setStatus('ready')
  }, [])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) return

      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith('image/'),
      )
      const pastedFile = imageItem?.getAsFile()
      if (pastedFile) {
        event.preventDefault()
        selectFile(new File([pastedFile], 'image-collee.png', { type: pastedFile.type }))
        showToast('Image collée avec succès')
        document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [selectFile])

  const clearFile = () => {
    if (status === 'processing') return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setFile(null)
    setResult('')
    setConfidence(0)
    setRotation(0)
    setProgress(0)
    setError('')
    setStatus('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDemo = async () => {
    try {
      selectFile(await createDemoImage())
      showToast("L'image d'exemple est prête")
    } catch {
      setError("Impossible de générer l'image d'exemple.")
      setStatus('error')
    }
  }

  const updateOcrProgress = (message: { status: string; progress: number }) => {
    const labels: Record<string, string> = {
      'loading tesseract core': 'Chargement du moteur OCR…',
      'initializing tesseract': 'Initialisation du moteur…',
      'loading language traineddata': `Chargement du modèle ${languageName(language)}…`,
      'initializing api': "Analyse de l'image…",
      'recognizing text': 'Lecture du texte en cours…',
    }
    const ranges: Record<string, [number, number]> = {
      'loading tesseract core': [3, 18],
      'initializing tesseract': [18, 30],
      'loading language traineddata': [30, 52],
      'initializing api': [52, 61],
      'recognizing text': [61, 99],
    }
    const range = ranges[message.status] ?? [0, 99]
    const value = range[0] + (range[1] - range[0]) * (message.progress ?? 0)
    setProgress(Math.round(value))
    if (labels[message.status]) setProgressLabel(labels[message.status])
  }

  const extractText = async () => {
    if (!file || status === 'processing') return

    setStatus('processing')
    setError('')
    setResult('')
    setProgress(2)
    setProgressLabel('Préparation de votre image…')
    cancelledRef.current = false

    try {
      const worker = await createWorker(language, OEM.LSTM_ONLY, {
        logger: updateOcrProgress,
      })
      workerRef.current = worker

      if (cancelledRef.current) {
        await worker.terminate()
        return
      }

      const imageToRead = await rotateImage(file, rotation)
      const response = await worker.recognize(imageToRead)
      const extractedText = cleanOcrText(response.data.text)
      const measuredConfidence = Math.round(response.data.confidence)

      if (cancelledRef.current) return
      if (!extractedText) {
        setError("Aucun texte n’a été détecté. Essayez une image plus nette, mieux cadrée ou dans la bonne langue.")
        setStatus('error')
        setProgress(0)
        return
      }

      setResult(extractedText)
      setConfidence(measuredConfidence)
      setProgress(100)
      setStatus('done')

      const item: HistoryItem = {
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        text: extractedText,
        date: new Date().toISOString(),
        language,
        confidence: measuredConfidence,
      }
      setHistory((current) => [item, ...current.filter((oldItem) => oldItem.name !== file.name)].slice(0, 4))
    } catch (caughtError) {
      if (!cancelledRef.current) {
        console.error(caughtError)
        setError(
          "L'analyse n'a pas abouti. Vérifiez votre connexion lors de la première utilisation, puis réessayez.",
        )
        setStatus('error')
      }
    } finally {
      if (workerRef.current) {
        await workerRef.current.terminate().catch(() => undefined)
        workerRef.current = null
      }
    }
  }

  const cancelExtraction = async () => {
    cancelledRef.current = true
    await workerRef.current?.terminate().catch(() => undefined)
    workerRef.current = null
    setStatus('ready')
    setProgress(0)
    setError('')
  }

  const copyText = async (text = result) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      showToast('Texte copié dans le presse-papiers')
    } catch {
      showToast('La copie automatique est indisponible')
    }
  }

  const downloadText = () => {
    if (!result) return
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const baseName = file?.name.replace(/\.[^/.]+$/, '') ?? 'clairtext'
    anchor.href = url
    anchor.download = `${baseName}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Fichier .txt téléchargé')
  }

  const openHistoryItem = (item: HistoryItem) => {
    if (status === 'processing') return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setFile(null)
    setResult(item.text)
    setConfidence(item.confidence)
    setLanguage(item.language)
    setStatus('done')
    document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const deleteHistoryItem = (id: string) => {
    setHistory((current) => current.filter((item) => item.id !== id))
    showToast("Document supprimé de l'historique")
  }

  const wordCount = useMemo(() => (result.trim() ? result.trim().split(/\s+/).length : 0), [result])
  const characterCount = result.length
  const selectedLanguage = LANGUAGES.find((item) => item.code === language)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Clairtext, accueil">
          <span className="brand-mark"><ScanText size={22} strokeWidth={2.4} /></span>
          <span>clairtext<span className="brand-dot">.</span></span>
        </a>

        <nav className={mobileMenuOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Navigation principale">
          <a href="#studio" onClick={() => setMobileMenuOpen(false)}>Convertir</a>
          <a href="#fonctionnalites" onClick={() => setMobileMenuOpen(false)}>Fonctionnalités</a>
          <a href="#confidentialite" onClick={() => setMobileMenuOpen(false)}>Confidentialité</a>
        </nav>

        <div className="header-actions">
          <span className="header-free"><span /> Gratuit, sans compte</span>
          <button
            className="header-cta"
            onClick={() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Commencer <ArrowRight size={16} />
          </button>
          <button
            className="menu-button"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero section-width">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="eyebrow"><Sparkles size={14} /> OCR intelligent, sans friction</div>
          <h1>
            L’image devient texte.<br />
            <span>Comme par magie.</span>
          </h1>
          <p className="hero-copy">
            Transformez vos photos, captures d’écran et documents scannés en texte éditable en quelques secondes.
          </p>
          <div className="hero-reassurance">
            <span><Check size={15} /> 100 % gratuit</span>
            <span><Check size={15} /> Aucune inscription</span>
            <span><LockKeyhole size={14} /> Vos images restent privées</span>
          </div>
          <button
            className="hero-down"
            aria-label="Aller au convertisseur"
            onClick={() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>Essayer maintenant</span>
            <span className="hero-down-icon">↓</span>
          </button>
        </section>

        <section className="studio-section section-width" id="studio">
          <div className="studio-card">
            <div className="studio-topbar">
              <div>
                <span className="step-number">01</span>
                <div>
                  <p className="micro-label">NOUVELLE CONVERSION</p>
                  <h2>Extrayez votre texte</h2>
                </div>
              </div>
              <div className="privacy-status"><ShieldCheck size={16} /> Traitement local et privé</div>
            </div>

            <div className="workspace-grid">
              <section className="image-workspace" aria-label="Import de l'image">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">IMAGE SOURCE</span>
                    <h3>{file ? file.name : "Choisissez votre image"}</h3>
                  </div>
                  {file && status !== 'processing' && (
                    <button className="icon-button danger-hover" onClick={clearFile} aria-label="Supprimer l'image">
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>

                {!file ? (
                  <div
                    className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      event.preventDefault()
                      if (event.currentTarget === event.target) setDragActive(false)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      setDragActive(false)
                      const droppedFile = event.dataTransfer.files[0]
                      if (droppedFile) selectFile(droppedFile)
                    }}
                  >
                    <div className="upload-illustration">
                      <span className="upload-sheet sheet-back" />
                      <span className="upload-sheet sheet-front"><ImageIcon size={30} /></span>
                      <span className="upload-spark spark-one">✦</span>
                      <span className="upload-spark spark-two">✦</span>
                    </div>
                    <h3>Glissez votre image ici</h3>
                    <p>ou sélectionnez-la depuis votre appareil</p>
                    <button className="primary-button upload-button" onClick={() => inputRef.current?.click()}>
                      <UploadCloud size={18} /> Choisir une image
                    </button>
                    <button className="demo-link" onClick={handleDemo}>
                      <WandSparkles size={14} /> Essayer avec notre exemple
                    </button>
                    <div className="file-requirements">
                      <span>JPG</span><span>PNG</span><span>WEBP</span><span>jusqu’à 10 Mo</span>
                    </div>
                  </div>
                ) : (
                  <div className="preview-area">
                    <div className="preview-canvas">
                      <img
                        src={previewUrl}
                        alt="Aperçu du document importé"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      />
                      <span className="image-ready"><CheckCircle2 size={13} /> Image prête</span>
                    </div>
                    <div className="image-toolbar">
                      <div className="file-meta">
                        <FileImage size={18} />
                        <span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
                      </div>
                      <div className="toolbar-actions">
                        <button
                          className="secondary-button compact-button"
                          onClick={() => setRotation((current) => (current + 90) % 360)}
                          disabled={status === 'processing'}
                        >
                          <RotateCw size={16} /> Pivoter
                        </button>
                        <button
                          className="secondary-button compact-button change-button"
                          onClick={() => inputRef.current?.click()}
                          disabled={status === 'processing'}
                        >
                          Changer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  className="visually-hidden"
                  onClick={(event) => { event.currentTarget.value = '' }}
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0]
                    if (selectedFile) selectFile(selectedFile)
                  }}
                />
              </section>

              <section className="result-workspace" aria-label="Résultat de l'extraction">
                <div className="panel-heading result-heading">
                  <div>
                    <span className="panel-kicker">TEXTE EXTRAIT</span>
                    <h3>{status === 'done' ? 'Votre texte est prêt' : "Prêt pour l'analyse"}</h3>
                  </div>
                  {status === 'done' && result && <span className="success-pill"><Check size={13} /> Terminé</span>}
                </div>

                <div className="language-control">
                  <label htmlFor="ocr-language"><Languages size={16} /> Langue du document</label>
                  <div className="select-wrap">
                    <span className="lang-code">{selectedLanguage?.short}</span>
                    <select
                      id="ocr-language"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      disabled={status === 'processing'}
                    >
                      {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                    </select>
                  </div>
                </div>

                {status === 'processing' ? (
                  <div className="processing-panel">
                    <div className="progress-visual" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
                      <div><span>{progress}</span><small>%</small></div>
                    </div>
                    <h4>{progressLabel}</h4>
                    <p>Notre moteur reconnaît les caractères et reconstruit les paragraphes.</p>
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                    <button className="text-button" onClick={cancelExtraction}>Annuler</button>
                  </div>
                ) : status === 'done' ? (
                  <div className="result-panel">
                    <div className="result-editor-wrap">
                      <textarea
                        className="result-editor"
                        value={result}
                        onChange={(event) => setResult(event.target.value)}
                        aria-label="Texte extrait et éditable"
                        spellCheck
                      />
                      <button className="floating-copy" onClick={() => copyText()} aria-label="Copier le texte">
                        <Copy size={16} />
                      </button>
                    </div>
                    <div className="result-stats">
                      <span><strong>{wordCount}</strong> mots</span>
                      <span><strong>{characterCount}</strong> caractères</span>
                      <span className={confidence >= 70 ? 'good-confidence' : ''}><strong>{confidence}%</strong> de confiance</span>
                    </div>
                    <div className="result-actions">
                      <button className="primary-button" onClick={() => copyText()}><Copy size={17} /> Copier le texte</button>
                      <button className="secondary-button" onClick={downloadText}><Download size={17} /> .TXT</button>
                    </div>
                    {!file && (
                      <button className="new-conversion-link" onClick={clearFile}><ArrowRight size={15} /> Nouvelle conversion</button>
                    )}
                  </div>
                ) : (
                  <div className="empty-result">
                    <div className="empty-result-icon"><ScanText size={34} /></div>
                    <h4>Votre texte apparaîtra ici</h4>
                    <p>
                      {file
                        ? "Tout est prêt. Lancez l’analyse pour transformer votre image en texte éditable."
                        : "Importez une image à gauche, choisissez sa langue et laissez Clairtext faire le reste."}
                    </p>
                    <div className="mini-flow" aria-hidden="true">
                      <span className={file ? 'flow-done' : ''}><ImageIcon size={15} /></span>
                      <i />
                      <span><Zap size={15} /></span>
                      <i />
                      <span><FileText size={15} /></span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="error-message" role="alert"><AlertCircle size={17} /><span>{error}</span></div>
                )}

                {(status === 'idle' || status === 'ready') && (
                  <button className="extract-button" onClick={extractText} disabled={!file}>
                    <Sparkles size={18} /> Extraire le texte <ArrowRight size={18} />
                  </button>
                )}

                {status === 'error' && file && (
                  <button className="extract-button" onClick={extractText}>
                    <RotateCw size={18} /> Réessayer <ArrowRight size={18} />
                  </button>
                )}
              </section>
            </div>

            <div className="paste-tip">
              <Clipboard size={16} />
              <span>Astuce : vous pouvez aussi <strong>coller une capture d’écran</strong> avec <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
            </div>
          </div>
        </section>

        {history.length > 0 && (
          <section className="history-section section-width" aria-labelledby="history-title">
            <div className="section-heading-row">
              <div>
                <p className="section-eyebrow"><Clock3 size={15} /> SUR CET APPAREIL</p>
                <h2 id="history-title">Conversions récentes</h2>
              </div>
              <button className="clear-history" onClick={() => setHistory([])}>Tout effacer</button>
            </div>
            <div className="history-grid">
              {history.map((item) => (
                <article className="history-card" key={item.id}>
                  <button className="history-main" onClick={() => openHistoryItem(item)}>
                    <span className="history-icon"><FileText size={21} /></span>
                    <span className="history-info">
                      <strong>{item.name}</strong>
                      <small>{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {languageName(item.language)}</small>
                      <span>{item.text.slice(0, 72) || 'Aucun texte détecté'}{item.text.length > 72 ? '…' : ''}</span>
                    </span>
                  </button>
                  <div className="history-actions">
                    <button onClick={() => copyText(item.text)} aria-label={`Copier ${item.name}`}><Copy size={15} /></button>
                    <button onClick={() => deleteHistoryItem(item.id)} aria-label={`Supprimer ${item.name}`}><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="features-section section-width" id="fonctionnalites">
          <div className="features-intro">
            <p className="section-eyebrow"><Sparkles size={15} /> SIMPLE PAR NATURE</p>
            <h2>Du pixel au mot,<br /><em>sans détour.</em></h2>
            <p>Un outil précis et agréable, pensé pour vous faire gagner du temps sans sacrifier votre vie privée.</p>
          </div>
          <div className="features-grid">
            <article className="feature-card feature-primary">
              <div className="feature-icon"><Zap size={22} /></div>
              <span className="feature-number">01</span>
              <h3>Rapide comme l’éclair</h3>
              <p>Vos documents sont analysés en quelques secondes grâce à un moteur OCR éprouvé.</p>
              <div className="speed-demo"><span>image.jpg</span><i /><strong>texte.txt</strong></div>
            </article>
            <article className="feature-card">
              <div className="feature-icon coral"><Languages size={22} /></div>
              <span className="feature-number">02</span>
              <h3>6 langues reconnues</h3>
              <p>Du français à l’anglais, sélectionnez la langue adaptée pour un résultat plus précis.</p>
              <div className="language-cloud"><span>FR</span><span>EN</span><span>ES</span><span>DE</span><span>IT</span><span>PT</span></div>
            </article>
            <article className="feature-card privacy-feature" id="confidentialite">
              <div className="feature-icon green"><ShieldCheck size={22} /></div>
              <span className="feature-number">03</span>
              <h3>Privé, vraiment</h3>
              <p>L’analyse s’effectue dans votre navigateur. Votre image n’est jamais envoyée vers notre serveur.</p>
              <div className="privacy-seal"><LockKeyhole size={17} /> Zéro stockage</div>
            </article>
          </div>
        </section>

        <section className="how-section section-width">
          <div className="how-copy">
            <p className="section-eyebrow"><MousePointer2 size={15} /> COMMENT ÇA MARCHE ?</p>
            <h2>Trois gestes.<br />C’est tout.</h2>
          </div>
          <ol className="steps-list">
            <li><span>1</span><div><strong>Ajoutez une image</strong><p>Glissez, sélectionnez ou collez votre document.</p></div></li>
            <li><span>2</span><div><strong>Lancez l’analyse</strong><p>Clairtext détecte automatiquement les caractères.</p></div></li>
            <li><span>3</span><div><strong>Récupérez le texte</strong><p>Modifiez, copiez ou téléchargez le résultat.</p></div></li>
          </ol>
        </section>

        <section className="closing-section section-width">
          <div className="closing-card">
            <div className="closing-sparkle">✦</div>
            <p>PRÊT À GAGNER DU TEMPS ?</p>
            <h2>Une image. Un clic.<br /><em>Votre texte.</em></h2>
            <button className="light-button" onClick={() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' })}>
              Convertir une image <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer section-width">
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark"><ScanText size={20} /></span>
          <span>clairtext<span className="brand-dot">.</span></span>
        </a>
        <p>Transformer l’image en texte, simplement.</p>
        <span>© {new Date().getFullYear()} Clairtext · Fait avec soin</span>
      </footer>

      {toast && <div className="toast" role="status"><CheckCircle2 size={18} /> {toast}</div>}
    </div>
  )
}

export default App
