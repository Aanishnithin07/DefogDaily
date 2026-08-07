import { Component, Suspense } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Guards a lazily-loaded chart chunk.
 *
 * A dynamic import can fail for reasons that have nothing to do with the user:
 * a flaky connection, or — far more commonly — a redeploy that replaced the
 * content-hashed chunk their open tab is still holding a URL for. Suspense
 * alone does not catch that; the rejected promise propagates to the nearest
 * error boundary, which was the root one, so a failed chart fetch replaced the
 * entire app with "Something broke".
 *
 * A chart is decoration around data the user can already read, so the failure
 * is contained inline and the rest of the report stays usable.
 */
export default class ChartBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, attempt: 0 };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("Chart chunk failed to load:", error);
  }

  retry = () => {
    // A hard reload is the only reliable recovery: React.lazy caches the
    // rejection on the component object itself, so remounting replays it. This
    // also picks up the newly deployed bundle, which is usually the real fix.
    window.location.reload();
  };

  render() {
    const { height = 300, children, label = "chart" } = this.props;

    if (this.state.failed) {
      return (
        <div
          style={{ height }}
          className="grid place-items-center rounded-2xl-soft border border-dashed border-white/10 bg-white/[0.02] p-6 text-center"
        >
          <div>
            <p className="text-sm text-text-secondary">
              This {label} could not load — the app was probably updated while your tab was open.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl-soft border border-white/15 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-white/[0.06]"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Reload
            </button>
            <p className="mt-2 text-2xs text-text-tertiary">
              Everything else on this page still works, and your data is untouched.
            </p>
          </div>
        </div>
      );
    }

    return (
      <Suspense
        fallback={<div className="skeleton w-full rounded-3xl-soft" style={{ height }} />}
      >
        {children}
      </Suspense>
    );
  }
}
