type LoaderListener = (state: LoaderState) => void;

export interface LoaderOptions {
  message?: string;
  blocking?: boolean;
}

export interface LoaderState {
  isLoading: boolean;
  isBlocking: boolean;
  message: string;
  activeCount: number;
}

class GlobalLoaderService {
  private activeCount = 0;
  private blockingCount = 0;
  private message = "";
  private listeners = new Set<LoaderListener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isVisible = false;

  private notify() {
    const state: LoaderState = {
      isLoading: this.isVisible,
      isBlocking: this.blockingCount > 0,
      message: this.message || "Loading...",
      activeCount: this.activeCount,
    };

    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error("GlobalLoaderService listener error:", err);
      }
    }
  }

  public subscribe(listener: LoaderListener): () => void {
    this.listeners.add(listener);
    listener({
      isLoading: this.isVisible,
      isBlocking: this.blockingCount > 0,
      message: this.message || "Loading...",
      activeCount: this.activeCount,
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start tracking an API request.
   * Debounces the visible indicator by 120ms to prevent screen flickering
   * on fast sub-100ms requests.
   */
  public startRequest(options?: LoaderOptions): () => void {
    this.activeCount++;
    if (options?.blocking) {
      this.blockingCount++;
    }
    if (options?.message) {
      this.message = options.message;
    }

    if (!this.isVisible && !this.debounceTimer) {
      // If blocking, show immediately without debounce
      if (options?.blocking) {
        this.isVisible = true;
        this.notify();
      } else {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          if (this.activeCount > 0) {
            this.isVisible = true;
            this.notify();
          }
        }, 120);
      }
    } else if (this.isVisible) {
      this.notify();
    }

    let stopped = false;
    return () => {
      if (!stopped) {
        stopped = true;
        this.stopRequest(options?.blocking);
      }
    };
  }

  /**
   * Stop tracking an API request.
   */
  public stopRequest(blocking?: boolean) {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (blocking) {
      this.blockingCount = Math.max(0, this.blockingCount - 1);
    }

    if (this.activeCount === 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.isVisible = false;
      this.blockingCount = 0;
      this.message = "";
      this.notify();
    } else {
      this.notify();
    }
  }

  /**
   * Imperatively show the loader
   */
  public show(message?: string, options?: { blocking?: boolean }) {
    return this.startRequest({
      message: message || "Please wait...",
      blocking: options?.blocking ?? false,
    });
  }

  /**
   * Imperatively hide the loader
   */
  public hide() {
    this.activeCount = 0;
    this.blockingCount = 0;
    this.message = "";
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isVisible = false;
    this.notify();
  }

  public getState(): LoaderState {
    return {
      isLoading: this.isVisible,
      isBlocking: this.blockingCount > 0,
      message: this.message || "Loading...",
      activeCount: this.activeCount,
    };
  }
}

export const globalLoader = new GlobalLoaderService();
