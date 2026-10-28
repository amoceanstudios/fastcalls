import {
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  LayoutDashboard,
  Building2,
  Phone,
  CalendarDays,
  Database,
  Settings as SettingsIcon,
  ArrowUpRight,
  WifiOff,
  ShieldCheck,
  ChevronRight,
  Search,
  RefreshCw,
  Ellipsis,
} from "lucide-react";
import { Illustration } from "./components/Illustration";
import { db } from "./db/database";
import { defaultProfile, type Profile } from "./lib/models";
import { FeedbackProvider, Modal } from "./components/ui";
import { screens, preloadRoute } from "./app/routes";
const {
  dashboard: { Component: Dashboard },
  prospects: { Component: Directory },
  detail: { Component: Detail },
  calling: { Component: Calling },
  followups: { Component: Followups },
  data: { Component: DataCenter },
  settings: { Component: Settings },
} = screens;
const nav = [
  { to: "/", label: "Overzicht", icon: LayoutDashboard },
  { to: "/prospects", label: "Bedrijven", icon: Building2 },
  { to: "/calling", label: "Belmodus", icon: Phone },
  { to: "/followups", label: "Opvolgingen", icon: CalendarDays },
  { to: "/data", label: "Gegevens & back-ups", icon: Database },
];
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <Illustration kind="error" />
        <h1>Uw werkstation kon niet worden geladen</h1>
        <p>
          Controleer of deze browser lokale opslag toestaat en of er voldoende
          ruimte beschikbaar is. Uw gegevens zijn niet gewist.
        </p>
        <pre>{this.state.error.message}</pre>
        <button onClick={() => location.reload()}>Opnieuw proberen</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Shell() {
  const location = useLocation();
  const profile = useLiveQuery(() => db.settings.get("profile"));
  const p = (profile?.value as Profile) ?? defaultProfile;
  const [online, setOnline] = useState(navigator.onLine);
  const [command, setCommand] = useState(false);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [swError, setSwError] = useState(false);
  const companies =
    useLiveQuery(
      async () => (command ? await db.prospects.toArray() : []),
      [command],
    ) ?? [];
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      setSwError(true);
    },
  });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        p.theme === "system" ? (media.matches ? "dark" : "light") : p.theme;
      document.documentElement.dataset.density = p.density;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [p.theme, p.density]);
  useEffect(() => {
    setCommand(false);
    setMore(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      } else if (e.key === "/" && !editing) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Prospects doorzoeken"]',
        );
        if (input) input.focus();
        else setCommand(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const warmRoute = (event: { target: EventTarget | null }) => {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData || !(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (
      !(link instanceof HTMLAnchorElement) ||
      link.origin !== window.location.origin
    )
      return;
    preloadRoute(link.pathname);
  };
  const page =
    nav.find((n) =>
      n.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(n.to),
    )?.label ?? "Instellingen";
  return (
    <div
      className="app-shell"
      onPointerOver={warmRoute}
      onFocusCapture={warmRoute}
      onTouchStart={warmRoute}
    >
      <div className="glass-scene" aria-hidden="true" />
      <a className="skip-link" href="#main">
        Naar inhoud
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <div>
            <strong>
              amocean<span className="brand-ai">.ai</span>
            </strong>
            <small>PROSPECT OS</small>
          </div>
        </Link>
        <div className="workspace-label">DAGELIJKS</div>
        <nav aria-label="Hoofdnavigatie">
          {nav.slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <n.icon size={19} />
              {n.label}
              {n.to === "/calling" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-label">BEHEER</div>
          <NavLink to="/data" className="settings-link">
            <Database size={18} />
            Gegevens & back-ups
          </NavLink>
          <NavLink to="/settings" className="settings-link">
            <SettingsIcon size={18} />
            Instellingen
          </NavLink>
          <div className="profile">
            <span className="profile-avatar">
              {p.name ? p.name.slice(0, 2).toUpperCase() : "A"}
            </span>
            <div>
              <strong>{p.name || "Uw werkstation"}</strong>
              <small>{p.company}</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Amocean</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <span className="storage-status">
              {online ? <ShieldCheck size={14} /> : <WifiOff size={14} />}{" "}
              {online ? "Lokaal opgeslagen" : "Offline beschikbaar"}
            </span>
            <button
              className="command-button"
              aria-label="Snel zoeken"
              onClick={() => setCommand(true)}
            >
              <Search size={16} />
              <span>Zoeken</span>
              <kbd>⌘ K</kbd>
            </button>
          </div>
        </header>
        {!online && (
          <div className="status-banner">
            <WifiOff size={16} />U werkt offline. Wijzigingen worden op dit
            apparaat bewaard.
          </div>
        )}
        {swError && (
          <div className="status-banner warning">
            Offline installatie is niet gelukt. Open de app online opnieuw om
            het nogmaals te proberen.
          </div>
        )}
        {needRefresh && (
          <div className="status-banner">
            <RefreshCw size={16} />
            Een nieuwe versie staat klaar. Sla uw werk op.
            <button onClick={() => void updateServiceWorker(true)}>
              Nu bijwerken
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <Suspense
            fallback={
              <div
                className="route-loading"
                role="status"
                aria-label="Pagina laden"
              >
                <div />
                <div />
                <div />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/prospects" element={<Directory />} />
              <Route path="/prospects/:id" element={<Detail />} />
              <Route path="/calling" element={<Calling />} />
              <Route path="/followups" element={<Followups />} />
              <Route path="/data" element={<DataCenter />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <div>
                    <Illustration kind="search" />
                    <h1>Pagina niet gevonden</h1>
                    <Link to="/">Terug naar overzicht</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
          <footer className="main-footer">
            <span>AMOCEAN PROSPECT OS</span>
            <span>Uw gegevens blijven op dit apparaat.</span>
            <span>
              {offlineReady ? "Offline gereed" : "Lokaal werkstation"}{" "}
              <span className="live-dot" />
            </span>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Mobiele navigatie">
          {nav.slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <n.icon size={20} />
              <span>
                {n.to === "/calling"
                  ? "Bellen"
                  : n.to === "/followups"
                    ? "Agenda"
                    : n.label}
              </span>
            </NavLink>
          ))}
          <button
            className={`mobile-more ${location.pathname === "/data" || location.pathname === "/settings" ? "active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={more}
            aria-current={
              location.pathname === "/data" || location.pathname === "/settings"
                ? "page"
                : undefined
            }
            onClick={() => setMore(true)}
          >
            <Ellipsis size={20} />
            <span>Meer</span>
          </button>
        </nav>
      </div>
      {more && (
        <Modal
          title="Meer"
          description="Beheer uw gegevens en persoonlijke instellingen."
          open
          onClose={() => setMore(false)}
        >
          <div className="more-menu">
            <Link to="/data" onClick={() => setMore(false)}>
              <span className="more-menu-icon">
                <Database size={22} />
              </span>
              <span>
                <strong>Gegevens & back-ups</strong>
                <small>Importeren, exporteren en herstellen</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/settings" onClick={() => setMore(false)}>
              <span className="more-menu-icon">
                <SettingsIcon size={22} />
              </span>
              <span>
                <strong>Instellingen</strong>
                <small>Uw profiel, uiterlijk en voorkeuren</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className="small muted">Uw gegevens blijven op dit apparaat.</p>
        </Modal>
      )}
      {command && (
        <Modal
          title="Waar wilt u naartoe?"
          description="Zoek een bedrijf of ga direct naar een onderdeel. Sneltoets: Ctrl/⌘ + K."
          open
          onClose={() => setCommand(false)}
        >
          <input
            autoFocus
            aria-label="Snel zoeken"
            placeholder="Zoek een bedrijf…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="command-results">
            {companies
              .filter(
                (p) =>
                  query &&
                  `${p.companyName} ${p.city}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .slice(0, 8)
              .map((p) => (
                <Link
                  key={p.id}
                  to={`/prospects/${p.id}`}
                  onClick={() => setCommand(false)}
                >
                  {p.companyName}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setCommand(false)}>
                <n.icon size={17} />
                {n.label}
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </FeedbackProvider>
    </ErrorBoundary>
  );
}
