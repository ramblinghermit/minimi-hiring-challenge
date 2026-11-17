// Ported from vercel-labs/ui (@ui-sdk/core foundation/lists/stick-to-bottom.ts)
// Zero-dependency pure TypeScript behavioral primitive for streaming chat logs

export type StickToBottomState = {
  /** Whether new content scrolls into view. */
  following: boolean;
  /** Whether the end is in view now. */
  atBottom: boolean;
  /** Whether content arrived below while not following. Clears at the bottom. */
  unseen: boolean;
};

export type StickToBottomOptions = {
  /** How close to the end, in pixels, still counts as at the bottom. @defaultValue 32 */
  threshold?: number;
  /** Whether it follows from the start. @defaultValue true */
  initial?: boolean;
  /** Runs when state changes. */
  onChange?: (state: StickToBottomState) => void;
};

export function createStickToBottom(options: StickToBottomOptions = {}) {
  let state: StickToBottomState = {
    following: options.initial ?? true,
    atBottom: true,
    unseen: false,
  };
  const listeners = new Set<() => void>();
  let scroller: HTMLElement | undefined;
  let ours: number | null = null;
  let lastTop = 0;
  let lastHeight = 0;
  let anchor: number | null = null;

  const threshold = () => options.threshold ?? 32;
  const distance = (el: HTMLElement) =>
    el.scrollHeight - el.clientHeight - el.scrollTop;

  function set(next: Partial<StickToBottomState>) {
    const merged = { ...state, ...next };
    if (merged.atBottom) {
      merged.unseen = false;
    }
    if (
      merged.following === state.following &&
      merged.atBottom === state.atBottom &&
      merged.unseen === state.unseen
    ) {
      return;
    }
    state = merged;
    options.onChange?.(state);
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function toEnd(el: HTMLElement, behavior?: ScrollBehavior) {
    const top = el.scrollHeight - el.clientHeight;
    ours = Math.max(0, Math.round(top));
    if (behavior === "smooth") {
      el.scrollTo({ top, behavior });
    } else {
      el.scrollTop = top;
    }
  }

  function resized() {
    const el = scroller;
    if (!el) return;
    const grew = el.scrollHeight > lastHeight;
    let unseen = false;

    if (anchor !== null && el.scrollHeight !== lastHeight) {
      ours = Math.round(el.scrollHeight - el.clientHeight - anchor);
      el.scrollTop = ours;
      anchor = null;
    } else if (state.following) {
      toEnd(el);
    } else {
      unseen = grew;
    }

    lastHeight = el.scrollHeight;
    lastTop = el.scrollTop;
    set({ atBottom: distance(el) <= threshold(), ...(unseen && { unseen }) });
  }

  function scrolled() {
    const el = scroller;
    if (!el) return;
    const top = el.scrollTop;
    const atBottom = distance(el) <= threshold();
    const mine = ours !== null && Math.abs(top - ours) <= 1;

    if (mine) {
      if (atBottom) {
        ours = null;
      }
    } else if (top < lastTop - 1 && !atBottom) {
      set({ following: false });
    } else if (atBottom) {
      set({ following: true });
    }
    lastTop = top;
    set({ atBottom });
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    connect(el: HTMLElement) {
      scroller = el;
      el.style.setProperty("overflow-anchor", "none");
      const view = el.ownerDocument.defaultView;
      const sizes = view?.ResizeObserver
        ? new view.ResizeObserver(resized)
        : undefined;

      const watch = () => {
        sizes?.disconnect();
        sizes?.observe(el);
        for (const child of el.children) {
          sizes?.observe(child);
        }
      };
      watch();

      const children = view?.MutationObserver
        ? new view.MutationObserver(() => {
            watch();
            resized();
          })
        : undefined;
      children?.observe(el, { childList: true });

      const intent = (event: WheelEvent | TouchEvent | KeyboardEvent) => {
        const up =
          event.type === "wheel"
            ? (event as WheelEvent).deltaY < 0
            : event.type === "keydown"
              ? ["ArrowUp", "PageUp", "Home"].includes((event as KeyboardEvent).key)
              : true;

        if (up && el.scrollHeight > el.clientHeight) {
          ours = null;
          if (event.type !== "touchmove") {
            set({ following: false });
          }
        }
      };

      el.addEventListener("scroll", scrolled, { passive: true });
      el.addEventListener("wheel", intent, { passive: true });
      el.addEventListener("touchmove", intent, { passive: true });
      el.addEventListener("keydown", intent);
      lastHeight = el.scrollHeight;

      if (state.following) {
        toEnd(el);
      }
      lastTop = el.scrollTop;

      return () => {
        sizes?.disconnect();
        children?.disconnect();
        el.removeEventListener("scroll", scrolled);
        el.removeEventListener("wheel", intent);
        el.removeEventListener("touchmove", intent);
        el.removeEventListener("keydown", intent);
        if (scroller === el) {
          scroller = undefined;
        }
      };
    },
    scrollToBottom({ behavior = "smooth" }: { behavior?: ScrollBehavior } = {}) {
      set({ following: true });
      if (scroller) {
        toEnd(scroller, behavior);
      }
    },
    release() {
      set({ following: false });
    },
    prepend() {
      if (scroller) {
        anchor = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      }
    },
  };
}

export type StickToBottom = ReturnType<typeof createStickToBottom>;
