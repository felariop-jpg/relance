import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

function CrashMessage() {
  const { t } = useTranslation();
  return (
    <section role="alert" className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{t('crash.title')}</h1>
      <p className="mt-3 text-stone-600">{t('crash.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white hover:bg-accent-800"
      >
        {t('crash.reload')}
      </button>
    </section>
  );
}

/** Keeps a bug on one screen from blanking the whole app. Resets when the screen changes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    return this.state.failed ? <CrashMessage /> : this.props.children;
  }
}
