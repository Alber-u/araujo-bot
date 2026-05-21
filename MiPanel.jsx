import React, { useState, useMemo } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import { useBloqueosPanel, KpiInline } from '../components/ui'
import { VERSION, ESTADIO, BUILD_LABEL } from '../version.js'

/**
 * MiPanel · /mi-panel
 * --------------------------------------------------------------
 * ARA OS · Panel privado CEO · Alberto
 *
 * Acceso protegido por contraseña (client-side).
 * Contraseña: ara2026
 *
 * Vista de máxima síntesis para Alberto:
 *   - Salud financiera rápida
 *   - Estado operativo global
 *   - Bloqueos críticos del sistema
 *   - Resumen por persona (ownership)
 * --------------------------------------------------------------
 */

const CLAVE = 'ara2026'

// ─────────────────────────────────────────────────────────────
// Pantalla de contraseña
// ─────────────────────────────────────────────────────────────
function PantallaContrasena({ onAcceso }) {
  const [valor, setValor] = useState('')
  const [error, setError] = useState(false)
  const [mostrar, setMostrar] = useState(false)

  function intentar(e) {
    e.preventDefault()
    if (valor === CLAVE) {
      setError(false)
      onAcceso()
    } else {
      setError(true)
      setValor('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar active="ceo" />

      <div className="flex-1 flex items-center justify-center">
        <div
          className="bg-panel border border-line rounded-xl p-8 w-full max-w-xs shadow-lg"
          style={{ maxWidth: '320px' }}
        >
          {/* Logo · estrella CEO */}
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-infoBg)' }}
            >
              <svg
                width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="var(--color-info)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.8 1-6L3.4 9.4l6-.9z" />
              </svg>
            </div>
          </div>

          <h1 className="text-center text-lg font-semibold text-ink mb-1">
            Mi panel
          </h1>
          <p className="text-center text-sm text-muted mb-6">
            Acceso privado · Alberto
          </p>

          <form onSubmit={intentar} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type={mostrar ? 'text' : 'password'}
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="Contraseña"
                autoFocus
                className={[
                  'w-full rounded-lg border px-4 py-2.5 text-sm bg-bg text-ink',
                  'outline-none focus:ring-2 pr-10',
                  error
                    ? 'border-risk ring-risk/30'
                    : 'border-line focus:border-info focus:ring-info/20',
                ].join(' ')}
                style={{ fontFamily: 'inherit' }}
              />
              {/* Toggle mostrar contraseña */}
              <button
                type="button"
                onClick={() => setMostrar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                tabIndex={-1}
              >
                {mostrar ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p className="text-xs text-risk text-center animate-pulse">
                Contraseña incorrecta
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: 'var(--color-info)',
                color: '#fff',
              }}
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-xs text-faint mt-5">
            ARA OS · acceso restringido
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Panel CEO · contenido real
// ─────────────────────────────────────────────────────────────
function PanelCEO({ onCerrar }) {
  const { bloqueos, kpis: kpisApi, loading, error, recargar } = useBloqueosPanel()

  const [tabBloqueos, setTabBloqueos] = useState('criticos')

  // Bloqueos filtrados
  const listaBloqueos = useMemo(() => {
    if (tabBloqueos === 'criticos')    return bloqueos.filter(b => b.severidad === 'critica')
    if (tabBloqueos === 'seguimiento') return bloqueos.filter(b => b.severidad === 'seguimiento')
    return bloqueos
  }, [tabBloqueos, bloqueos])

  // Distribución por owner
  const porOwner = useMemo(() => {
    const m = {}
    for (const b of bloqueos) {
      const o = b.owner || '—'
      m[o] = (m[o] || 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [bloqueos])

  const criticos = bloqueos.filter(b => b.severidad === 'critica').length
  const seguimiento = bloqueos.filter(b => b.severidad === 'seguimiento').length
  const antiguos = bloqueos.filter(b => (b.dias_bloqueado || 0) >= 7).length

  const kpis = [
    { label: 'Total bloqueos',  valor: String(bloqueos.length),  tono: 'ink'  },
    { label: 'Críticos',        valor: String(criticos),          tono: 'risk' },
    { label: 'Seguimiento',     valor: String(seguimiento),       tono: 'warn' },
    { label: '+7 días parados', valor: String(antiguos),          tono: antiguos > 0 ? 'risk' : 'ok' },
  ]

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar active="ceo" />

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Banner */}
        <div className="bg-warnBg text-warn text-xs px-6 h-8 flex items-center justify-between border-b border-warnBd">
          <span>
            <span className="font-semibold uppercase tracking-wider mr-2">Privado</span>
            Panel CEO · Alberto · acceso autenticado · v{VERSION}
          </span>
          <span className="text-faint tabular">{BUILD_LABEL}</span>
        </div>

        {/* Cabecera */}
        <div className="bg-panel border-b border-line h-14 px-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-lg font-semibold text-ink truncate">★ Mi panel</h1>
            <span className="text-sm text-muted truncate">
              radar privado CEO · visión global sin filtrar
            </span>
          </div>
          <button
            onClick={onCerrar}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-risk transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-line"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Salir
          </button>
        </div>

        {/* KPIs */}
        <div className="px-6 h-11 flex items-center border-b border-line bg-panel overflow-x-auto">
          <KpiInline items={kpis} />
        </div>

        {/* Contenido */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* ── Distribución por owner ────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Bloqueos por persona
              </h2>

              {loading ? (
                <p className="text-sm text-muted">Cargando…</p>
              ) : porOwner.length === 0 ? (
                <p className="text-sm text-muted">Sin bloqueos activos · sistema en orden 👍</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {porOwner.map(([owner, n]) => (
                    <div
                      key={owner}
                      className="bg-panel border border-line rounded-lg px-4 py-3 flex items-center justify-between"
                    >
                      <span className="text-sm text-ink truncate">{owner}</span>
                      <span
                        className="text-sm font-semibold tabular ml-3"
                        style={{ color: n >= 3 ? 'var(--color-risk)' : n >= 1 ? 'var(--color-warn)' : 'var(--color-ok)' }}
                      >
                        {n}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Bloqueos ─────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Bloqueos del sistema
                {antiguos > 0 && (
                  <span className="ml-auto text-xs text-risk font-medium tabular">
                    ⚠ {antiguos} con +7 días sin movimiento
                  </span>
                )}
              </h2>

              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-line mb-4">
                <TabBtn id="criticos"    activo={tabBloqueos} setTab={setTabBloqueos}
                  label={`Críticos (${criticos})`}    tono="risk" />
                <TabBtn id="seguimiento" activo={tabBloqueos} setTab={setTabBloqueos}
                  label={`Seguimiento (${seguimiento})`} tono="warn" />
                <TabBtn id="todos"       activo={tabBloqueos} setTab={setTabBloqueos}
                  label={`Todos (${bloqueos.length})`} />
              </div>

              {loading ? (
                <p className="text-sm text-muted">Cargando datos del sistema…</p>
              ) : error ? (
                <div className="text-sm text-risk flex items-center gap-2">
                  <span>Error cargando datos</span>
                  <button onClick={recargar}
                    className="underline hover:no-underline text-info">
                    Reintentar
                  </button>
                </div>
              ) : listaBloqueos.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <p className="text-2xl mb-2">👍</p>
                  <p className="text-sm">
                    {tabBloqueos === 'criticos'    ? 'Sin bloqueos críticos' :
                     tabBloqueos === 'seguimiento' ? 'Sin bloqueos en seguimiento' :
                     'No hay bloqueos · sistema en orden'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {listaBloqueos.map((b, i) => (
                    <BloqueoFila key={b.id || i} bloqueo={b} />
                  ))}
                </div>
              )}
            </section>

          </div>
        </main>

        {/* Pie */}
        <footer className="border-t border-line bg-panel px-6 h-9 flex items-center justify-between text-xs text-muted tabular">
          <span>ARA OS · v{VERSION} · {ESTADIO}</span>
          <span>fuente: /api/ara-os/panel · radar CEO privado</span>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Fila de bloqueo
// ─────────────────────────────────────────────────────────────
function BloqueoFila({ bloqueo: b }) {
  const colorSev =
    b.severidad === 'critica'    ? 'var(--color-risk)' :
    b.severidad === 'seguimiento' ? 'var(--color-warn)' :
    'var(--color-muted)'

  return (
    <div className="bg-panel border border-line rounded-lg px-4 py-3 flex items-start gap-3">
      {/* Dot severidad */}
      <span
        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
        style={{ background: colorSev }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink leading-snug">{b.descripcion || b.texto || '—'}</p>
        {b.obra && (
          <p className="text-xs text-muted mt-0.5 truncate">{b.obra}</p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {b.owner && (
          <span className="text-xs text-info font-medium">{b.owner}</span>
        )}
        {b.dias_bloqueado > 0 && (
          <span
            className="text-xs tabular"
            style={{ color: b.dias_bloqueado >= 7 ? 'var(--color-risk)' : 'var(--color-muted)' }}
          >
            {b.dias_bloqueado}d
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab button
// ─────────────────────────────────────────────────────────────
function TabBtn({ id, activo, setTab, label, tono }) {
  const isActivo = activo === id
  const colorActivo =
    tono === 'risk' ? 'border-risk text-risk' :
    tono === 'warn' ? 'border-warn text-warn' :
    'border-info text-info'

  return (
    <button
      onClick={() => setTab(id)}
      className={
        'h-10 px-3 text-sm border-b-2 transition-colors -mb-px ' +
        (isActivo
          ? colorActivo + ' font-semibold'
          : 'border-transparent text-muted hover:text-ink')
      }
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Entrada principal · gestiona el estado de auth en memoria
// ─────────────────────────────────────────────────────────────
export default function MiPanel() {
  // Intentamos recuperar la sesión de sessionStorage para que
  // no pida contraseña al navegar y volver en la misma pestaña.
  const [autenticado, setAutenticado] = useState(() => {
    try { return sessionStorage.getItem('ara_ceo_auth') === '1' } catch { return false }
  })

  function entrar() {
    try { sessionStorage.setItem('ara_ceo_auth', '1') } catch {}
    setAutenticado(true)
  }

  function salir() {
    try { sessionStorage.removeItem('ara_ceo_auth') } catch {}
    setAutenticado(false)
  }

  if (!autenticado) return <PantallaContrasena onAcceso={entrar} />
  return <PanelCEO onCerrar={salir} />
}
