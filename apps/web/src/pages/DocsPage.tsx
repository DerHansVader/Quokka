import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { QuokkaMark } from '../components/QuokkaMark';
import s from './DocsPage.module.css';

interface SectionDef { id: string; title: string; }

const SECTIONS: SectionDef[] = [
  { id: 'quickstart',   title: 'Quick start' },
  { id: 'install',      title: 'Install the SDK' },
  { id: 'api-key',      title: 'Get an API key' },
  { id: 'first-run',    title: 'Your first run' },
  { id: 'scalars',      title: 'Logging scalars' },
  { id: 'samples',      title: 'Logging samples' },
  { id: 'projects',     title: 'Projects & teams' },
  { id: 'ui',           title: 'The dashboard' },
  { id: 'team-admin',   title: 'Roles & invites' },
  { id: 'env',          title: 'Environment' },
];

function CodeBlock({ children, lang = 'bash' }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };
  return (
    <div className={s.code}>
      <div className={s.codeBar}>
        <span className={s.codeLang}>{lang}</span>
        <button className={s.copyBtn} onClick={copy} aria-label="Copy">
          {copied ? 'Copied' : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre className={s.codePre}><code>{children}</code></pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={s.section}>
      <h2 className={s.h2}>
        <a href={'#' + id} className={s.anchor} aria-hidden>#</a>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DocsPage() {
  const { token } = useAuthStore();
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className={s.root}>
      <header className={s.topbar}>
        <Link to="/" className={s.brand}>
          <span className={s.logo}>
            <QuokkaMark size={26} />
          </span>
          <span className={s.wordmark}>quokka</span>
          <span className={s.topbarTag}>docs</span>
        </Link>
        <Link to={token ? '/' : '/login'} className={s.topbarCta}>
          {token ? 'Open app' : 'Sign in'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </header>

      <div className={s.hero}>
        <div className={s.heroInner}>
          <h1 className={s.h1}>Track training runs.<br />Without the friction.</h1>
          <p className={s.lede}>
            Quokka is a tiny, honest experiment tracker. Log scalars and samples from your
            training loop; browse them in a fast, quiet dashboard. No magic, no bloat.
          </p>
          <div className={s.heroActions}>
            <a href="#quickstart" className={s.heroBtn}>Get started</a>
            <a href="https://github.com/DerHansVader/Quokka" className={s.heroLink} target="_blank"
              rel="noreferrer">
              View on GitHub
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
            <a
              href="https://www.google.com/search?tbm=isch&q=quokka"
              className={s.heroLink}
              target="_blank"
              rel="noreferrer"
            >
              What does the name "Quokka" mean?
            </a>
          </div>
        </div>
      </div>

      <div className={s.body}>
        <aside className={s.toc}>
          <div className={s.tocLabel}>On this page</div>
          <nav>
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={'#' + sec.id}
                className={[s.tocLink, active === sec.id ? s.tocLinkActive : ''].join(' ')}
              >
                {sec.title}
              </a>
            ))}
          </nav>
        </aside>

        <main className={s.content}>
          <Section id="quickstart" title="Quick start">
            <p>Four lines and you're logging:</p>
            <CodeBlock lang="python">{`import quokka

quokka.init(project="my-experiment")
quokka.log({"loss": 0.42, "accuracy": 0.91})`}</CodeBlock>
            <p>
              The rest of this guide walks through installation, getting an API key, and
              the handful of features you'll actually use.
            </p>
          </Section>

          <Section id="install" title="Install the SDK">
            <p>The Python SDK ships on PyPI.</p>
            <CodeBlock lang="bash">{`pip install quokka-tracker`}</CodeBlock>
            <p>Or with uv, if that's your style:</p>
            <CodeBlock lang="bash">{`uv add quokka-tracker`}</CodeBlock>
          </Section>

          <Section id="api-key" title="Get an API key">
            <ol className={s.ol}>
              <li>Sign in to your Quokka instance.</li>
              <li>Open <Link to="/settings" className={s.inlineLink}>Settings</Link> from the top-right.</li>
              <li>Create a new API key. Copy the token — it is shown once.</li>
            </ol>
            <p>Export it as an environment variable:</p>
            <CodeBlock lang="bash">{`export QK_API_KEY="qk_<your-token-here>"`}</CodeBlock>
            <p>Or call <code className={s.ic}>quokka.login()</code> from Python:</p>
            <CodeBlock lang="python">{`import quokka
quokka.login("qk_<your-token-here>")`}</CodeBlock>
          </Section>

          <Section id="first-run" title="Your first run">
            <p>
              Call <code className={s.ic}>quokka.init()</code> before your training loop. It
              creates a run on the server and returns a handle you can keep around, or you
              can just use the module-level <code className={s.ic}>quokka.log()</code>.
            </p>
            <CodeBlock lang="python">{`import quokka

quokka.init(project="qwen35-sft", run="coord-loss-v3", config={"lr": 1e-4})

for step in range(1000):
    loss = train_step()
    quokka.log({"loss": loss}, step=step)

quokka.finish()`}</CodeBlock>
            <p>
              Projects are auto-created on first log. If your user belongs to multiple
              teams, prefix with <code className={s.ic}>"team-slug/project"</code> to pin
              which team owns the project.
            </p>
          </Section>

          <Section id="scalars" title="Logging scalars">
            <p>
              Any numeric value you pass to <code className={s.ic}>quokka.log()</code> becomes a
              time-series panel. You can log several keys at once; step is optional and
              auto-increments if omitted.
            </p>
            <CodeBlock lang="python">{`quokka.log({
    "loss/total":     0.412,
    "loss/policy":    0.203,
    "loss/value":     0.209,
    "lr":             1.2e-4,
    "grad_norm":      1.87,
})`}</CodeBlock>
            <p>
              Use slash-separated keys (<code className={s.ic}>loss/total</code>,
              <code className={s.ic}> loss/policy</code>) to group panels in the dashboard.
            </p>
          </Section>

          <Section id="samples" title="Logging samples">
            <p>
              For generation tasks, compare ground-truth and predicted output side-by-side.
              Wrap an image with <code className={s.ic}>quokka.Image</code> (accepts a PIL image
              or raw bytes) and log it as a <code className={s.ic}>quokka.Sample</code>.
            </p>
            <CodeBlock lang="python">{`from PIL import Image

img = Image.open("frame.png")

quokka.log({
    "val/sample": quokka.Sample(
        image=quokka.Image(img),
        gt="click at (412, 287)",
        pred="click at (410, 288)",
    )
}, step=step)`}</CodeBlock>
            <p>
              The sample viewer scrubs across steps so you can see how predictions drift over
              training. Input image, GT, and prediction sit next to each other — no tabs.
            </p>
          </Section>

          <Section id="projects" title="Projects & teams">
            <p>The hierarchy is small and honest:</p>
            <ul className={s.ul}>
              <li><strong>Team</strong> — a group of users with owners, team admins, and members.</li>
              <li><strong>Project</strong> — a named bucket of runs inside a team.</li>
              <li><strong>Run</strong> — one training execution; has metrics, samples, config, a heartbeat.</li>
            </ul>
            <p>
              Projects are auto-created when you first log to them. To pin the owning team
              explicitly (useful if you belong to more than one), use the
              <code className={s.ic}> team/project</code> syntax:
            </p>
            <CodeBlock lang="python">{`quokka.init(project="research/qwen35-sft")`}</CodeBlock>
          </Section>

          <Section id="ui" title="The dashboard">
            <p>Three things are worth knowing about the UI:</p>
            <ul className={s.ul}>
              <li>
                <strong>Log axes don't mutate data.</strong> Toggling the x or y axis to
                log only changes how it's drawn. Your stored values are always the raw ones.
              </li>
              <li>
                <strong>Smoothing is edge-honest.</strong> Endpoints don't collapse to the
                mean; a truncated kernel with per-point renormalization is used.
              </li>
              <li>
                <strong>Live updates, no reloads.</strong> Runs stream over SSE. Panels
                update as metrics arrive.
              </li>
            </ul>
          </Section>

          <Section id="team-admin" title="Roles & invites">
            <p>
              One Quokka instance is one company. Two layers of control:
            </p>
            <ul className={s.ul}>
              <li>
                <strong>Super admin</strong> — instance-wide. Sees and manages every team and
                user from the <strong>Admin</strong> page. Doesn't need to be a member of any team.
                The first signup is auto-promoted; super admins can promote others.
              </li>
              <li>
                <strong>Owner</strong> — full control of one team; can manage owners.
              </li>
              <li>
                <strong>Team admin</strong> — invite and remove members, change non-owner roles.
              </li>
              <li>
                <strong>Member</strong> — read/write access to the team's projects and runs.
              </li>
            </ul>
            <p>
              Invites are key-based: a team admin (or super admin, or owner) creates a key in
              <strong> Team settings</strong>, copies it, and shares it. New users paste it during
              signup; existing users paste it from the Teams page. Keys expire after 7 days and
              can be revoked.
            </p>
          </Section>

          <Section id="env" title="Environment">
            <p>Two environment variables are respected by the SDK:</p>
            <div className={s.table}>
              <div className={s.trow}>
                <code className={s.tkey}>QK_API_KEY</code>
                <span className={s.tval}>Your personal API token. Required unless you call <code className={s.ic}>quokka.login()</code>.</span>
              </div>
              <div className={s.trow}>
                <code className={s.tkey}>QK_BASE_URL</code>
                <span className={s.tval}>Where the Quokka API lives. Defaults to <code className={s.ic}>http://localhost:4000</code>.</span>
              </div>
            </div>
            <p>
              Unsent points are spooled to <code className={s.ic}>~/.quokka/spool/</code>
              if the server is briefly unreachable. Your training loop never blocks on
              network I/O.
            </p>
          </Section>
        </main>
      </div>

      <footer className={s.footer}>
        <span>Quokka · minimal experiment tracking</span>
      </footer>
    </div>
  );
}
